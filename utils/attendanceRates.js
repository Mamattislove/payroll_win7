// DOLE-standard pay multipliers keyed by dayType string value. This is the one
// place rates are defined — computeAttendance() reads the same table, so a new
// day type or a corrected rate only has to be written here.
// regular  = multiplier applied to hourlyRate × regularHours
// ot       = multiplier applied to hourlyRate × overtimeHours
// nd       = multiplier applied to hourlyRate × nightPremiumHours (10% extra)
// ndOt     = multiplier applied to hourlyRate × overtimeNightPremiumHours
//
// The leave entries price the allowance for an unworked day. computeAttendance
// handles that case separately and falls back to Regular for a leave row that
// does carry worked hours.
export const RATE_MULTIPLIERS = {
    Regular: { regular: 1.0, ot: 1.25, nd: 0.1, ndOt: 0.125 },
    "Special / Rest Day": {
        regular: 1.3,
        ot: 1.3 * 1.3,
        nd: 0.1,
        ndOt: 0.1 * 1.3,
    },
    "Special + Rest Day": {
        regular: 1.5,
        ot: 1.5 * 1.3,
        nd: 0.1,
        ndOt: 0.1 * 1.3,
    },
    "Legal Holiday": { regular: 2.0, ot: 2.0 * 1.3, nd: 0.1, ndOt: 0.1 * 1.3 },
    "Double Holiday (Legal + Legal)": {
        regular: 3.0,
        ot: 3.0 * 1.3,
        nd: 0.1,
        ndOt: 0.1 * 1.3,
    },
    "Legal Regular Pay": { regular: 1.0, ot: 1.25, nd: 0.1, ndOt: 0.125 },
    "Legal 3x Pay": { regular: 3.0, ot: 3.0 * 1.3, nd: 0.1, ndOt: 0.1 * 1.3 },
    // The "+ RD" family is the legal-holiday rate the client pays, times the
    // 130% rest day premium — work on a rest day earns it whether or not the
    // holiday premium was waived. Each entry is therefore its non-RD sibling
    // (1x / 2x / 3x above) × 1.3, and overtime is that day rate × 1.3 again,
    // which is the DOLE rule for overtime on a rest day.
    //
    // Getting this wrong is what made `Legal + RD Regular Pay` price identically
    // to `Legal Regular Pay`, and `Legal + RD 3x Pay` price at 3.38 — the
    // OVERTIME rate of a 2x rest day, sitting in the regular-hours slot.
    "Legal + RD Regular Pay": {
        regular: 1.0 * 1.3,
        ot: 1.0 * 1.3 * 1.3,
        nd: 0.1,
        ndOt: 0.1 * 1.3,
    },
    "Legal + RD 2x Pay": {
        regular: 2.0 * 1.3,
        ot: 2.0 * 1.3 * 1.3,
        nd: 0.1,
        ndOt: 0.1 * 1.3,
    },
    "Legal + RD 3x Pay": {
        regular: 3.0 * 1.3,
        ot: 3.0 * 1.3 * 1.3,
        nd: 0.1,
        ndOt: 0.1 * 1.3,
    },
    "Leave With Pay": { regular: 1.0, ot: 0, nd: 0, ndOt: 0 },
    "Leave Half Day": { regular: 0.5, ot: 0, nd: 0, ndOt: 0 },
    // No pay day types — not in the map, returns all zeros
    // "Rest Day (OFF / Absent)", "Absent", "Leave"
};

const round2 = (n) => Math.round(n * 100) / 100;

export function computeAttendancePay({
    dailyRate,
    dayType,
    regularHours = 0,
    overtimeHours = 0,
    nightPremiumHours = 0,
    overtimeNightPremiumHours = 0,
}) {
    const m = RATE_MULTIPLIERS[dayType];
    if (!m) {
        return {
            regularHoursPay: 0,
            overtimeHoursPay: 0,
            nightPremiumPay: 0,
            overtimeNightPremiumPay: 0,
        };
    }

    const hourlyRate = dailyRate / 8;

    return {
        regularHoursPay: round2(regularHours * hourlyRate * m.regular),
        overtimeHoursPay: round2(overtimeHours * hourlyRate * m.ot),
        nightPremiumPay: round2(nightPremiumHours * hourlyRate * m.nd),
        overtimeNightPremiumPay: round2(
            overtimeNightPremiumHours * hourlyRate * m.ndOt,
        ),
    };
}
