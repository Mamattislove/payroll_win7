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
 * Both figures describe this run and are scaled up to a month, because the
 * contribution tables are monthly:
 *
 *   periodBasic  regular pay for the period -- hours worked priced off the
 *                daily rate, with overtime, holiday, night differential,
 *                leave, earnings and allowances all excluded. This is the
 *                same number the payroll journal prints as BASIC PAY
 *                (`p.regularPay`), which is what "basic pay" means everywhere
 *                else people read it.
 *   periodGross  everything earned: basic plus overtime, holiday and rest day
 *                pay, night differential, leave pay, earnings and allowances
 *                -- derivePayrollTotals' grossPay.
 *
 * Either one falls back to the standing monthlyRate when it is not available,
 * which happens when contributions are worked out before a payroll exists.
 * Falling back to zero would silently drop the employee into the lowest
 * bracket, which is worse than being slightly stale.
 */
export function bracketWage(
    basis,
    compensation,
    periodGross,
    periodBasic = 0,
) {
    const { monthlyRate = 0, dailyRate = 0, payrollPeriod } = compensation;
    const monthly = (periodAmount) =>
        periodAmount > 0
            ? r2(periodAmount * runsPerMonth(payrollPeriod))
            : monthlyRate;

    switch (basis) {
        case SSS_CONTRIBUTION_BASIS.GROSS_PAY:
            return monthly(periodGross);

        case SSS_CONTRIBUTION_BASIS.BASIC_WITH_SIL:
            return r2(
                monthly(periodBasic) +
                    (dailyRate * SIL_DAYS_PER_YEAR) / MONTHS_PER_YEAR,
            );

        case SSS_CONTRIBUTION_BASIS.BASIC_PAY:
        default:
            return monthly(periodBasic);
    }
}

const bracketContains = (wage) => ({
    $and: [
        { $or: [{ compensationFrom: null }, { compensationFrom: { $lte: wage } }] },
        { $or: [{ compensationTo: null }, { compensationTo: { $gte: wage } }] },
    ],
});

/**
 * The bracket a wage falls in, for a given year.
 *
 * SSS is a lookup rather than a formula, so its equivalent of PhilHealth's
 * floor and ceiling is the first and last row of the table. A wage outside
 * every row is clamped to the nearest end instead of finding nothing: the
 * table for 2026 is open at both ends (its lowest row has no
 * compensationFrom, its highest no compensationTo) so this cannot bite today,
 * but a year entered with closed ends would otherwise deduct nothing at all
 * from anyone above the top row -- silently, since a missing bracket is not an
 * error anyone sees on a payslip.
 */
async function getSSSBracket(wage, year) {
    let bracket = await SSSRate.findOne({
        year,
        ...bracketContains(wage),
    }).sort({ msc: 1 });
    if (bracket) return bracket;

    // Nothing for this year: fall back to the most recent year that does cover
    // the wage, which is how a period priced before the table was updated still
    // gets a figure.
    bracket = await SSSRate.findOne(bracketContains(wage))
        .sort({ year: -1, msc: 1 })
        .limit(1);
    if (bracket) return bracket;

    // Outside every row. Clamp to the nearest end of the closest year's table.
    const [lowest, highest] = await Promise.all([
        SSSRate.findOne({ year }).sort({ msc: 1 }),
        SSSRate.findOne({ year }).sort({ msc: -1 }),
    ]);
    if (!lowest || !highest) return null;
    return wage < (lowest.compensationTo ?? Infinity) ? lowest : highest;
}

/**
 * SSS for one month.
 *
 * `wage` is already the right figure for this employee -- bracketWage picks the
 * period's basic pay or gross pay according to the compensation's
 * sssContributionBasis and scales it to a month. The wage only selects the
 * bracket; the amounts themselves are the flat figures stored on that row, not
 * a percentage of anything.
 */
async function getSSSContributions(wage, year) {
    const bracket = await getSSSBracket(wage, year);

    if (!bracket) {
        console.warn(`[computeGovContributions] No SSS bracket found for year=${year}, wage=${wage}.`);
        return { employee: 0, employer: 0 };
    }

    return {
        employee: r2(bracket.totalEmployeeContribution),
        employer: r2(bracket.totalEmployerContribution),
    };
}

// PhilHealth when the rate row leaves a bound out. The floor and ceiling are
// part of the schedule, not optional extras -- the rows for 2019-2025 carry no
// deductionCeiling, and without a fallback a high earner there is charged the
// premium on their whole salary with nothing stopping it.
const PHILHEALTH_DEFAULT_FLOOR = 10000;
const PHILHEALTH_DEFAULT_CEILING = 100000;

/**
 * PhilHealth for one month.
 *
 * `wage` is already the right figure for this employee: bracketWage picks the
 * period's basic pay or gross pay according to the compensation's
 * philhealthContributionBasis, and scales it to a month. This function only
 * clamps it and applies the premium.
 *
 * Rate, floor, ceiling and the employee's portion come from the year's rate row
 * rather than being fixed in code, because they have all moved -- the premium
 * ran 2.75% in 2019 and 5% from 2024 -- and a past period has to price on the
 * schedule that was in force at the time.
 */
async function getPhilHealthContributions(wage, year) {
    let rate = await PhilHealthRate.findOne({ year });
    if (!rate) rate = await PhilHealthRate.findOne().sort({ year: -1 });
    if (!rate) {
        console.warn(`[computeGovContributions] No PhilHealth rate found for year=${year}.`);
        return { employee: 0, employer: 0 };
    }

    const { premiumRate, employeeShare, minimumSalaryThreshold, deductionCeiling } = rate;

    // 1. Clamp the salary within the floor and ceiling.
    const floor = minimumSalaryThreshold || PHILHEALTH_DEFAULT_FLOOR;
    const ceiling = deductionCeiling || PHILHEALTH_DEFAULT_CEILING;
    let base = wage;
    if (base < floor) base = floor;
    else if (base > ceiling) base = ceiling;

    // 2. Total premium on the clamped salary, then split it. The split comes
    //    from the table (0.5 today, an even halving) rather than a hardcoded
    //    /2, so a year that shares it unevenly can be entered without a code
    //    change.
    const totalPremium = base * premiumRate;

    return {
        employee: r2(totalPremium * employeeShare),
        employer: r2(totalPremium * (1 - employeeShare)),
    };
}

// Pag-IBIG when the rate row leaves a bound out. As with PhilHealth these are
// part of the schedule, not optional: without the salary cap the percentage
// runs on the whole salary, and without the maximum the employee deduction is
// unbounded.
const PAGIBIG_DEFAULT_SALARY_CAP = 10000;
const PAGIBIG_DEFAULT_MAX_DEDUCTION = 200;

/**
 * Pag-IBIG for one month.
 *
 * `wage` is already the right figure for this employee -- bracketWage picks the
 * period's basic pay or gross pay according to the compensation's
 * pagibigContributionBasis and scales it to a month.
 *
 * The shape is: pick the pair of rates the wage qualifies for, apply them to
 * the capped salary, then cap the employee's own deduction.
 */
async function getPagIbigContributions(wage, year) {
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
        employerMaxContribution,
    } = rate;

    const salaryCap =
        percentageRateSalaryThreshold || PAGIBIG_DEFAULT_SALARY_CAP;
    const maxEmployee = flatRateMaxDeduction || PAGIBIG_DEFAULT_MAX_DEDUCTION;
    // The employer falls back to the employee maximum when it has none of its
    // own, which is what the schedule has always done -- both columns carry the
    // same figure.
    const maxEmployer = employerMaxContribution || maxEmployee;

    // 1. Which pair of rates applies, and on how much salary. Below the income
    //    ceiling the whole wage is used; above it the wage is capped first.
    const atOrBelow = wage <= incomeCeiling;
    const base = atOrBelow ? wage : Math.min(wage, salaryCap);
    const employeeRate = atOrBelow
        ? basicEmployeeShare
        : overThresholdEmployeeShare;
    const employerRate = atOrBelow
        ? basicEmployerShare
        : overThresholdEmployerShare;

    // 2. Apply, then cap each side at its own maximum. The HDMF table states
    //    the cap as a peso ceiling on the contribution rather than on the
    //    salary, and gives the employer a Max column of its own, so capping
    //    only the employee would follow the table for one party and not the
    //    other.
    const employeeContribution = Math.min(base * employeeRate, maxEmployee);
    const employerContribution = Math.min(base * employerRate, maxEmployer);

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
    { periodGross = 0, periodBasic = 0 } = {},
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
                    bracketWage(sssBasis, compensation, periodGross, periodBasic),
                    year,
                ),

        phBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : philhealthOverwriteAmount > 0
              ? { employee: r2(philhealthOverwriteAmount), employer: 0 }
              : getPhilHealthContributions(
                    bracketWage(phBasis, compensation, periodGross, periodBasic),
                    year,
                ),

        piBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : pagibigOverwriteAmount > 0
              ? { employee: r2(pagibigOverwriteAmount), employer: 0 }
              : getPagIbigContributions(
                    bracketWage(piBasis, compensation, periodGross, periodBasic),
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
