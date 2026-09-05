// Everything a payslip needs to say, derived once. The PDF components differ
// only in how they lay this out — none of them recompute money, so the compact
// slip and the acknowledgment slip can never disagree about a peso.

export const f2 = (v) =>
    (Number(v) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export const isoDay = (v) => new Date(v).toISOString().slice(0, 10);
export const utcDay = (v) => new Date(v).getUTCDate();

const slipDate = (v) =>
    v
        ? new Date(v).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
          })
        : "";

export const periodLabel = (from, to) => `${slipDate(from)} to ${slipDate(to)}`;

export const sum = (rows, field) =>
    (rows || []).reduce((acc, r) => acc + (Number(r?.[field]) || 0), 0);

// Every date in the period, so a day with no attendance still prints as a zero
// row rather than vanishing and making the slip look short.
export const daysInPeriod = (from, to) => {
    const days = [];
    let cur = new Date(`${isoDay(from)}T00:00:00Z`);
    const end = new Date(`${isoDay(to)}T00:00:00Z`);
    while (cur <= end && days.length < 40) {
        days.push(cur.toISOString().slice(0, 10));
        cur = new Date(cur.getTime() + 86400000);
    }
    return days;
};

/**
 * The acknowledgment receipt's PARTICULARS block, in the order of the
 * pre-printed form. Every label prints whether or not it carries a value, so
 * the receipt reads the same for everyone; a charge whose type is not on this
 * list is appended rather than dropped.
 */
export const PARTICULAR_LABELS = [
    "SAVINGS",
    "UNIFORMS",
    "CASH ADVANCE",
    "CHARGES",
    "BANK CHARGES",
    "INSURANCE",
    "LOAN",
    "CONTRI",
    "MEDICAL",
    "MANDATORY LOAN",
    "ADJUSTMENT",
];

// Older charge types were named in the singular; fold them onto the printed
// label so a legacy record still lands on the right line.
const LABEL_ALIASES = { UNIFORM: "UNIFORMS", "SALARY LOAN": "LOAN" };

const normaliseLabel = (name) => {
    const upper = String(name || "").trim().toUpperCase();
    return LABEL_ALIASES[upper] ?? upper;
};

export function particularLines(payroll) {
    const totals = new Map(PARTICULAR_LABELS.map((l) => [l, 0]));

    for (const c of payroll.charges || []) {
        const label = normaliseLabel(c.chargeType?.chargeName || c.name);
        totals.set(label, (totals.get(label) ?? 0) + (c.amount || 0));
    }

    // Known labels first, in printed order; anything unrecognised after, so a
    // new charge type shows up instead of quietly vanishing from the receipt.
    const known = PARTICULAR_LABELS.map((label) => ({
        label,
        value: totals.get(label) ?? 0,
    }));
    const extra = [...totals.entries()]
        .filter(([label]) => !PARTICULAR_LABELS.includes(label))
        .map(([label, value]) => ({ label, value }));

    return [...known, ...extra];
}

/**
 * Deduction lines. The three government contributions always print, matching
 * the pre-printed slip; everything else appears only when it carries a value,
 * so a slip stays readable but no deduction is ever silently omitted.
 */
export function deductionLines(p) {
    const lines = [
        { label: "SSS", value: p.sssContribution || 0 },
        { label: "Philhealth", value: p.philhealthContribution || 0 },
        { label: "HDMF", value: p.pagibigContribution || 0 },
    ];

    const optional = (label, value) => {
        if (Math.abs(Number(value) || 0) > 0.001) lines.push({ label, value });
    };

    optional("Withholding Tax", p.withholdingTax);
    for (const l of p.loans || []) {
        optional(l.loan?.loanType?.loanTypeName || l.loan?.loanName || "Loan", l.amount);
    }
    for (const d of p.deductions || []) {
        optional(
            d.deductionRecord?.deductionType?.deductionName ||
                d.deductionRecord?.name ||
                "Deduction",
            d.amount,
        );
    }
    for (const sv of p.savings || []) optional("Savings", sv.amount);

    // Attendance-driven deductions. Absent from the printed slip because the
    // sample employee had none, but hiding them would make the slip stop
    // footing the moment somebody is late.
    optional("Absences", p.absences);
    optional("Late", p.late);
    optional("Undertime", p.undertime);

    return lines;
}

/**
 * Every figure a slip prints, derived from the payroll and the timekeeping
 * behind it.
 *
 * @param {Object} payroll     a payroll record with compensation populated
 * @param {Array}  attendance  that employee's rows for the period
 */
export function buildSlipModel(payroll, attendance = []) {
    const p = payroll;
    const emp = p?.compensation?.employeeDesignation?.employee;

    // One row per calendar day of the period, filled from attendance where it
    // exists, so a rest day still prints as zeros instead of disappearing.
    const byDate = new Map(
        (attendance || []).map((a) => [isoDay(a.attendanceDate), a]),
    );
    const days = daysInPeriod(p.payrollFrom, p.payrollTo).map((date) => {
        const a = byDate.get(date);
        return {
            day: utcDay(date),
            regularHours: a?.regularHours || 0,
            overtimeHours: a?.overtimeHours || 0,
            nightPremiumHours: a?.nightPremiumHours || 0,
            overtimeNightPremiumHours: a?.overtimeNightPremiumHours || 0,
        };
    });

    // The payroll banks night differential as one figure. Split it back into
    // straight-time and overtime halves from the attendance the slip already
    // shows; with no attendance on file the whole amount stays on the
    // straight-time line rather than being dropped.
    const hasAttendance = (attendance || []).length > 0;
    const ndTotal = p.nightDifferentialPay || 0;
    const nightDiff = hasAttendance ? sum(attendance, "nightPremiumPay") : ndTotal;
    const nightDiffOt = hasAttendance
        ? sum(attendance, "overtimeNightPremiumPay")
        : 0;

    const earningRecords = (p.earning || []).reduce((a, r) => a + (r.amount || 0), 0);
    const allowances = (p.allowances || []).reduce((a, r) => a + (r.amount || 0), 0);
    const leaveSil = earningRecords + (p.leavePay || 0);

    // GROSS PAY on the slip is the earnings listed above it. Allowances print
    // on their own line below, so the stored grossPay — which includes them —
    // would double-count here.
    const gross =
        (p.regularPay || 0) +
        (p.regularOTPay || 0) +
        (p.holidayRestDayPay || 0) +
        (p.holidayRestDayOTPay || 0) +
        ndTotal +
        leaveSil;

    const particulars = particularLines(p);
    const particularsTotal = particulars.reduce((a, r) => a + r.value, 0);

    return {
        employee: emp,
        employeeCode: emp?.employeeCode || "—",
        period: periodLabel(p.payrollFrom, p.payrollTo),
        days,
        totals: {
            regularHours: sum(days, "regularHours"),
            overtimeHours: sum(days, "overtimeHours"),
            nightPremiumHours: sum(days, "nightPremiumHours"),
            overtimeNightPremiumHours: sum(days, "overtimeNightPremiumHours"),
        },
        earnings: {
            regPay: p.regularPay || 0,
            otPay: p.regularOTPay || 0,
            holRdPay: p.holidayRestDayPay || 0,
            holRdPayOt: p.holidayRestDayOTPay || 0,
            nightDiff,
            nightDiffOt,
            leaveSil,
            gross,
            allowances,
        },
        deductions: deductionLines(p),
        totalDeductions: p.totalDeductions || 0,
        netPay: p.netSalary || 0,
        particulars,
        particularsTotal,
        finalPay: p.finalPay ?? (p.netSalary || 0) - particularsTotal,
    };
}
