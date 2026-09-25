import Payroll from "../models/Payroll.js";
import EarningRecord from "../models/EarningRecord.js";
import AllowanceRecord from "../models/AllowanceRecord.js";
import DeductionPayment from "../models/DeductionPayment.js";
import SavingsPayment from "../models/SavingsPayment.js";
import LoanPayment from "../models/LoanPayment.js";
import ChargeRecord from "../models/ChargeRecord.js";
import Compensation from "../models/Compensation.js";
import { derivePayrollTotals } from "./payrollTotals.js";
import {
    computeContributionsForRun,
    contributionGross,
} from "./computeGovContributions.js";

const sum = (records) => records.reduce((acc, r) => acc + (r.amount ?? 0), 0);

/**
 * The contributions for a payroll, recomputed from this run's actual gross when
 * the employee's basis is "gross pay", and left exactly as stored otherwise.
 *
 * Both halves of each contribution are restated together. They come out of one
 * bracket, so restating the employee share alone leaves the employer share
 * quoting a different bracket -- and the employer share is what gets remitted
 * and billed.
 *
 * Contributions do not feed grossPay (gross is attendance pay plus earnings and
 * allowances), so computing them from the gross and then feeding them back into
 * the deduction side is not circular.
 */
async function recomputeGrossBasisContributions(payroll) {
    const stored = {
        sssContribution: payroll.sssContribution,
        philhealthContribution: payroll.philhealthContribution,
        pagibigContribution: payroll.pagibigContribution,
        sssEmployerContribution: payroll.sssEmployerContribution,
        philhealthEmployerContribution: payroll.philhealthEmployerContribution,
        pagibigEmployerContribution: payroll.pagibigEmployerContribution,
    };

    // Figures keyed in by hand on the edit screen win over the rate tables.
    if (payroll.contributionsOverridden) return stored;

    const compensation = await Compensation.findById(
        payroll.compensation,
    ).lean();
    if (!compensation) return stored;

    // Every basis now reads this run rather than a standing rate: "basic pay"
    // is the period's regular pay and "gross pay" is everything earned, so both
    // move when the attendance behind them is re-keyed. That makes restating
    // unconditional -- the old guard only restated "gross pay" employees and
    // would have left a basic-pay employee quoting contributions from the
    // attendance they had before the correction.
    // The "gross pay" contributions use: basic plus all overtime. Earnings and
    // allowances are part of the payslip's gross but not of this one.
    const periodGross = contributionGross(payroll);

    // Month-to-date and already sized for this run. Both halves of each
    // contribution are restated together: they come out of one bracket, and
    // quoting an employee share from one and an employer share from another is
    // how the two ended up disagreeing before.
    return computeContributionsForRun(compensation, {
        payrollId: payroll._id,
        payrollFrom: payroll.payrollFrom,
        periodGross,
        periodBasic: payroll.regularPay ?? 0,
    });
}

/**
 * Restates the runs that come after this one in the same month.
 *
 * PhilHealth on a later run is the month's premium less what the earlier runs
 * took, so correcting the first cutoff leaves the second quoting a remainder
 * worked out against the old figure. Locked runs have been paid and are left
 * as paid, the same rule syncPayrollAttendance follows.
 */
export async function recomputeLaterRunsThisMonth(payroll) {
    const from = new Date(payroll.payrollFrom);
    const nextMonth = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
    );
    const later = await Payroll.find({
        compensation: payroll.compensation,
        payrollFrom: { $gt: from, $lt: nextMonth },
        locked: { $ne: true },
    })
        .sort({ payrollFrom: 1 })
        .select("_id")
        .lean();

    // In order, so each one reads the runs before it already restated.
    for (const p of later)
        await recomputePayrollTotals(p._id, { cascade: false });
}

export async function recomputePayrollTotals(payrollId, { cascade = true } = {}) {
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

    // Contributions on a "gross pay" basis are indexed by what the employee
    // actually earned, so they move every time a record is attached or removed
    // -- which is exactly when this function runs. The other bases read the
    // standing monthly rate and are left as computed at creation, so this
    // cannot quietly restate a historical payroll whose rate table has since
    // been edited.
    const contributions = await recomputeGrossBasisContributions(payroll);

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
            ...contributions,
            withholdingTax: payroll.withholdingTax,
            earnings: sum(earnings),
            allowances: sum(allowances),
            deductions: sum(deductions),
            savings: sum(savingsPayments),
            loans: sum(loanPayments),
            charges: sum(charges),
        });

    const updated = await Payroll.findByIdAndUpdate(
        payrollId,
        {
            earning: earnings.map((r) => r._id),
            allowances: allowances.map((r) => r._id),
            deductions: deductions.map((r) => r._id),
            savings: savingsPayments.map((r) => r._id),
            loans: loanPayments.map((r) => r._id),
            charges: charges.map((r) => r._id),
            ...contributions,
            grossPay,
            totalDeductions,
            netSalary,
            finalPay,
        },
        { new: true },
    );

    if (cascade) await recomputeLaterRunsThisMonth(payroll);
    return updated;
}
