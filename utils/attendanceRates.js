// DOLE-standard pay multipliers keyed by dayType string value.
// regular  = multiplier applied to hourlyRate × regularHours
// ot       = multiplier applied to hourlyRate × overtimeHours
// nd       = multiplier applied to hourlyRate × nightPremiumHours (10% extra)
// ndOt     = multiplier applied to hourlyRate × overtimeNightPremiumHours
const RATE_MULTIPLIERS = {
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
    "Legal + RD 2x Pay": {
        regular: 2.6,
        ot: 2.6 * 1.3,
        nd: 0.1,
        ndOt: 0.1 * 1.3,
    },
    "Legal + RD Regular Pay": { regular: 1.0, ot: 1.25, nd: 0.1, ndOt: 0.125 },
    "Legal + RD 3x Pay": {
        regular: 3.38,
        ot: 3.38 * 1.3,
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
