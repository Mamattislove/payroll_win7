import { runsPerMonth } from "./contributionFactor.js";

// PhilHealth premium arithmetic, shared by the server (payroll) and the client
// (the calculator on the Settings page) so the two can never disagree. Pure:
// it takes a rate row as the database holds it and does no lookups.

const r2 = (n) => Math.round(n * 100) / 100;

// When a rate row leaves a bound out. The floor and ceiling are part of the
// schedule, not optional extras; the model now requires both, but a row
// entered before it did may still lack one.
export const PHILHEALTH_DEFAULT_FLOOR = 10000;
export const PHILHEALTH_DEFAULT_CEILING = 100000;

/**
 * The monthly premium for a monthly basic salary.
 *
 *   1. The salary is held between the floor and ceiling (10,000 - 100,000).
 *   2. The premium is that times the rate (5%), held between the minimum and
 *      maximum premium (500 - 5,000).
 *   3. It is split by the employee share (0.5, an even split).
 *
 * Every figure comes from `rate`; a row saved before the minimum and maximum
 * premium were recorded falls back to what the salary bounds give at its rate.
 */
export function philhealthMonthly(rate, monthlySalary) {
    const {
        premiumRate,
        employeeShare,
        minimumSalaryThreshold,
        deductionCeiling,
        minimumPremium,
        maximumPremium,
    } = rate;

    const floor = minimumSalaryThreshold || PHILHEALTH_DEFAULT_FLOOR;
    const ceiling = deductionCeiling || PHILHEALTH_DEFAULT_CEILING;
    const base = Math.min(Math.max(monthlySalary, floor), ceiling);

    const minPremium = minimumPremium || floor * premiumRate;
    const maxPremium = maximumPremium || ceiling * premiumRate;
    const premium = Math.min(
        Math.max(base * premiumRate, minPremium),
        maxPremium,
    );

    return {
        base: r2(base),
        premium: r2(premium),
        employee: r2(premium * employeeShare),
        employer: r2(premium * (1 - employeeShare)),
        minimumPremium: minPremium,
        maximumPremium: maxPremium,
    };
}

/**
 * What one payroll run deducts for PhilHealth.
 *
 * The run's basic pay has already been multiplied up to a month by the pay
 * period (x1 monthly, x2 semi-monthly and daily, x4 weekly -- bracketWage),
 * and `monthly` is the share on that. Each run deducts that whole share, as
 * the office computes it: a semi-monthly cutoff of 6,122.72 is 12,245.44 a
 * month, 12,245.44 x 5% / 2 = 306.14, and 306.14 comes off that cutoff.
 *
 * `payrollPeriod` and `factor` are kept in the signature for the callers; the
 * share is not divided across the runs.
 */
// eslint-disable-next-line no-unused-vars
export function philhealthPerRun(monthly, payrollPeriod, factor) {
    return {
        employee: r2(monthly.employee),
        employer: r2(monthly.employer),
        runs: runsPerMonth(payrollPeriod),
    };
}
