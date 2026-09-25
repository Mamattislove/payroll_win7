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
 *   2. The premium is that times the rate (5%) -- which the salary bounds
 *      already keep between 500 and 5,000.
 *   3. It is split by the employee share (0.5, an even split).
 *
 * Every figure comes from `rate`.
 */
export function philhealthMonthly(rate, monthlySalary) {
    const {
        premiumRate,
        employeeShare,
        minimumSalaryThreshold,
        deductionCeiling,
    } = rate;

    const floor = minimumSalaryThreshold || PHILHEALTH_DEFAULT_FLOOR;
    const ceiling = deductionCeiling || PHILHEALTH_DEFAULT_CEILING;
    const base = Math.min(Math.max(monthlySalary, floor), ceiling);

    const premium = base * premiumRate;

    return {
        base: r2(base),
        premium: r2(premium),
        // Unrounded, so a run's share is cut from the exact figure.
        rawPremium: premium,
        employeeShare,
        // The premium at the salary floor (10,000 x 5% = 500), which HR's
        // per-run minimum is half of.
        floorPremium: floor * premiumRate,
        employee: r2(premium * employeeShare),
        employer: r2(premium * (1 - employeeShare)),
    };
}

/**
 * What one payroll run deducts for PhilHealth -- the office's
 * ComputePhilhealthContri:
 *
 *   floor and ceiling divided by the runs in a month
 *     (semi-monthly and daily / 2, weekly / 4, monthly / 1)
 *   the run's basic pay held between them, times the rate (5%)
 *   that premium is split by the employee share (half each at 0.5)
 *
 * HR's rule then holds each share to a minimum: half the premium at the
 * salary floor (10,000 x 5% / 2 = 250) per monthly, semi-monthly or daily
 * run, and half that (125) per weekly run.
 *
 * e.g. a semi-monthly cutoff of 6,122.72: floor 5,000, ceiling 50,000,
 * 6,122.72 x 5% = 306.14, half is 153.07, lifted to the 250 minimum -- so 250
 * from the employee and 250 from the employer.
 *
 * `monthly` is philhealthMonthly on the run's pay multiplied up to a month
 * (bracketWage), so its premium over the runs is the same figure: holding
 * pay x n between the floor and ceiling and dividing by n is holding pay
 * between floor / n and ceiling / n.
 */
export function philhealthPerRun(monthly, payrollPeriod) {
    const runs = runsPerMonth(payrollPeriod);
    const premium = monthly.rawPremium / runs;
    const share = monthly.employeeShare ?? 0.5;

    // HR minimum per share: 250 a run for monthly, semi-monthly and daily;
    // a weekly run is half a cutoff, so 125.
    const scale = Math.min(1, 2 / runs);
    const minEmployee = r2(monthly.floorPremium * share * scale);
    const minEmployer = r2(monthly.floorPremium * (1 - share) * scale);

    return {
        premium: r2(premium),
        employee: Math.max(r2(premium * share), minEmployee),
        employer: Math.max(r2(premium * (1 - share)), minEmployer),
        minEmployee,
        runs,
    };
}
