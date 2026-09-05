import Payroll from "../models/Payroll.js";
import EarningRecord from "../models/EarningRecord.js";
import AllowanceRecord from "../models/AllowanceRecord.js";
import DeductionPayment from "../models/DeductionPayment.js";
import SavingsPayment from "../models/SavingsPayment.js";
import LoanPayment from "../models/LoanPayment.js";
import ChargeRecord from "../models/ChargeRecord.js";
import { derivePayrollTotals } from "./payrollTotals.js";

const r2 = (n) => Math.round(n * 100) / 100;
const sum = (records) => records.reduce((acc, r) => acc + (r.amount ?? 0), 0);

export async function recomputePayrollTotals(payrollId) {
    const [payroll, earnings, allowances, deductions, savingsPayments, loanPayments, charges] =
        await Promise.all([
            Payroll.findById(payrollId),
            EarningRecord.find({ payroll: payrollId }),
            AllowanceRecord.find({ payroll: payrollId }),
            DeductionPayment.find({ payroll: payrollId }),
            SavingsPayment.find({ payroll: payrollId }),
            LoanPayment.find({ payroll: payrollId }),
            ChargeRecord.find({ payroll: payrollId }),
        ]);

    if (!payroll) return null;

    const { grossPay, totalDeductions, netSalary, finalPay } =
        derivePayrollTotals({
            regularPay: payroll.regularPay,
            regularOTPay: payroll.regularOTPay,
            holidayRestDayPay: payroll.holidayRestDayPay,
            holidayRestDayOTPay: payroll.holidayRestDayOTPay,
            nightDifferentialPay: payroll.nightDifferentialPay,
            leavePay: payroll.leavePay ?? 0,
            absences: payroll.absences,
            late: payroll.late,
            undertime: payroll.undertime,
            sssContribution: payroll.sssContribution,
            philhealthContribution: payroll.philhealthContribution,
            pagibigContribution: payroll.pagibigContribution,
            withholdingTax: payroll.withholdingTax,
            earnings: sum(earnings),
            allowances: sum(allowances),
            deductions: sum(deductions),
            savings: sum(savingsPayments),
            loans: sum(loanPayments),
            charges: sum(charges),
        });

    return Payroll.findByIdAndUpdate(
        payrollId,
        {
            earning: earnings.map((r) => r._id),
            allowances: allowances.map((r) => r._id),
            deductions: deductions.map((r) => r._id),
            savings: savingsPayments.map((r) => r._id),
            loans: loanPayments.map((r) => r._id),
            charges: charges.map((r) => r._id),
            grossPay,
            totalDeductions,
            netSalary,
            finalPay,
        },
        { new: true },
    );
}
