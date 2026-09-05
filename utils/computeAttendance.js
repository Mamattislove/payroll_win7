// Night differential is a premium on hours that are ALREADY being paid, not pay
// for extra hours: nightPremiumHours is the slice of regularHours that fell
// after 10pm, and overtimeNightPremiumHours the same slice of overtimeHours.
// Both are charged as a flat percentage of the base hourly rate — 10% for
// straight time, 12.5% where overtime runs at 1.25× and 13% where it runs at
// 1.3×. The percentage does not scale with the day-type multiplier.
//
// This is the basis the attendance in this database was built on: an imported
// row reading regHRS 8 / regPay 611.93 also carries regNP 8 / regNPPay 61.19,
// exactly 10% of the base hourly for the same eight hours. Charging the base
// hour again inside the night premium pays those hours twice.
const ND_RATE = 0.1;
const ND_OT_RATE_REGULAR = 0.125;
const ND_OT_RATE_PREMIUM = 0.13;

function buildRates(dailyRate) {
    const hr = dailyRate / 8;
    return {
        regular: hr,
        regularOt: hr * 1.25,
        rdOrSpecial: hr * 1.3,
        rdOrSpecialOt: hr * 1.3 * 1.3,
        rdOnSpec: hr * 1.5,
        rdOnSpecOt: hr * 1.5 * 1.3,
        legalPerDay: dailyRate * 2,
        legalOt: hr * 2 * 1.3,
        rdLegal: hr * 2.6,
        rdLegalOt: hr * 2.6 * 1.3,
        // Flat premiums — deliberately not multiplied by the day-type rate.
        nd: hr * ND_RATE,
        ndOtRegular: hr * ND_OT_RATE_REGULAR,
        ndOtPremium: hr * ND_OT_RATE_PREMIUM,
    };
}

const DAY_TYPE_FLAGS = {
    Regular: { isRestDay: false, holidayType: "", payLevel: "standard" },
    "Special / Rest Day": {
        isRestDay: false,
        holidayType: "special",
        payLevel: "standard",
    },
    "Special + Rest Day": {
        isRestDay: true,
        holidayType: "special",
        payLevel: "standard",
    },
    "Legal Holiday": {
        isRestDay: false,
        holidayType: "legal",
        payLevel: "standard",
    },
    "Legal Regular Pay": {
        isRestDay: false,
        holidayType: "legal",
        payLevel: "regular",
    },
    "Legal 3x Pay": {
        isRestDay: false,
        holidayType: "legal",
        payLevel: "triple",
    },
    "Legal + RD 2x Pay": {
        isRestDay: true,
        holidayType: "legal",
        payLevel: "standard",
    },
    "Legal + RD Regular Pay": {
        isRestDay: true,
        holidayType: "legal",
        payLevel: "regular",
    },
    "Legal + RD 3x Pay": {
        isRestDay: true,
        holidayType: "legal",
        payLevel: "triple",
    },
    "Double Holiday (Legal + Legal)": {
        isRestDay: false,
        holidayType: "double",
        payLevel: "standard",
    },
    "Leave With Pay": { isRestDay: false, holidayType: "", payLevel: "standard", leaveType: "withPay" },
    "Leave Half Day": { isRestDay: false, holidayType: "", payLevel: "standard", leaveType: "halfDay" },
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
    const rates = buildRates(dailyRate);
    const flags = DAY_TYPE_FLAGS[dayType];

    // Non-work day types (Absent, Leave, Rest Day OFF) — no pay
    if (!flags) return { ...ZERO_RESULT };

    const { isRestDay, holidayType, payLevel } = flags;

    let perHour, otPerHour;
    // Night premiums are flat against the base hourly rate, so only the
    // overtime tier varies: 12.5% where overtime is paid at 1.25x, 13% where
    // it is paid at 1.3x.
    const ndPerHour = rates.nd;
    let ndOtPerHour = rates.ndOtPremium;

    if (isRestDay && holidayType === "legal") {
        if (payLevel === "regular") {
            rates.rdLegal = 8 * rates.rdOrSpecial;
            rates.rdLegalOt = rates.rdOrSpecialOt;
            ndOtPerHour = rates.ndOtRegular;
        } else if (payLevel === "triple") {
            rates.rdLegal = 8 * rates.rdOrSpecial * 3;
        }
        perHour = rates.rdLegal / 8;
        otPerHour = rates.rdLegalOt;
    } else if (!isRestDay && holidayType === "legal") {
        if (payLevel === "regular") {
            rates.legalPerDay = 8 * rates.regular;
            rates.legalOt = rates.regularOt;
            ndOtPerHour = rates.ndOtRegular;
        } else if (payLevel === "triple") {
            rates.legalPerDay = 8 * rates.regular * 3;
        }
        perHour = rates.legalPerDay / 8;
        otPerHour = rates.legalOt;
    } else if (!isRestDay && holidayType === "special") {
        perHour = rates.rdOrSpecial;
        otPerHour = rates.rdOrSpecialOt;
    } else if (isRestDay && holidayType === "special") {
        perHour = rates.rdOnSpec;
        otPerHour = rates.rdOnSpecOt;
    } else if (!isRestDay && holidayType === "double") {
        perHour = (dailyRate * 2) / 8;
        otPerHour = perHour * 1.3;
    } else if (isRestDay && holidayType === "double") {
        const dRate = 8 * rates.rdOnSpec * 0.6 + 2 * rates.rdLegal;
        perHour = dRate / 8;
        otPerHour = rates.rdOnSpecOt + rates.rdLegalOt;
    } else if (isRestDay) {
        perHour = rates.rdOrSpecial;
        otPerHour = rates.rdOrSpecialOt;
    } else {
        perHour = rates.regular;
        otPerHour = rates.regularOt;
        ndOtPerHour = rates.ndOtRegular;
    }

    // Absent / no hours recorded
    const hasHours =
        regularHours > 0 ||
        overtimeHours > 0 ||
        nightPremiumHours > 0 ||
        overtimeNightPremiumHours > 0;

    if (!hasHours) {
        const { leaveType } = flags;
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
        overtimeHoursPay: r2(overtimeHours * otPerHour),
        nightPremiumHours: r2(nightPremiumHours),
        nightPremiumPay: r2(nightPremiumHours * ndPerHour),
        overtimeNightPremiumHours: r2(overtimeNightPremiumHours),
        overtimeNightPremiumPay: r2(overtimeNightPremiumHours * ndOtPerHour),
    };
}
