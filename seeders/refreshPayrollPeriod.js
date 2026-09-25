// Refreshes every payroll of one pay period, exactly as the Refresh Payroll
// button on the edit screen does it: attendance re-read at the current daily
// rate, SSS, PhilHealth and Pag-IBIG recomputed from the current compensation
// settings and rate tables, and the totals rebuilt. Contributions keyed in by
// hand are replaced; locked (paid) payrolls are left exactly as paid.
//
// Before anything is written, every payroll it will touch is saved in full to
// reports/refresh-backup-<from>-<to>-<timestamp>.json, so a run can be undone.
//
// Usage:
//   node seeders/refreshPayrollPeriod.js --from 2026-08-16 --to 2026-08-31
//   node seeders/refreshPayrollPeriod.js --from 2026-08-16 --to 2026-08-31 --apply
//   ... [--uri mongodb://127.0.0.1:27017/payroll]
// Without --apply it only reports what it would refresh. Without --uri it uses
// MONGO_URL from the repo's .env; the target is printed first.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Payroll from "../models/Payroll.js";
import { syncPayrollAttendance } from "../utils/syncPayrollAttendance.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : null;
};
const APPLY = process.argv.includes("--apply");
const FROM = arg("--from");
const TO = arg("--to");
const URI = arg("--uri") ?? process.env.MONGO_URL;

const sum = (rows, key) => rows.reduce((s, p) => s + (p[key] ?? 0), 0);
const peso = (n) =>
    n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TOTAL_KEYS = [
    "sssContribution",
    "sssEmployerContribution",
    "philhealthContribution",
    "philhealthEmployerContribution",
    "pagibigContribution",
    "pagibigEmployerContribution",
    "grossPay",
    "totalDeductions",
    "netSalary",
    "finalPay",
];

async function run() {
    if (!FROM || !TO)
        throw new Error("Pass the period: --from YYYY-MM-DD --to YYYY-MM-DD");
    if (!URI)
        throw new Error(
            `No database URI. Set MONGO_URL in ${path.join(ROOT, ".env")} or pass --uri`,
        );
    console.log(`target: ${URI.replace(/\/\/[^@]*@/, "//***@")}`);
    console.log(
        /localhost|127\.0\.0\.1/.test(URI)
            ? "        (local database)\n"
            : "        (NOT localhost — this is a remote database)\n",
    );
    console.log(APPLY ? "APPLYING\n" : "DRY RUN — nothing written\n");
    await mongoose.connect(URI);

    // Payrolls whose period starts on FROM (dates are stored at UTC midnight).
    const from = new Date(`${FROM}T00:00:00.000Z`);
    const to = new Date(`${TO}T23:59:59.999Z`);
    const all = await Payroll.find({
        payrollFrom: from,
        payrollTo: { $lte: to },
    }).lean();

    const locked = all.filter((p) => p.locked);
    const todo = all.filter((p) => !p.locked);
    const overridden = todo.filter((p) => p.contributionsOverridden);
    const noAttendance = todo.filter((p) => !(p.attendance ?? []).length);
    const perComp = new Map();
    for (const p of all)
        perComp.set(String(p.compensation), (perComp.get(String(p.compensation)) ?? 0) + 1);
    const duplicated = [...perComp.values()].filter((n) => n > 1).length;

    console.log(`period                          : ${FROM} to ${TO}`);
    console.log(`payrolls in the period          : ${all.length}`);
    console.log(`to refresh                      : ${todo.length}`);
    console.log(`skipped: locked (paid)          : ${locked.length}`);
    console.log(`hand-entered contributions      : ${overridden.length} (will be replaced)`);
    console.log(`without attendance (imported)   : ${noAttendance.length} (pay kept, contributions and totals recomputed)`);
    if (duplicated)
        console.log(`employees with 2+ payrolls here : ${duplicated} (each copy is refreshed on its own)`);

    if (!APPLY) {
        console.log("\nRe-run with --apply to refresh them.");
        return;
    }

    // Back up everything that is about to change.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join(ROOT, "reports");
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `refresh-backup-${FROM}-${TO}-${stamp}.json`);
    fs.writeFileSync(backup, JSON.stringify(todo, null, 2));
    console.log(`\nbackup written: ${path.relative(ROOT, backup)}`);

    let done = 0;
    const failed = [];
    for (const p of todo) {
        try {
            await Payroll.updateOne({ _id: p._id }, { contributionsOverridden: false });
            await syncPayrollAttendance(p._id);
            done++;
            if (done % 50 === 0) console.log(`  ${done} / ${todo.length}`);
        } catch (error) {
            failed.push({ id: String(p._id), error: error.message });
        }
    }

    const after = await Payroll.find({ _id: { $in: todo.map((p) => p._id) } }).lean();
    console.log(`\nrefreshed ${done} payroll(s)${failed.length ? `, ${failed.length} failed` : ""}`);
    for (const f of failed) console.log(`  failed ${f.id}: ${f.error}`);

    console.log("\ntotals for the refreshed payrolls   before -> after");
    for (const key of TOTAL_KEYS)
        console.log(
            `  ${key.padEnd(31)} ${peso(sum(todo, key)).padStart(14)} -> ${peso(sum(after, key)).padStart(14)}`,
        );
}

try {
    await run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
