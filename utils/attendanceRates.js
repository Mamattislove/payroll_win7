// DOLE-standard pay multipliers keyed by dayType string value. This is the one
// place rates are defined — computeAttendance() reads the same table, so a new
// day type or a corrected rate only has to be written here.
// regular  = multiplier applied to hourlyRate × regularHours
// ot       = multiplier applied to hourlyRate × overtimeHours
// nd       = multiplier applied to hourlyRate × nightPremiumHours
// ndOt     = multiplier applied to hourlyRate × overtimeNightPremiumHours
//
// Night differential is 10% of what the hour is ALREADY worth on that day, not
// a flat 10% of the base hourly rate. It compounds with the day-type premium,
// and on overtime night hours it compounds with the overtime premium too. The
// client's rate sheet spells this out line by line:
//
//   Regular NSD OT = Rate / 8 * .10 * 1.25            550/8 →  8.59
//   SH/RD NSD      = Rate / 8 * .10 * 1.30            550/8 →  8.94
//   SH/RD NSD OT   = Rate / 8 * 1.69 * .10            550/8 → 11.62
//   LH NSD         = Rate / 8 * 200% * 10%            570/8 → 14.25
//   LH NSD OT      = Rate / 8 * 200% * 130% * 10%     570/8 → 18.53
//
// Every one of those is 10% of that day type's own `regular` (for NSD) or its
// own `ot` (for NSD OT) — so nd/ndOt are DERIVED below rather than typed in.
// They used to be typed in as a flat 0.1 and 0.13 for every day type, which
// paid a legal-holiday night hour 0.10× when the sheet says 0.20×, and a
// rest-day OT night hour 0.13× when the sheet says 0.169×.
//
// The legacy PHP export agrees with the old flat 0.1 rather than with the
// sheet — but only across 21 night rows falling on holiday/rest days, against
// 2,515 on ordinary days where both readings give the same 0.1. The old system
// underpaid those 21; the rate sheet is the rule.
const NSD = 0.1;

// One row of the table. The two premium rates are always 10% of the two pay
// rates, so they cannot drift away from them the way hand-typed figures did.
const rates = (regular, ot) => ({
    regular,
    ot,
    nd: regular * NSD,
    ndOt: ot * NSD,
});

// Leave entries price the allowance for an UNWORKED day. computeAttendance
// handles that case separately and falls back to Regular for a leave row that
// does carry worked hours — nobody works night hours on a day not worked, so
// there is no premium to derive here.
const leaveAllowance = (regular) => ({ regular, ot: 0, nd: 0, ndOt: 0 });

export const RATE_MULTIPLIERS = {
    Regular: rates(1.0, 1.25),
    "Special / Rest Day": rates(1.3, 1.3 * 1.3),
    "Special + Rest Day": rates(1.5, 1.5 * 1.3),
    "Legal Holiday": rates(2.0, 2.0 * 1.3),
    "Double Holiday (Legal + Legal)": rates(3.0, 3.0 * 1.3),
    "Legal Regular Pay": rates(1.0, 1.25),
    "Legal 3x Pay": rates(3.0, 3.0 * 1.3),
    // The "+ RD" family is the legal-holiday rate the client pays, times the
    // 130% rest day premium — work on a rest day earns it whether or not the
    // holiday premium was waived. Each entry is therefore its non-RD sibling
    // (1x / 2x / 3x above) × 1.3, and overtime is that day rate × 1.3 again,
    // which is the DOLE rule for overtime on a rest day.
    //
    // Getting this wrong is what made `Legal + RD Regular Pay` price identically
    // to `Legal Regular Pay`, and `Legal + RD 3x Pay` price at 3.38 — the
    // OVERTIME rate of a 2x rest day, sitting in the regular-hours slot.
    "Legal + RD Regular Pay": rates(1.0 * 1.3, 1.0 * 1.3 * 1.3),
    "Legal + RD 2x Pay": rates(2.0 * 1.3, 2.0 * 1.3 * 1.3),
    "Legal + RD 3x Pay": rates(3.0 * 1.3, 3.0 * 1.3 * 1.3),
    "Leave With Pay": leaveAllowance(1.0),
    "Leave Half Day": leaveAllowance(0.5),
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
