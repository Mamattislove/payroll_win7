// Makes the PhilHealth employer share equal the employee share on every
// payroll where the two differ.
//
// PhilHealth splits the premium evenly -- employeeShare is 0.5 for every year
// in the rate table -- so on any one payroll the employer's part equals the
// employee's. Payrolls imported from the old system were brought over with the
// employee share only and an employer share of 0, and a second cutoff computed
// against those zeros put the whole month's employer share on itself (e.g.
// EE 73.69 / ER 323.69 where both should be 73.69).
//
// Only philhealthEmployerContribution is written. It feeds no payroll total --
// gross, deductions, net and final pay are all employee-side -- so no one's pay
// changes; what changes is the employer share shown on the payroll and in the
// government contributions report.
//
// Skipped, and counted in the report:
//   locked payrolls           paid, kept exactly as paid
//   contributionsOverridden   contributions keyed in by hand on the edit screen
//   a year whose rate is not an even split, if one is ever entered
//
// Usage:  node seeders/equalizePhilHealthEmployerShare.js [--apply]
// Without --apply it only reports what it would change.

import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Payroll from "../models/Payroll.js";
import PhilHealthRate from "../models/PhilHealthRate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const APPLY = process.argv.includes("--apply");

const unequal = {
    $expr: {
        $gt: [
            {
                $abs: {
                    $subtract: [
                        { $ifNull: ["$philhealthContribution", 0] },
                        { $ifNull: ["$philhealthEmployerContribution", 0] },
                    ],
                },
            },
            0.009,
        ],
    },
};

async function run() {
    if (!process.env.MONGO_URL)
        throw new Error(
            `MONGO_URL is not set — expected it in ${path.join(ROOT, ".env")}`,
        );
    await mongoose.connect(process.env.MONGO_URL);
    console.log(APPLY ? "APPLYING changes\n" : "DRY RUN — nothing written\n");

    // Years whose premium is split evenly. A payroll in any other year is left
    // alone rather than forced to 50/50.
    const rates = await PhilHealthRate.find().select("year employeeShare").lean();
    const evenYears = new Set(
        rates.filter((r) => Math.abs(r.employeeShare - 0.5) < 1e-9).map((r) => r.year),
    );
    const latestYear = Math.max(...rates.map((r) => r.year));
    // A payroll after the last year on file is priced on that last year.
    const isEven = (year) =>
        evenYears.has(year) || (year > latestYear && evenYears.has(latestYear));

    const rows = await Payroll.find(unequal)
        .select(
            "payrollFrom philhealthContribution philhealthEmployerContribution locked contributionsOverridden",
        )
        .lean();

    let locked = 0;
    let overridden = 0;
    let uneven = 0;
    let erWasZero = 0;
    let employerDelta = 0;
    const byMonth = new Map();
    const ops = [];

    for (const p of rows) {
        if (p.locked) {
            locked++;
            continue;
        }
        if (p.contributionsOverridden) {
            overridden++;
            continue;
        }
        const year = new Date(p.payrollFrom).getUTCFullYear();
        if (!isEven(year)) {
            uneven++;
            continue;
        }

        const ee = p.philhealthContribution ?? 0;
        const er = p.philhealthEmployerContribution ?? 0;
        if (er === 0) erWasZero++;
        employerDelta += ee - er;
        const month = new Date(p.payrollFrom).toISOString().slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + 1);

        ops.push({
            updateOne: {
                filter: { _id: p._id },
                update: { $set: { philhealthEmployerContribution: ee } },
            },
        });
    }

    console.log("Payrolls to correct, by pay-period month:");
    [...byMonth.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([m, n]) => console.log(`    ${m}  ${String(n).padStart(5)}`));

    console.log("");
    console.log(`payrolls with unequal shares        : ${rows.length}`);
    console.log(`to correct (ER set equal to EE)     : ${ops.length}`);
    console.log(`  of which ER was 0 (imported)      : ${erWasZero}`);
    console.log(`skipped: locked (paid)              : ${locked}`);
    console.log(`skipped: contributions set by hand  : ${overridden}`);
    if (uneven) console.log(`skipped: year not split 50/50       : ${uneven}`);
    console.log(
        `employer share, net change          : PHP ${employerDelta.toFixed(2)}`,
    );

    if (APPLY && ops.length) {
        const res = await Payroll.bulkWrite(ops, { ordered: false });
        console.log(`\nmodified ${res.modifiedCount} payroll(s)`);
    } else if (!APPLY) {
        console.log("\nRe-run with --apply to write these changes.");
    }
    console.log(
        "\nEmployee deductions and net pay are not touched: only the PhilHealth" +
            "\nemployer share is written.",
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
