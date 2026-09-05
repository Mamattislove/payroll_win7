const r2 = (n) => Math.round(n * 100) / 100;

/**
 * The arithmetic that turns pay buckets and linked record sums into the four
 * totals on a payroll. Kept in one place so a payroll stored in the database
 * and a payroll accumulated live for a report cannot foot differently.
 */
export function derivePayrollTotals({
    regularPay = 0,
    regularOTPay = 0,
    holidayRestDayPay = 0,
    holidayRestDayOTPay = 0,
    nightDifferentialPay = 0,
    leavePay = 0,
    absences = 0,
    late = 0,
    undertime = 0,
    sssContribution = 0,
    philhealthContribution = 0,
    pagibigContribution = 0,
    withholdingTax = 0,
    earnings = 0,
    allowances = 0,
    deductions = 0,
    savings = 0,
    loans = 0,
    charges = 0,
}) {
    const attendancePay =
        regularPay +
        regularOTPay +
        holidayRestDayPay +
        holidayRestDayOTPay +
        nightDifferentialPay +
        leavePay;

    const grossPay = r2(attendancePay + earnings + allowances);

    const totalDeductions = r2(
        absences +
            late +
            undertime +
            sssContribution +
            philhealthContribution +
            pagibigContribution +
            withholdingTax +
            deductions +
            savings +
            loans,
    );

    const netSalary = r2(grossPay - totalDeductions);
    const finalPay = r2(netSalary - charges);

    return { grossPay, totalDeductions, netSalary, finalPay };
}
