// One-time (re-runnable/idempotent) importer for the loans reviewed and
// highlighted red in YNL_Old_Loan_Report_by_Client.xlsx (generated from the
// legacy ynl_old loan_application.json / loan_payment.json export), after
// manually classifying each one as SSS or Pag-IBIG in the "SSS OR PAG IBIG"
// column inserted next to Loan Type — the source data alone never
// distinguished the two ("Salary Loan" / "Calamity Loan" is generic for
// both agencies), so that manual column is the only source of truth for it.
//
// Only rows with a solid RED cell fill (ARGB FFFF0000) are imported.
// Everything else in the workbook is left alone.
//
// Writes go through the raw driver collection (not the Mongoose model) so
// the extra traceability fields (legacyAppNumber, sourceSheet, sourceAgency)
// survive — Mongoose's default strict mode silently drops fields that
// aren't declared on the schema when writing through the model.
//
// Usage:  node seeders/importCuratedYnlOldLoans.js [path-to-xlsx]
// Runs from any working directory on any machine: the workbook defaults to
// YNL_Old_Loan_Report_by_Client.xlsx at the repo root and .env is read from
// there too, both resolved from this file rather than from cwd.
// Safe to re-run — already-imported loans are skipped.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import ExcelJS from "exceljs";
import Employee from "./models/Employee.js";
import EmployeeDesignation from "./models/EmployeeDesignation.js";
import Client from "./models/Client.js";
import LoanType from "./models/LoanType.js";
import LoanApplication from "./models/LoanApplication.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(ROOT, ".env") });

const XLSX_PATH =
    process.argv[2] || path.join(ROOT, "YNL_Old_Loan_Report_by_Client.xlsx");
const RED = "FFFF0000";
const SKIP_SHEETS = new Set(["Summary", "Sheet1"]);

// (agency, loan type text) -> LoanType name in the app
const TYPE_MAP = {
    "SSS|SALARY LOAN": "SSS Salary Loan",
    "SSS|CALAMITY LOAN": "SSS Calamity Loan",
    "PAG IBIG|SALARY LOAN": "Pag-IBIG MP Loan",
    "PAG IBIG|CALAMITY LOAN": "Pag-IBIG Calamity Loan",
};

const PLACEHOLDER_NUMS = new Set(["", "0", "00", "000", "0000"]);

const norm = (s) => (s || "").toString().trim().replace(/\s+/g, " ").toUpperCase();

function cellText(cell) {
    const v = cell?.value;
    if (v == null) return null;
    if (typeof v === "object" && "result" in v) return v.result; // formula cell
    return v;
}

function cellDate(cell) {
    const v = cellText(cell);
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

function cellNumber(cell) {
    const v = cellText(cell);
    if (v == null || v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
}

function cellString(cell) {
    const v = cellText(cell);
    return v == null ? null : String(v).trim();
}

function isRedRow(row) {
    let red = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
        const fill = cell.fill;
        if (
            fill &&
            fill.type === "pattern" &&
            fill.pattern === "solid" &&
            fill.fgColor &&
            fill.fgColor.argb === RED
        ) {
            red = true;
        }
    });
    return red;
}

async function run() {
    if (!process.env.MONGO_URL)
        throw new Error(
            `MONGO_URL is not set — expected it in ${path.join(ROOT, ".env")}`,
        );
    if (!fs.existsSync(XLSX_PATH))
        throw new Error(
            `Workbook not found: ${XLSX_PATH}\n` +
                `Put YNL_Old_Loan_Report_by_Client.xlsx in ${ROOT}, or pass its path as the first argument.`,
        );

    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(XLSX_PATH);
    console.log(`Loaded ${XLSX_PATH}`);

    // --- Reference maps ---------------------------------------------------
    const employees = await Employee.find(
        {},
        "firstName lastName employmentStatus",
    ).lean();
    const nameIndex = new Map(); // "LAST|FIRST" -> [employeeId, ...]
    const empStatus = new Map();
    for (const e of employees) {
        const key = `${norm(e.lastName)}|${norm(e.firstName)}`;
        if (!nameIndex.has(key)) nameIndex.set(key, []);
        nameIndex.get(key).push(String(e._id));
        empStatus.set(String(e._id), e.employmentStatus);
    }

    const designations = await EmployeeDesignation.find({}, "employee client").lean();
    const empDesignationClients = new Map(); // employeeId -> Set(clientId)
    for (const d of designations) {
        const key = String(d.employee);
        if (!empDesignationClients.has(key)) empDesignationClients.set(key, new Set());
        empDesignationClients.get(key).add(String(d.client));
    }

    const allClients = await Client.find({}, "clientName").lean();
    function clientOidForSheet(sheetName) {
        const found = allClients.find(
            (c) => c.clientName.startsWith(sheetName) || sheetName.startsWith(c.clientName),
        );
        return found ? String(found._id) : null;
    }

    const loanTypes = await LoanType.find({}, "loanTypeName").lean();
    const loanTypeOid = new Map(loanTypes.map((t) => [t.loanTypeName, String(t._id)]));

    const existingLoans = await LoanApplication.find(
        {},
        "employee loanType dateGranted loanAmount legacyAppNumber",
    ).lean();
    const existingKeys = new Set();
    const existingAppNums = new Set();
    for (const l of existingLoans) {
        existingKeys.add(
            `${l.employee}|${l.loanType}|${l.dateGranted ? l.dateGranted.toISOString() : ""}|${l.loanAmount}`,
        );
        if (l.legacyAppNumber) existingAppNums.add(l.legacyAppNumber);
    }

    // --- Walk the workbook --------------------------------------------------
    const ops = [];
    const flagged = [];
    let skippedDupe = 0;

    for (const worksheet of workbook.worksheets) {
        if (SKIP_SHEETS.has(worksheet.name)) continue;
        const sheetClientOid = clientOidForSheet(worksheet.name);

        for (let r = 5; r <= worksheet.rowCount; r++) {
            const row = worksheet.getRow(r);
            if (!isRedRow(row)) continue;

            const employeeName = cellString(row.getCell(1));
            const agency = (cellString(row.getCell(2)) || "").toUpperCase();
            const loanTypeText = (cellString(row.getCell(3)) || "").toUpperCase();
            const appNumberRaw = cellString(row.getCell(4));
            const checkNoRaw = cellString(row.getCell(5));
            const dateGranted = cellDate(row.getCell(6));
            const loanAmount = cellNumber(row.getCell(7));
            const remainingBalance = cellNumber(row.getCell(10));
            const computedStatus = cellString(row.getCell(11));
            const recordStatus = cellString(row.getCell(13)); // legacy flag, logged only
            const monthlyAmort = cellNumber(row.getCell(14));
            const firstMonthAmort = cellDate(row.getCell(15));
            const termFrom = cellDate(row.getCell(16));
            const termTo = cellDate(row.getCell(17));

            if (!employeeName) continue;

            const parts = employeeName.split(",").map((p) => p.trim());
            const lastRaw = parts[0] || "";
            const firstRaw = parts[1] || "";

            if (agency !== "SSS" && agency !== "PAG IBIG") {
                flagged.push([worksheet.name, r, employeeName, `agency column is ${JSON.stringify(agency)}, not SSS or PAG IBIG`]);
                continue;
            }

            const loanTypeName = TYPE_MAP[`${agency}|${loanTypeText}`];
            if (!loanTypeName) {
                flagged.push([worksheet.name, r, employeeName, `no mapping for (${agency}, ${loanTypeText})`]);
                continue;
            }
            const loanTypeId = loanTypeOid.get(loanTypeName);
            if (!loanTypeId) {
                flagged.push([worksheet.name, r, employeeName, `LoanType "${loanTypeName}" not found in DB`]);
                continue;
            }

            const candidates = nameIndex.get(`${norm(lastRaw)}|${norm(firstRaw)}`) || [];
            let empId = null;
            if (candidates.length === 1) {
                empId = candidates[0];
            } else if (candidates.length > 1) {
                const withClient = candidates.filter(
                    (c) => sheetClientOid && empDesignationClients.get(c)?.has(sheetClientOid),
                );
                if (withClient.length === 1) {
                    empId = withClient[0];
                } else {
                    const narrowed = withClient.length ? withClient : candidates;
                    const active = narrowed.filter((c) => empStatus.get(c) === "active");
                    if (active.length === 1) empId = active[0];
                }
            }
            if (!empId) {
                flagged.push([worksheet.name, r, employeeName, `employee match: ${candidates.length} candidates`]);
                continue;
            }

            const appNumber = appNumberRaw && !PLACEHOLDER_NUMS.has(appNumberRaw) ? appNumberRaw : null;
            const checkNumber = checkNoRaw && !PLACEHOLDER_NUMS.has(checkNoRaw) ? checkNoRaw : null;

            const dedupeKey = `${empId}|${loanTypeId}|${dateGranted ? dateGranted.toISOString() : ""}|${loanAmount}`;
            if (existingKeys.has(dedupeKey) || (appNumber && existingAppNums.has(appNumber))) {
                skippedDupe++;
                continue;
            }
            existingKeys.add(dedupeKey);

            const doc = {
                employee: new mongoose.Types.ObjectId(empId),
                loanType: new mongoose.Types.ObjectId(loanTypeId),
                legacyAppNumber: appNumber,
                checkNumber,
                dateGranted,
                loanAmount,
                loanPayable: remainingBalance || 0,
                loanTermFrom: termFrom,
                loanTermTo: termTo,
                monthlyAmortization: monthlyAmort || 0,
                firstMonthAmortization: firstMonthAmort,
                loanStatus: computedStatus || "on going",
                // Always active. `recordStatus` is the legacy system's own
                // deleted flag, and it is set on 1,123 of the workbook's 1,266
                // rows -- on settled and unsettled loans alike -- so it marks a
                // wholesale archive of the old loan table, not a decision about
                // any one loan. Honouring it imported 285 real loans invisible to
                // the loans page, which filters on isDeleted: "active".
                isDeleted: "active",
                sourceSheet: worksheet.name,
                sourceAgency: agency === "SSS" ? "SSS" : "Pag-IBIG",
            };

            ops.push({
                updateOne: {
                    filter: {
                        employee: doc.employee,
                        loanType: doc.loanType,
                        dateGranted: doc.dateGranted,
                        loanAmount: doc.loanAmount,
                    },
                    update: { $set: doc },
                    upsert: true,
                },
            });
        }
    }

    console.log(`Prepared ${ops.length} loans to import`);
    console.log(`Skipped as already-existing duplicates: ${skippedDupe}`);
    console.log(`Flagged (not imported, needs a fix in the spreadsheet): ${flagged.length}`);
    for (const f of flagged) console.log(" ", f);

    if (ops.length) {
        // Raw collection write — bypasses Mongoose strict-mode field
        // stripping so legacyAppNumber/sourceSheet/sourceAgency persist.
        const result = await LoanApplication.collection.bulkWrite(ops, { ordered: false });
        console.log(
            `\nLoanApplication: matched=${result.matchedCount} upserted=${result.upsertedCount}`,
        );
    }
}

try {
    await run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
