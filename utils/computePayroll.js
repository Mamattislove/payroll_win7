import { DAY_TYPES } from "./constants.js";

const REGULAR_TYPES = new Set([DAY_TYPES.REGULAR]);

const HOLIDAY_REST_TYPES = new Set([
    DAY_TYPES.SPECIAL_HOLIDAY,
    DAY_TYPES.SPECIAL_AND_REST_DAY,
    DAY_TYPES.LEGAL_HOLIDAY,
    DAY_TYPES.LEGAL_REGULAR_PAY,
    DAY_TYPES.LEGAL_3X_PAY,
    DAY_TYPES.LEGAL_RD_2X_PAY,
    DAY_TYPES.LEGAL_RD_REGULAR_PAY,
    DAY_TYPES.LEGAL_RD_3X_PAY,
    DAY_TYPES.DOUBLE_HOLIDAY,
]);

const LEAVE_TYPES = new Set([DAY_TYPES.LEAVE_WITH_PAY, DAY_TYPES.LEAVE_HALFDAY]);

const HOURS_PER_DAY = 8;

// Days are counted off the hours actually worked, not off the pay, so a rate
// change mid-period cannot distort the count. nightPremiumHours is the slice of
// regularHours that fell after 10pm, not additional hours, so it is deliberately
// not added here - doing so counts a graveyard shift as two days.
const workedDays = (att) => (att.regularHours || 0) / HOURS_PER_DAY;

const hasWorkedHours = (att) =>
    (att.regularHours || 0) > 0 ||
    (att.overtimeHours || 0) > 0 ||
    (att.nightPremiumHours || 0) > 0 ||
    (att.overtimeNightPremiumHours || 0) > 0;

/**
 * Aggregates attendance records for a pay period into payroll buckets.
 *
 * Money is read off the attendance row as it was priced on the day worked,
 * not re-priced from the compensation's current dailyRate. A day belongs to
 * the rate that was in effect when it was worked: a raise in July must not
 * retroactively restate June, and the billing report — which bills the client
 * from these same stored figures — would otherwise never tie to the payroll.
 *
 * The Attendance model carries no rate of its own, so these stored pay fields
 * are the only surviving record of the historical rate. Re-pricing destroys
 * it. A day priced wrongly is corrected by fixing that day's attendance row,
 * which re-prices it through computeAttendance and syncs the payroll.
 *
 * Night differential is a premium on hours already counted in regularHours,
 * not pay for extra hours, so it is banked whole into nightDiffPay and left out
 * of the day count - the hours behind it are already in basic pay.
 *
 * @param {Array} attendances - Attendance documents for the period
 * @param {number} dailyRate - Current daily rate, used only to price absences,
 *   which carry no stored figure of their own
 * @returns {Object} Aggregated payroll amounts
 */
export function computePayroll(attendances, dailyRate) {
    const r2 = (n) => Math.round(n * 100) / 100;

    let regularPay = 0;
    let regularOtPay = 0;
    let holidayRestDayPay = 0;
    let holidayRestDayOtPay = 0;
    let nightDiffPay = 0;
    let leavePay = 0;
    let absences = 0;
    let late = 0;
    let undertime = 0;
    let daysWorked = 0;
    let leaveDays = 0;

    for (const att of attendances) {
        const { dayType } = att;

        const regularHoursPay = att.regularHoursPay ?? 0;
        const overtimeHoursPay = att.overtimeHoursPay ?? 0;
        const nightPremiumPay = att.nightPremiumPay ?? 0;
        const overtimeNightPremiumPay = att.overtimeNightPremiumPay ?? 0;
        const lateDeduction = att.lateDeduction ?? 0;
        const undertimeDeduction = att.undertimeDeduction ?? 0;

        const straightPay = regularHoursPay;
        const otPay = overtimeHoursPay;

        // Night differential and deductions apply regardless of day type
        nightDiffPay += nightPremiumPay + overtimeNightPremiumPay;
        late += lateDeduction;
        undertime += undertimeDeduction;

        if (REGULAR_TYPES.has(dayType)) {
            regularPay += straightPay;
            regularOtPay += otPay;
            // Days are counted off the hours actually worked, not off the pay,
            // so a rate change mid-period cannot distort the count.
            daysWorked += workedDays(att);
        } else if (HOLIDAY_REST_TYPES.has(dayType)) {
            // Includes absent-on-holiday pay (1× dailyRate) since computeAttendance
            // already sets regularHoursPay = dailyRate for absent holiday employees
            holidayRestDayPay += straightPay;
            holidayRestDayOtPay += otPay;
        } else if (LEAVE_TYPES.has(dayType)) {
            // computeAttendance prices paid leave at 1× (or ½×) the daily rate.
            // Without a bucket of its own that money was computed and then
            // dropped, so paid leave reached the employee as nothing at all.
            //
            // A leave row that carries worked hours is priced by
            // computeAttendance at the plain Regular multipliers, so bank it
            // the same way rather than as leave — otherwise the overtime half
            // has nowhere to go and goes missing.
            if (hasWorkedHours(att)) {
                regularPay += straightPay;
                regularOtPay += otPay;
                daysWorked += workedDays(att);
            } else {
                leavePay += straightPay;
                leaveDays += dayType === DAY_TYPES.LEAVE_HALFDAY ? 0.5 : 1;
            }
        } else if (dayType === DAY_TYPES.ABSENT) {
            // An absent day has no stored pay to read a historical rate from,
            // so the current rate is the only basis available.
            absences += dailyRate;
        }
        // REST_DAY, LEAVE (unpaid) → no pay and no deduction here
    }

    return {
        regularPay: r2(regularPay),
        regularOtPay: r2(regularOtPay),
        holidayRestDayPay: r2(holidayRestDayPay),
        holidayRestDayOtPay: r2(holidayRestDayOtPay),
        nightDiffPay: r2(nightDiffPay),
        leavePay: r2(leavePay),
        absences: r2(absences),
        late: r2(late),
        undertime: r2(undertime),
        daysWorked: r2(daysWorked),
        leaveDays: r2(leaveDays),
    };
}
