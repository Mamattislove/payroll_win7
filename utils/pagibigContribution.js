import { runsPerMonth } from "./contributionFactor.js";

// Pag-IBIG arithmetic per payroll run -- the office's computePagibigContri.
// Pure: it takes a rate row as the database holds it and does no lookups, so
// the server can share it with anything on the client that needs it.

const r2 = (n) => Math.round(n * 100) / 100;

// When a rate row leaves a figure out.
const DEFAULT_SALARY_CAP = 10000;
const DEFAULT_LOW_INCOME = 1500;
const DEFAULT_LOW_RATE = 0.01;
const DEFAULT_RATE = 0.02;

/**
 * What one payroll run deducts for Pag-IBIG:
 *
 *   the salary cap divided by the runs in a month
 *     (10,000: semi-monthly and daily / 2, weekly / 4, monthly / 1)
 *   the run's basic pay, capped there
 *   1% if that is 1,500 or less, otherwise 2%
 *   base x rate x 2 -- the employee pays that, and the employer the same
 *
 * e.g. a semi-monthly cutoff of 7,500: cap 5,000, 5,000 x 2% x 2 = 200 from
 * the employee and 200 from the employer.
 *
 * Cap, threshold and rates come from the year's rate row
 * (percentageRateSalaryThreshold, incomeCeiling, basicEmployeeShare,
 * overThresholdEmployeeShare).
 */
export function pagibigPerRun(rate, pay, payrollPeriod) {
    const runs = runsPerMonth(payrollPeriod);
    const salaryCap =
        (rate.percentageRateSalaryThreshold || DEFAULT_SALARY_CAP) / runs;
    const base = Math.min(Math.max(pay, 0), salaryCap);

    const lowIncome = rate.incomeCeiling ?? DEFAULT_LOW_INCOME;
    const empRate =
        base <= lowIncome
            ? (rate.basicEmployeeShare ?? DEFAULT_LOW_RATE)
            : (rate.overThresholdEmployeeShare ?? DEFAULT_RATE);

    const amount = r2(base * empRate * 2);
    return { employee: amount, employer: amount, base: r2(base), salaryCap, empRate };
}
