import SSSRate from "../models/SSSRate.js";
import PhilHealthRate from "../models/PhilHealthRate.js";
import PagIbigRate from "../models/PagIbigRate.js";
import {
    SSS_CONTRIBUTION_BASIS,
    PAYROLL_PERIODS,
} from "./constants.js";

const r2 = (n) => Math.round(n * 100) / 100;

// Service incentive leave is five days a year (Labor Code art. 95). Spread over
// twelve months that is the amount "basic pay w/ SIL" adds to the basic rate
// before the bracket is looked up. One constant, one place to correct it.
const SIL_DAYS_PER_YEAR = 5;
const MONTHS_PER_YEAR = 12;

// How many payroll runs make up a month, used to turn one period's earnings
// back into the monthly figure the SSS/PhilHealth/Pag-IBIG tables are indexed
// by. It is the inverse of contributionFactor: that splits a monthly obligation
// across runs, this reassembles a monthly wage out of them, and the two must
// multiply to 1 for every period -- including the unset case, where
// contributionFactor deducts the whole monthly amount in one run and so this
// must treat the run as the whole month rather than doubling it.
const runsPerMonth = (payrollPeriod) => {
    switch (payrollPeriod) {
        case PAYROLL_PERIODS.WEEKLY:
            return 4;
        case PAYROLL_PERIODS.SEMI_MONTHLY:
        case PAYROLL_PERIODS.DAILY:
            return 2;
        case PAYROLL_PERIODS.MONTHLY:
        default:
            return 1;
    }
};

/**
 * The monthly wage the contribution table is indexed by, for one basis.
 *
 * `periodGross` is what the employee actually earned this run -- attendance pay
 * plus earnings and allowances, the same figure derivePayrollTotals calls
 * grossPay. It is scaled up to a month because the tables are monthly, and it
 * is only consulted for the "gross pay" basis; the others read the standing
 * monthly rate and so do not move with overtime.
 */
export function bracketWage(basis, compensation, periodGross) {
    const { monthlyRate = 0, dailyRate = 0, payrollPeriod } = compensation;

    switch (basis) {
        case SSS_CONTRIBUTION_BASIS.GROSS_PAY:
            // No gross to read (a payroll being created before its records are
            // attached) falls back to the basic rate rather than to zero, which
            // would silently put the employee in the lowest bracket.
            return periodGross > 0
                ? r2(periodGross * runsPerMonth(payrollPeriod))
                : monthlyRate;

        case SSS_CONTRIBUTION_BASIS.BASIC_WITH_SIL:
            return r2(
                monthlyRate +
                    (dailyRate * SIL_DAYS_PER_YEAR) / MONTHS_PER_YEAR,
            );

        case SSS_CONTRIBUTION_BASIS.BASIC_PAY:
        default:
            return monthlyRate;
    }
}

async function getSSSBracket(monthlyRate, year) {
    let bracket = await SSSRate.findOne({
        year,
        $and: [
            { $or: [{ compensationFrom: null }, { compensationFrom: { $lte: monthlyRate } }] },
            { $or: [{ compensationTo: null }, { compensationTo: { $gte: monthlyRate } }] },
        ],
    }).sort({ msc: 1 });

    if (!bracket) {
        bracket = await SSSRate.findOne({
            $and: [
                { $or: [{ compensationFrom: null }, { compensationFrom: { $lte: monthlyRate } }] },
                { $or: [{ compensationTo: null }, { compensationTo: { $gte: monthlyRate } }] },
            ],
        })
            .sort({ year: -1, msc: 1 })
            .limit(1);
    }

    return bracket;
}

async function getSSSContributions(monthlyRate, year) {
    const bracket = await getSSSBracket(monthlyRate, year);

    if (!bracket) {
        console.warn(`[computeGovContributions] No SSS bracket found for year=${year}, monthlyRate=${monthlyRate}.`);
        return { employee: 0, employer: 0 };
    }

    return {
        employee: r2(bracket.totalEmployeeContribution),
        employer: r2(bracket.totalEmployerContribution),
    };
}

async function getPhilHealthContributions(monthlyRate, year) {
    let rate = await PhilHealthRate.findOne({ year });
    if (!rate) rate = await PhilHealthRate.findOne().sort({ year: -1 });
    if (!rate) {
        console.warn(`[computeGovContributions] No PhilHealth rate found for year=${year}.`);
        return { employee: 0, employer: 0 };
    }

    const { premiumRate, employeeShare, minimumSalaryThreshold, deductionCeiling } = rate;

    let salary = monthlyRate;
    if (minimumSalaryThreshold && salary < minimumSalaryThreshold) salary = minimumSalaryThreshold;
    if (deductionCeiling && salary > deductionCeiling) salary = deductionCeiling;

    return {
        employee: r2(salary * premiumRate * employeeShare),
        employer: r2(salary * premiumRate * (1 - employeeShare)),
    };
}

async function getPagIbigContributions(monthlyRate, year) {
    let rate = await PagIbigRate.findOne({ year });
    if (!rate) rate = await PagIbigRate.findOne().sort({ year: -1 });
    if (!rate) {
        console.warn(`[computeGovContributions] No Pag-IBIG rate found for year=${year}.`);
        return { employee: 0, employer: 0 };
    }

    const {
        incomeCeiling,
        basicEmployeeShare,
        basicEmployerShare,
        overThresholdEmployeeShare,
        overThresholdEmployerShare,
        percentageRateSalaryThreshold,
        flatRateMaxDeduction,
    } = rate;

    let employeeContribution;
    let employerContribution;

    if (monthlyRate <= incomeCeiling) {
        employeeContribution = monthlyRate * basicEmployeeShare;
        employerContribution = monthlyRate * basicEmployerShare;
    } else {
        const base = percentageRateSalaryThreshold
            ? Math.min(monthlyRate, percentageRateSalaryThreshold)
            : monthlyRate;
        employeeContribution = base * overThresholdEmployeeShare;
        employerContribution = base * overThresholdEmployerShare;
    }

    if (flatRateMaxDeduction && employeeContribution > flatRateMaxDeduction) {
        employeeContribution = flatRateMaxDeduction;
    }

    return {
        employee: r2(employeeContribution),
        employer: r2(employerContribution),
    };
}

/**
 * Computes SSS, PhilHealth, and Pag-IBIG contributions for both employee and employer.
 *
 * @param {object} compensation - Mongoose Compensation document
 * @param {number} year - Payroll year (from payrollFrom date)
 * @returns {{ sssContribution, philhealthContribution, pagibigContribution,
 *             sssEmployerContribution, philhealthEmployerContribution, pagibigEmployerContribution }}
 */
export async function computeGovContributions(
    compensation,
    year,
    { periodGross = 0 } = {},
) {
    const {
        sssContributionBasis,
        philhealthContributionBasis,
        pagibigContributionBasis,
        sssOverwriteAmount = 0,
        philhealthOverwriteAmount = 0,
        pagibigOverwriteAmount = 0,
    } = compensation;

    // An unset basis reads as basic pay, which is the figure this file computed
    // for every employee before the basis was honoured at all.
    const sssBasis = sssContributionBasis || SSS_CONTRIBUTION_BASIS.BASIC_PAY;
    const phBasis =
        philhealthContributionBasis || SSS_CONTRIBUTION_BASIS.BASIC_PAY;
    const piBasis =
        pagibigContributionBasis || SSS_CONTRIBUTION_BASIS.BASIC_PAY;

    const [sss, ph, pi] = await Promise.all([
        sssBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : sssOverwriteAmount > 0
              ? { employee: r2(sssOverwriteAmount), employer: 0 }
              : getSSSContributions(
                    bracketWage(sssBasis, compensation, periodGross),
                    year,
                ),

        phBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : philhealthOverwriteAmount > 0
              ? { employee: r2(philhealthOverwriteAmount), employer: 0 }
              : getPhilHealthContributions(
                    bracketWage(phBasis, compensation, periodGross),
                    year,
                ),

        piBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : pagibigOverwriteAmount > 0
              ? { employee: r2(pagibigOverwriteAmount), employer: 0 }
              : getPagIbigContributions(
                    bracketWage(piBasis, compensation, periodGross),
                    year,
                ),
    ]);

    return {
        sssContribution:              sss.employee,
        philhealthContribution:       ph.employee,
        pagibigContribution:          pi.employee,
        sssEmployerContribution:      sss.employer,
        philhealthEmployerContribution: ph.employer,
        pagibigEmployerContribution:  pi.employer,
    };
}
