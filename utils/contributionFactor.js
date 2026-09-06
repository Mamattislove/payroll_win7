import { PAYROLL_PERIODS } from "./constants.js";

/**
 * SSS, PhilHealth and Pag-IBIG are *monthly* obligations, remitted once a month
 * however often payroll runs. This returns the share of the monthly amount a
 * single run should deduct, so the runs in a month add up to exactly 100%.
 *
 *   monthly              1     — the whole amount on the single run
 *   semi-monthly, daily  0.5   — half on each of the two cutoffs
 *   weekly               0.25  — a quarter on each of the first four runs of
 *                                the month, and nothing on a fifth
 *
 * Why skip the fifth week rather than divide by the actual week count: dividing
 * by 4 or 5 makes the deduction change size between months, which employees
 * query every time they see it. A constant quarter with a skipped fifth week
 * keeps the payslip stable and still remits exactly the monthly amount.
 *
 * Daily-rated employees take the semi-monthly share, not the weekly one:
 * "daily" describes how they are rated, but their payroll runs on the same two
 * cutoffs a month as everyone else, so half the monthly amount comes off each.
 *
 * @param {string} payrollPeriod - Compensation.payrollPeriod
 * @param {Date|string} payrollFrom - start of the pay period
 * @returns {number} multiplier to apply to the monthly contribution
 */
export function contributionFactor(payrollPeriod, payrollFrom) {
    switch (payrollPeriod) {
        case PAYROLL_PERIODS.MONTHLY:
            return 1;

        case PAYROLL_PERIODS.SEMI_MONTHLY:
        case PAYROLL_PERIODS.DAILY:
            return 0.5;

        case PAYROLL_PERIODS.WEEKLY: {
            const day = new Date(payrollFrom).getUTCDate();
            // Days 1-7 are week 1, 8-14 week 2, 15-21 week 3, 22-28 week 4.
            // Anything from the 29th onward is a fifth week and is skipped.
            const weekOfMonth = Math.ceil(day / 7);
            return weekOfMonth <= 4 ? 0.25 : 0;
        }

        default:
            // No period set. Deduct the whole amount rather than silently
            // under-remitting; every compensation in the system does set one.
            return 1;
    }
}
