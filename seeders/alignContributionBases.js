// Aligns every compensation's government-contribution settings with the office
// payroll schedule:
//
//   SSS basis         gross pay for the clients the schedule marks "SSS GROSS
//                     PAY" (Yaman ng Lahi, JGH Driver, Manila Cordage tolling
//                     and non-tolling), basic pay for everyone else
//   PhilHealth basis  basic pay for everyone
//   Pag-IBIG basis    basic pay for everyone
//   Overwrites        SSS, PhilHealth and Pag-IBIG overwrite amounts set to 0
//
// Clients are matched by name, not id, so the same script works on any server
// whatever ids its records were given. A client the schedule does not mention
// falls to basic pay, which is what the schedule uses for all but the four
// gross-pay clients; the report lists them so that can be checked.
//
// Usage:  node seeders/alignContributionBases.js [--apply] [--keep-no-deduction]
//                [--uri mongodb://127.0.0.1:27017/payroll]
// Without --uri it uses MONGO_URL from the repo's .env; the target is printed
// before anything is read or written.
//
//   --apply              write the changes; without it this only reports
//   --keep-no-deduction  leave a compensation whose SSS or Pag-IBIG basis is
//                        "no deduction" on that basis instead of switching it,
//                        for employees who are exempt on purpose
//
// Payrolls already generated keep their stored contributions; only payrolls
// generated (or recomputed) after this runs use the new settings.

import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Compensation from "../models/Compensation.js";
import EmployeeDesignation from "../models/EmployeeDesignation.js";
import Client from "../models/Client.js";
import { SSS_CONTRIBUTION_BASIS } from "../utils/constants.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const APPLY = process.argv.includes("--apply");
const uriArg = process.argv.indexOf("--uri");
const URI = uriArg > -1 ? process.argv[uriArg + 1] : process.env.MONGO_URL;
const KEEP_NO_DEDUCTION = process.argv.includes("--keep-no-deduction");

const { BASIC_PAY, GROSS_PAY, NO_DEDUCTION } = SSS_CONTRIBUTION_BASIS;

// The "SSS GROSS PAY" rows of the schedule, as their clients are named here.
// Manila Cordage is held as two clients, MANCO TOLLING and MANCO NON-TOLLING.
const GROSS_PAY_CLIENTS = [
    /^YAMAN NG LAHI/i,
    /^JGH DRIVER$/i,
    /^MANCO (NON-)?TOLLING$/i,
];

// Every client the schedule names on a basic-pay row. Only used to tell a
// client the schedule covers apart from one it does not, for the report.
const BASIC_PAY_CLIENTS = [
    /^MCH LAW OFFICE/i,
    /^SILAHIS BANK/i,
    /^ST\. MARTIN/i,
    /^AGRO FILIPINO/i,
    /^CHOOKS TO GO/i, // CTGI Stag, Bulacan, Nebal, Pampanga, Camanava, skilled weekly
    /^TAGAYTAY POULTRY/i, // TAPBI
    /^UBLC$/i,
    /^ALLIED BLCQ/i, // ABCLQ
    /^CHOOKS DINE-IN/i,
];

const sssBasisFor = (clientName) =>
    GROSS_PAY_CLIENTS.some((re) => re.test(clientName ?? ""))
        ? GROSS_PAY
        : BASIC_PAY;

const onSchedule = (clientName) =>
    [...GROSS_PAY_CLIENTS, ...BASIC_PAY_CLIENTS].some((re) =>
        re.test(clientName ?? ""),
    );

async function run() {
    if (!URI)
        throw new Error(
            `No database URI. Set MONGO_URL in ${path.join(ROOT, ".env")} or pass --uri`,
        );
    const shown = URI.replace(/\/\/[^@]*@/, "//***@");
    console.log(`target: ${shown}`);
    console.log(
        /localhost|127\.0\.0\.1/.test(URI)
            ? "        (local database)\n"
            : "        (NOT localhost — this is a remote database)\n",
    );
    await mongoose.connect(URI);
    console.log(APPLY ? "APPLYING changes\n" : "DRY RUN — nothing written\n");

    const [compensations, designations, clients] = await Promise.all([
        Compensation.find()
            .select(
                "employeeDesignation sssContributionBasis philhealthContributionBasis " +
                    "pagibigContributionBasis sssOverwriteAmount " +
                    "philhealthOverwriteAmount pagibigOverwriteAmount",
            )
            .lean(),
        EmployeeDesignation.find().select("client").lean(),
        Client.find().select("clientName").lean(),
    ]);

    const clientName = new Map(
        clients.map((c) => [String(c._id), c.clientName]),
    );
    const clientOf = new Map(
        designations.map((d) => [
            String(d._id),
            clientName.get(String(d.client)),
        ]),
    );

    const tally = {
        [GROSS_PAY]: new Map(),
        [BASIC_PAY]: new Map(),
    };
    const offSchedule = new Map();
    const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

    let noClient = 0;
    let sssFromNoDeduction = 0;
    let pagibigFromNoDeduction = 0;
    let overwritesCleared = 0;
    const ops = [];

    for (const c of compensations) {
        const name = clientOf.get(String(c.employeeDesignation));
        if (!name) noClient++;

        const set = {
            philhealthContributionBasis: BASIC_PAY,
            pagibigContributionBasis: BASIC_PAY,
            sssOverwriteAmount: 0,
            philhealthOverwriteAmount: 0,
            pagibigOverwriteAmount: 0,
        };

        let sssBasis = sssBasisFor(name);
        if (c.sssContributionBasis === NO_DEDUCTION) {
            if (KEEP_NO_DEDUCTION) sssBasis = NO_DEDUCTION;
            else sssFromNoDeduction++;
        }
        set.sssContributionBasis = sssBasis;

        if (c.pagibigContributionBasis === NO_DEDUCTION) {
            if (KEEP_NO_DEDUCTION) set.pagibigContributionBasis = NO_DEDUCTION;
            else pagibigFromNoDeduction++;
        }

        if (
            (c.sssOverwriteAmount ?? 0) !== 0 ||
            (c.philhealthOverwriteAmount ?? 0) !== 0 ||
            (c.pagibigOverwriteAmount ?? 0) !== 0
        )
            overwritesCleared++;

        if (sssBasis !== NO_DEDUCTION)
            count(tally[sssBasis], name ?? "(no client)");
        if (name && !onSchedule(name)) count(offSchedule, name);

        const changed = Object.entries(set).some(([k, v]) => (c[k] ?? 0) !== v);
        if (changed)
            ops.push({
                updateOne: { filter: { _id: c._id }, update: { $set: set } },
            });
    }

    const list = (map) =>
        [...map.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([n, k]) =>
                console.log(`    ${String(k).padStart(5)}  ${n}`),
            );

    console.log("SSS gross pay:");
    list(tally[GROSS_PAY]);
    console.log("\nSSS basic pay:");
    list(tally[BASIC_PAY]);

    if (offSchedule.size) {
        console.log("\nNot on the payroll schedule, set to SSS basic pay:");
        list(offSchedule);
    }

    console.log("");
    console.log(`compensations examined          : ${compensations.length}`);
    console.log(`compensations to update         : ${ops.length}`);
    console.log(`overwrite amounts reset to 0    : ${overwritesCleared}`);
    console.log(
        KEEP_NO_DEDUCTION
            ? `"no deduction" bases            : kept (--keep-no-deduction)`
            : `SSS "no deduction" -> deducted  : ${sssFromNoDeduction}\n` +
                  `Pag-IBIG "no deduction" -> deducted: ${pagibigFromNoDeduction}`,
    );
    if (noClient) console.log(`without a client (basic pay)    : ${noClient}`);

    if (APPLY && ops.length) {
        const res = await Compensation.bulkWrite(ops, { ordered: false });
        console.log(`\nmodified ${res.modifiedCount} compensation(s)`);
    } else if (!APPLY) {
        console.log("\nRe-run with --apply to write these changes.");
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

// node seeders/seedContributionRates.js --uri mongodb://127.0.0.1:27017/payroll
// node seeders/seedContributionRates.js --uri mongodb://127.0.0.1:27017/payroll --apply

// node seeders/alignContributionBases.js --uri mongodb://127.0.0.1:27017/payroll
// node seeders/alignContributionBases.js --uri mongodb://127.0.0.1:27017/payroll --apply

// node seeders/equalizePhilHealthEmployerShare.js --uri mongodb://127.0.0.1:27017/payroll
// node seeders/equalizePhilHealthEmployerShare.js --uri mongodb://127.0.0.1:27017/payroll --apply
