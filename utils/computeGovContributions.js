import SSSRate from "../models/SSSRate.js";
import PhilHealthRate from "../models/PhilHealthRate.js";
import PagIbigRate from "../models/PagIbigRate.js";
import Payroll from "../models/Payroll.js";
import { SSS_CONTRIBUTION_BASIS } from "./constants.js";
import { contributionFactor, runsPerMonth } from "./contributionFactor.js";
import { philhealthMonthly, philhealthPerRun } from "./philhealthPremium.js";

const r2 = (n) => Math.round(n * 100) / 100;

// Service incentive leave is five days a year (Labor Code art. 95). Spread over
// twelve months that is the amount "basic pay w/ SIL" adds to the basic rate
// before the bracket is looked up. One constant, one place to correct it.
const SIL_DAYS_PER_YEAR = 5;
const MONTHS_PER_YEAR = 12;

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

async function getPhilHealthContributions(wage, year) {
    let rate = await PhilHealthRate.findOne({ year });
    if (!rate) rate = await PhilHealthRate.findOne().sort({ year: -1 });
    if (!rate) {
        console.warn(`[computeGovContributions] No PhilHealth rate found for year=${year}.`);
        return { employee: 0, employer: 0 };
    }
    // Floor, ceiling, rate, minimum and maximum premium and the split all come
    // from the year's row; the arithmetic is shared with the Settings page's
    // calculator (utils/philhealthPremium.js) so the two cannot drift.
    return philhealthMonthly(rate, wage);
}

/**
 * SSS, PhilHealth and Pag-IBIG for one payroll run, employee and employer.
 *
 * SSS is collected month-to-date, as the previous system did it:
 *
 *   first run of the month   the bracket for this run's pay alone
 *   later runs               the bracket for the month's pay so far, less
 *                            what the earlier runs already took
 *
 *   e.g. 7,343.16 then 7,266.67 -> 375 (MSC 7,500), then 725 (MSC 14,500) - 375
 *
 * PhilHealth and Pag-IBIG are priced per cutoff: this run's pay is scaled up to
 * a month (x1 monthly, x2 semi-monthly and daily, x4 weekly -- bracketWage) and
 * the monthly contribution is looked up on that. Pag-IBIG then deducts its
 * share of the month (half a semi-monthly month, a quarter of a weekly one --
 * contributionFactor). PhilHealth deducts the whole share on every run (see
 * philhealthPerRun): the salary held between the floor and ceiling, times the
 * rate, held between the minimum and maximum premium, split by the employee
 * share -- all from the rate table.
 *
 * `payrollId` is the run being priced when it already exists, so it is not
 * counted as one of its own earlier runs.
 */
export async function computeContributionsForRun(
    compensation,
    { payrollId = null, payrollFrom, periodBasic = 0, periodGross = 0 },
) {
    const from = new Date(payrollFrom);
    const year = from.getFullYear();
    const monthStart = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
    );
    const earlier = await Payroll.find({
        compensation: compensation._id,
        payrollFrom: { $gte: monthStart, $lt: from },
        ...(payrollId && { _id: { $ne: payrollId } }),
    })
        .select(
            "regularPay grossPay " +
                "sssContribution sssEmployerContribution " +
                "philhealthContribution philhealthEmployerContribution " +
                "pagibigContribution pagibigEmployerContribution",
        )
        .lean();

    const total = (key) => earlier.reduce((s, p) => s + (p[key] ?? 0), 0);

    // The month's pay so far on a given basis. Nothing is scaled: the runs are
    // added up rather than one of them multiplied out.
    const monthBasic = total("regularPay") + periodBasic;
    const monthGross = total("grossPay") + periodGross;
    const wageFor = (basis) => {
        let wage;
        switch (basis) {
            case SSS_CONTRIBUTION_BASIS.GROSS_PAY:
                wage = monthGross;
                break;
            case SSS_CONTRIBUTION_BASIS.BASIC_WITH_SIL:
                wage =
                    monthBasic +
                    ((compensation.dailyRate ?? 0) * SIL_DAYS_PER_YEAR) /
                        MONTHS_PER_YEAR;
                break;
            default:
                wage = monthBasic;
        }
        // Nothing earned at all: price on the standing rate rather than letting
        // a zero fall silently to the lowest bracket, as bracketWage does.
        return r2(wage > 0 ? wage : (compensation.monthlyRate ?? 0));
    };

    const factor = contributionFactor(compensation.payrollPeriod, payrollFrom);

    const forRun = async ({
        basisKey,
        overwriteKey,
        eeKey,
        erKey,
        lookup,
        monthToDate,
    }) => {
        const basis = compensation[basisKey] || SSS_CONTRIBUTION_BASIS.BASIC_PAY;
        if (basis === SSS_CONTRIBUTION_BASIS.NO_DEDUCTION)
            return { employee: 0, employer: 0 };

        // An overwrite keeps its meaning: a monthly figure, split across the
        // runs by the contribution factor.
        const overwrite = compensation[overwriteKey] ?? 0;
        if (overwrite > 0)
            return { employee: r2(overwrite * factor), employer: 0 };

        // Per cutoff: this run scaled to a month, and the run's share of it.
        if (!monthToDate) {
            const month = await lookup(
                bracketWage(basis, compensation, periodGross, periodBasic),
                year,
            );
            // PhilHealth's per-run split is shared with the Settings calculator
            // (see philhealthPerRun).
            if (month.minimumPremium != null) {
                const { employee, employer } = philhealthPerRun(
                    month,
                    compensation.payrollPeriod,
                    factor,
                );
                return { employee, employer };
            }
            return {
                employee: r2(month.employee * factor),
                employer: r2(month.employer * factor),
            };
        }

        const month = await lookup(wageFor(basis), year);
        const employee = Math.max(0, r2(month.employee - total(eeKey)));

        // The employer's part is its own month-to-date remainder when the
        // earlier runs recorded one. Payrolls imported from the old system
        // carry the employee share only, with the employer share at 0; a
        // remainder worked against those zeros put the whole month's employer
        // share on this run, so then it follows the employee's part in the
        // proportion the table gives instead (equal for PhilHealth, about 2:1
        // for SSS).
        const earlierRecordedEmployer = earlier.every(
            (p) => !((p[eeKey] ?? 0) > 0) || (p[erKey] ?? 0) > 0,
        );
        const employer = earlierRecordedEmployer
            ? Math.max(0, r2(month.employer - total(erKey)))
            : r2(
                  employee *
                      (month.employee > 0 ? month.employer / month.employee : 1),
              );
        return { employee, employer };
    };

    const [sss, philhealth, pagibig] = await Promise.all([
        forRun({
            basisKey: "sssContributionBasis",
            overwriteKey: "sssOverwriteAmount",
            eeKey: "sssContribution",
            erKey: "sssEmployerContribution",
            lookup: getSSSContributions,
            monthToDate: true,
        }),
        forRun({
            basisKey: "philhealthContributionBasis",
            overwriteKey: "philhealthOverwriteAmount",
            eeKey: "philhealthContribution",
            erKey: "philhealthEmployerContribution",
            lookup: getPhilHealthContributions,
            monthToDate: false,
        }),
        forRun({
            basisKey: "pagibigContributionBasis",
            overwriteKey: "pagibigOverwriteAmount",
            eeKey: "pagibigContribution",
            erKey: "pagibigEmployerContribution",
            lookup: getPagIbigContributions,
            monthToDate: false,
        }),
    ]);

    return {
        sssContribution: sss.employee,
        sssEmployerContribution: sss.employer,
        philhealthContribution: philhealth.employee,
        philhealthEmployerContribution: philhealth.employer,
        pagibigContribution: pagibig.employee,
        pagibigEmployerContribution: pagibig.employer,
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
