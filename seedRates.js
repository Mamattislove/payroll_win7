import * as dotenv from "dotenv";
import mongoose from "mongoose";
import SSSRate from "./models/SSSRate.js";
import PhilHealthRate from "./models/PhilHealthRate.js";
import PagIbigRate from "./models/PagIbigRate.js";

dotenv.config();

const YEAR = 2026;

// ── Helpers ──────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round(n * 100) / 100;

// ── PhilHealth 2026 ──────────────────────────────────────────────────────────
// Source: PhilHealth Circular 2024-0005 — 5% premium rate effective 2024-2026
const philhealthRecord = {
    year: YEAR,
    premiumRate: 0.05,       // 5% total premium
    employeeShare: 0.5,      // 50% of premium = 2.5% of salary
    minimumSalaryThreshold: 10000,  // ₱10,000 minimum salary basis
    deductionCeiling: 100000,       // ₱100,000 maximum salary basis
};

// ── Pag-IBIG 2026 ────────────────────────────────────────────────────────────
// Source: RA 9679 / HDMF Circular — unchanged rates, ₱100 max EE deduction
const pagibigRecord = {
    year: YEAR,
    incomeCeiling: 1500,             // 1% rate applies up to ₱1,500 monthly salary
    basicEmployeeShare: 0.01,        // 1% for salary ≤ ₱1,500
    basicEmployerShare: 0.02,        // 2% for salary ≤ ₱1,500
    overThresholdEmployeeShare: 0.02, // 2% for salary > ₱1,500
    overThresholdEmployerShare: 0.02, // 2% for salary > ₱1,500
    percentageRateSalaryThreshold: 5000, // salary capped at ₱5,000 for % computation
    flatRateMaxDeduction: 100,       // ₱100 maximum employee deduction
};

// ── SSS 2026 Brackets ────────────────────────────────────────────────────────
// Source: SSS Circular 2024-003 / RA 11199 schedule
// Rates: EE SS = 5%, ER SS = 9.5% (capped at MSC ₱20,000), MPF kicks in above ₱20,000
// EC: ₱10 for MSC < ₱15,000 | ₱30 for MSC ≥ ₱15,000
// MPF EE = 5% × (MSC − ₱20,000), MPF ER = 10% × (MSC − ₱20,000)
const SS_EE_RATE = 0.05;
const SS_ER_RATE = 0.095;
const SS_MPF_EE_RATE = 0.05;
const SS_MPF_ER_RATE = 0.10;
const SS_MSC_CAP = 20000;    // SS rates apply up to this MSC
const EC_LOW = 10;            // EC for MSC < ₱15,000
const EC_HIGH = 30;           // EC for MSC ≥ ₱15,000
const EC_THRESHOLD = 15000;
const MSC_START = 5000;
const MSC_END = 35000;
const MSC_STEP = 500;

function buildSSSBrackets() {
    const brackets = [];
    let idx = 0;
    for (let msc = MSC_START; msc <= MSC_END; msc += MSC_STEP) {
        const isFirst = msc === MSC_START;
        const isLast = msc === MSC_END;

        const compensationFrom = isFirst ? null : msc - 250;
        const compensationTo = isLast ? null : msc + 249;

        // SS portion (capped at MSC_CAP for ER, full MSC for EE)
        const ssMscForER = Math.min(msc, SS_MSC_CAP);
        const employeeShare = r2(SS_MSC_CAP > 0 && msc <= SS_MSC_CAP
            ? msc * SS_EE_RATE
            : SS_MSC_CAP * SS_EE_RATE);

        // MPF (only above ₱20,000)
        const mpfBasis = Math.max(0, msc - SS_MSC_CAP);
        const employeeMPF = r2(mpfBasis * SS_MPF_EE_RATE);
        const employerMPF = r2(mpfBasis * SS_MPF_ER_RATE);

        const employerShare = r2(ssMscForER * SS_ER_RATE);
        const employerEC = msc < EC_THRESHOLD ? EC_LOW : EC_HIGH;

        const totalEmployeeContribution = r2(employeeShare + employeeMPF);
        const totalEmployerContribution = r2(employerShare + employerEC + employerMPF);
        const totalContribution = r2(totalEmployeeContribution + totalEmployerContribution);

        brackets.push({
            year: YEAR,
            compensationFrom,
            compensationTo,
            msc,
            employeeShare,
            employeeMPF,
            employerShare,
            employerEC,
            employerMPF,
            totalEmployeeContribution,
            totalEmployerContribution,
            totalContribution,
        });
        idx++;
    }
    return brackets;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB.");

    // --- PhilHealth ---
    const existingPH = await PhilHealthRate.findOne({ year: YEAR });
    if (existingPH) {
        console.log(`PhilHealth ${YEAR} already exists — skipping.`);
    } else {
        await PhilHealthRate.create(philhealthRecord);
        console.log(`PhilHealth ${YEAR} inserted.`);
    }

    // --- Pag-IBIG ---
    const existingPI = await PagIbigRate.findOne({ year: YEAR });
    if (existingPI) {
        console.log(`Pag-IBIG ${YEAR} already exists — skipping.`);
    } else {
        await PagIbigRate.create(pagibigRecord);
        console.log(`Pag-IBIG ${YEAR} inserted.`);
    }

    // --- SSS brackets ---
    const existingSSS = await SSSRate.findOne({ year: YEAR });
    if (existingSSS) {
        console.log(`SSS ${YEAR} brackets already exist — skipping.`);
    } else {
        const brackets = buildSSSBrackets();
        await SSSRate.insertMany(brackets);
        console.log(`SSS ${YEAR}: ${brackets.length} brackets inserted.`);
    }

    await mongoose.disconnect();
    console.log("Done.");
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
