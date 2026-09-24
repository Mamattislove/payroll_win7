// Seeds the three government contribution rate tables: SSS, PhilHealth and
// Pag-IBIG. Written to stand up a fresh database -- a local MongoDB on another
// machine, say -- with the same verified schedules the live one holds.
//
// Sources:
//   SSS        Circular 2024-006, Business Employers and Employees,
//              effective January 2025. 61 brackets.
//   PhilHealth The premium rate by year, 2019-2026.
//   Pag-IBIG   HDMF table for 2026.
//
// The SSS brackets are generated from the circular's rules rather than pasted
// in as 61 literal rows: the ladder is mechanical, and a formula that was
// checked against every published row is easier to audit -- and to correct
// for a future circular -- than a wall of numbers.
//
// Idempotent. Each table is keyed on what makes a row unique (SSS year+MSC,
// PhilHealth year, Pag-IBIG year) and upserted, so running it twice changes
// nothing the second time.
//
// Usage:
//   node seeders/seedContributionRates.js                    # dry run
//   node seeders/seedContributionRates.js --apply            # write
//   node seeders/seedContributionRates.js --apply --uri mongodb://127.0.0.1:27017/payroll
//
// Without --uri it uses MONGO_URL from the repo's .env. The target database is
// printed before anything is written, because the difference between a local
// mongod and the live cluster is one environment variable.

import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import SSSRate from "../models/SSSRate.js";
import PhilHealthRate from "../models/PhilHealthRate.js";
import PagIbigRate from "../models/PagIbigRate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const APPLY = process.argv.includes("--apply");
const uriArg = process.argv.indexOf("--uri");
const URI = uriArg > -1 ? process.argv[uriArg + 1] : process.env.MONGO_URL;

const r2 = (n) => Math.round(n * 100) / 100;

// ─── SSS ─────────────────────────────────────────────────────────────────────

const SSS_YEAR = 2026;
const SSS_MIN_MSC = 5000;
const SSS_MAX_MSC = 35000;
const SSS_STEP = 500;
const SSS_MPF_THRESHOLD = 20000; // above this the excess is MPF, not regular SS
const SSS_EC_THRESHOLD = 15000; // EC is 10 below this, 30 at or above
const SSS_EMPLOYEE_RATE = 0.05;
const SSS_EMPLOYER_RATE = 0.1;

/**
 * The 61 brackets of the contribution schedule.
 *
 * Row 1 covers everything below 5,250 at an MSC of 5,000. Each row after it
 * steps the MSC by 500 and the compensation range with it, until the last row
 * catches 34,750 and over at an MSC of 35,000. The first row has no lower
 * bound and the last no upper one, which is what lets any wage find a bracket.
 */
function sssBrackets() {
    const rows = [];
    const count = (SSS_MAX_MSC - SSS_MIN_MSC) / SSS_STEP + 1; // 61
    for (let i = 0; i < count; i++) {
        const msc = SSS_MIN_MSC + i * SSS_STEP;
        const regularSS = Math.min(msc, SSS_MPF_THRESHOLD);
        const mpf = Math.max(0, msc - SSS_MPF_THRESHOLD);
        const employerEC = msc >= SSS_EC_THRESHOLD ? 30 : 10;

        const employeeShare = r2(regularSS * SSS_EMPLOYEE_RATE);
        const employeeMPF = r2(mpf * SSS_EMPLOYEE_RATE);
        const employerShare = r2(regularSS * SSS_EMPLOYER_RATE);
        const employerMPF = r2(mpf * SSS_EMPLOYER_RATE);
        const totalEmployeeContribution = r2(employeeShare + employeeMPF);
        const totalEmployerContribution = r2(
            employerShare + employerMPF + employerEC,
        );

        rows.push({
            year: SSS_YEAR,
            compensationFrom: i === 0 ? null : 5250 + (i - 1) * SSS_STEP,
            compensationTo: i === count - 1 ? null : 5249 + i * SSS_STEP,
            msc,
            employeeShare,
            employeeMPF,
            employerShare,
            employerEC,
            employerMPF,
            totalEmployeeContribution,
            totalEmployerContribution,
            totalContribution: r2(
                totalEmployeeContribution + totalEmployerContribution,
            ),
        });
    }
    return rows;
}

// ─── PhilHealth ──────────────────────────────────────────────────────────────

// PhilHealth Circular 2019-0009. The premium climbed a half point a year to 5%
// and the salary ceiling ten thousand a year to 100,000; both have held there
// since 2024. The floor is 10,000 throughout.
// The minimum and maximum premium are the circular's "Monthly Premium" column,
// the total for employee and employer together.
const PHILHEALTH_RATES = [
    {
        year: 2019,
        premiumRate: 0.0275,
        deductionCeiling: 50000,
        minimumPremium: 275,
        maximumPremium: 1375,
    },
    {
        year: 2020,
        premiumRate: 0.03,
        deductionCeiling: 60000,
        minimumPremium: 300,
        maximumPremium: 1800,
    },
    {
        year: 2021,
        premiumRate: 0.035,
        deductionCeiling: 70000,
        minimumPremium: 350,
        maximumPremium: 2450,
    },
    {
        year: 2022,
        premiumRate: 0.04,
        deductionCeiling: 80000,
        minimumPremium: 400,
        maximumPremium: 3200,
    },
    {
        year: 2023,
        premiumRate: 0.045,
        deductionCeiling: 90000,
        minimumPremium: 450,
        maximumPremium: 4050,
    },
    {
        year: 2024,
        premiumRate: 0.05,
        deductionCeiling: 100000,
        minimumPremium: 500,
        maximumPremium: 5000,
    },
    {
        year: 2025,
        premiumRate: 0.05,
        deductionCeiling: 100000,
        minimumPremium: 500,
        maximumPremium: 5000,
    },
    {
        year: 2026,
        premiumRate: 0.05,
        deductionCeiling: 100000,
        minimumPremium: 500,
        maximumPremium: 5000,
    },
].map((r) => ({
    employeeShare: 0.5, // the premium is split evenly
    minimumSalaryThreshold: 10000,
    ...r,
}));

// ─── Pag-IBIG ────────────────────────────────────────────────────────────────

// HDMF 2026: up to 1,500 the employee pays 1% and the employer 2%; above it
// both pay 2%. Each side is capped at 200, which at 2% is reached at 10,000.
const PAGIBIG_RATES = [
    {
        year: 2026,
        incomeCeiling: 1500,
        basicEmployeeShare: 0.01,
        basicEmployerShare: 0.02,
        overThresholdEmployeeShare: 0.02,
        overThresholdEmployerShare: 0.02,
        percentageRateSalaryThreshold: 10000,
        flatRateMaxDeduction: 200,
        employerMaxContribution: 200,
    },
];

// ─── run ─────────────────────────────────────────────────────────────────────

async function seed(Model, rows, keyOf, label) {
    let written = 0;
    let unchanged = 0;
    for (const row of rows) {
        const key = keyOf(row);
        const existing = await Model.findOne(key).lean();
        const differs =
            !existing ||
            Object.entries(row).some(([k, v]) => {
                const a = existing[k] ?? null;
                const b = v ?? null;
                return typeof b === "number" || typeof a === "number"
                    ? Math.abs((a ?? 0) - (b ?? 0)) > 0.005
                    : a !== b;
            });
        if (!differs) {
            unchanged++;
            continue;
        }
        written++;
        if (APPLY) await Model.updateOne(key, { $set: row }, { upsert: true });
    }
    console.log(
        `${label.padEnd(11)} ${String(rows.length).padStart(3)} rows | ` +
            `${APPLY ? "written" : "would write"} ${String(written).padStart(3)} | already correct ${unchanged}`,
    );
}

async function run() {
    if (!URI)
        throw new Error(
            `No database URI. Set MONGO_URL in ${path.join(ROOT, ".env")} or pass --uri`,
        );

    const shown = URI.replace(/\/\/[^@]*@/, "//***@");
    console.log(APPLY ? "APPLYING\n" : "DRY RUN — nothing written\n");
    console.log(`target: ${shown}`);
    console.log(
        /localhost|127\.0\.0\.1/.test(URI)
            ? "        (local database)\n"
            : "        (NOT localhost — this is a remote database)\n",
    );

    await mongoose.connect(URI);

    await seed(
        SSSRate,
        sssBrackets(),
        (r) => ({ year: r.year, msc: r.msc }),
        "SSS",
    );
    await seed(
        PhilHealthRate,
        PHILHEALTH_RATES,
        (r) => ({ year: r.year }),
        "PhilHealth",
    );
    await seed(
        PagIbigRate,
        PAGIBIG_RATES,
        (r) => ({ year: r.year }),
        "Pag-IBIG",
    );

    if (!APPLY) console.log("\nRe-run with --apply to write.");
}

try {
    await run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}

// node seeders/alignContributionBases.js            # preview only, writes nothing
// node seeders/alignContributionBases.js --apply    # writes the changes
// node seeders/seedContributionRates.js --apply
