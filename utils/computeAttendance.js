// Pay multipliers come from attendanceRates.js. This file used to carry its own
// copy of them as a chain of if/else branches, and the two drifted: `Legal + RD
// 2x Pay` divided a per-hour rate by 8 and paid 0.325x the hourly rate instead
// of 2.6x, and four other day types disagreed with the table. Driving both from
// one table is what stops that recurring — add a day type in one place.
import { RATE_MULTIPLIERS } from "./attendanceRates.js";

// Night differential is a premium on hours that are ALREADY being paid, not pay
// for extra hours: nightPremiumHours is the slice of regularHours that fell
// after 10pm, and overtimeNightPremiumHours the same slice of overtimeHours.
// Both are charged as 10% of what that hour is ALREADY worth, so the premium
// scales with the day-type multiplier, and an OT night hour scales with the
// overtime multiplier on top of that — a legal-holiday night hour is 0.20×,
// its OT night hour 0.26×. attendanceRates.js reproduces the client's rate
// sheet and derives `nd` / `ndOt` from `regular` / `ot` for that reason.
//
// What does NOT change is that the base hour is never charged here: the
// imported row reading regHRS 8 / regPay 611.93 carries regNP 8 / regNPPay
// 61.19 — 10% of the hourly for those same eight hours, not 110% of it. Paying
// the base hour again inside the night premium pays those hours twice.

// What a day type still owes when nobody worked it, and which of the two leave
// allowances applies. Rates deliberately live in RATE_MULTIPLIERS, not here.
const DAY_TYPE_FLAGS = {
    Regular: {},
    "Special / Rest Day": { holidayType: "special" },
    "Special + Rest Day": { holidayType: "special" },
    "Legal Holiday": { holidayType: "legal" },
    "Legal Regular Pay": { holidayType: "legal" },
    "Legal 3x Pay": { holidayType: "legal" },
    "Legal + RD 2x Pay": { holidayType: "legal" },
    "Legal + RD Regular Pay": { holidayType: "legal" },
    "Legal + RD 3x Pay": { holidayType: "legal" },
    "Double Holiday (Legal + Legal)": { holidayType: "double" },
    "Leave With Pay": { leaveType: "withPay" },
    "Leave Half Day": { leaveType: "halfDay" },
};

const ZERO_RESULT = {
    lateHr: 0,
    lateDeduction: 0,
    undertimeHr: 0,
    undertimeDeduction: 0,
    regularHours: 0,
    regularHoursPay: 0,
    overtimeHours: 0,
    overtimeHoursPay: 0,
    nightPremiumHours: 0,
    nightPremiumPay: 0,
    overtimeNightPremiumHours: 0,
    overtimeNightPremiumPay: 0,
};

/**
 * Converts attendance hours into peso amounts using DOLE-standard multipliers.
 * All hour fields default to 0 — pass only the ones that apply.
 */
export function computeAttendance({
    dailyRate,
    dayType,
    regularHours = 0,
    overtimeHours = 0,
    nightPremiumHours = 0,
    overtimeNightPremiumHours = 0,
    lateHr = 0,
    undertimeHr = 0,
}) {
    const r2 = (n) => Math.round(n * 100) / 100;
    const flags = DAY_TYPE_FLAGS[dayType];

    // Non-work day types (Absent, Leave, Rest Day OFF) — no pay
    if (!flags) return { ...ZERO_RESULT };

    // Absent / no hours recorded
    const hasHours =
        regularHours > 0 ||
        overtimeHours > 0 ||
        nightPremiumHours > 0 ||
        overtimeNightPremiumHours > 0;

    if (!hasHours) {
        const { leaveType, holidayType } = flags;
        if (leaveType === "withPay") return { ...ZERO_RESULT, regularHoursPay: r2(dailyRate) };
        if (leaveType === "halfDay") return { ...ZERO_RESULT, regularHoursPay: r2(dailyRate / 2) };
        // DOLE rules for absent / unworked days:
        //   Legal Holiday        → 100% of daily rate (guaranteed even when absent)
        //   Double Legal Holiday → 200% of daily rate (two legal holidays on same day)
        //   Special Holiday      → no work, no pay (0)
        //   Rest Day             → no work, no pay (0)
        const absentPay =
            holidayType === "legal"  ? r2(dailyRate) :
            holidayType === "double" ? r2(dailyRate * 2) :
            0;
        return { ...ZERO_RESULT, regularHoursPay: absentPay };
    }

    // A leave row that also carries worked hours is paid for those hours at the
    // plain Regular multipliers. The table's 1.0 / 0.5 against the leave types
    // prices the allowance handled just above, not an hour actually worked —
    // reading them here would pay half-day leave half rate for a full shift.
    const m = RATE_MULTIPLIERS[flags.leaveType ? "Regular" : dayType];

    const hr = dailyRate / 8;
    const perHour = hr * m.regular;

    // The night figures are premium only. The hours behind them are already
    // paid inside regularHoursPay / overtimeHoursPay, so adding the base hour
    // here would pay those same hours a second time.
    return {
        lateHr: r2(lateHr),
        lateDeduction: r2(lateHr * perHour),
        undertimeHr: r2(undertimeHr),
        undertimeDeduction: r2(undertimeHr * perHour),
        regularHours: r2(regularHours),
        regularHoursPay: r2(regularHours * perHour),
        overtimeHours: r2(overtimeHours),
        overtimeHoursPay: r2(overtimeHours * hr * m.ot),
        nightPremiumHours: r2(nightPremiumHours),
        nightPremiumPay: r2(nightPremiumHours * hr * m.nd),
        overtimeNightPremiumHours: r2(overtimeNightPremiumHours),
        overtimeNightPremiumPay: r2(overtimeNightPremiumHours * hr * m.ndOt),
    };
}
