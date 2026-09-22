import Payroll from "../models/Payroll.js";
import EarningRecord from "../models/EarningRecord.js";
import AllowanceRecord from "../models/AllowanceRecord.js";
import DeductionPayment from "../models/DeductionPayment.js";
import SavingsPayment from "../models/SavingsPayment.js";
import LoanPayment from "../models/LoanPayment.js";
import ChargeRecord from "../models/ChargeRecord.js";
import Compensation from "../models/Compensation.js";
import { derivePayrollTotals } from "./payrollTotals.js";
import { computeGovContributions } from "./computeGovContributions.js";
import { contributionFactor } from "./contributionFactor.js";
import { SSS_CONTRIBUTION_BASIS } from "./constants.js";

const r2 = (n) => Math.round(n * 100) / 100;
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
async function recomputeGrossBasisContributions(
    payroll,
    earningsTotal,
    allowancesTotal,
) {
    const stored = {
        sssContribution: payroll.sssContribution,
        philhealthContribution: payroll.philhealthContribution,
        pagibigContribution: payroll.pagibigContribution,
        sssEmployerContribution: payroll.sssEmployerContribution,
        philhealthEmployerContribution: payroll.philhealthEmployerContribution,
        pagibigEmployerContribution: payroll.pagibigEmployerContribution,
    };

    const compensation = await Compensation.findById(
        payroll.compensation,
    ).lean();
    if (!compensation) return stored;

    const bases = [
        compensation.sssContributionBasis,
        compensation.philhealthContributionBasis,
        compensation.pagibigContributionBasis,
    ];
    if (!bases.includes(SSS_CONTRIBUTION_BASIS.GROSS_PAY)) return stored;

    const periodGross =
        (payroll.regularPay ?? 0) +
        (payroll.regularOTPay ?? 0) +
        (payroll.holidayRestDayPay ?? 0) +
        (payroll.holidayRestDayOTPay ?? 0) +
        (payroll.nightDifferentialPay ?? 0) +
        (payroll.leavePay ?? 0) +
        earningsTotal +
        allowancesTotal;

    const year = new Date(payroll.payrollFrom).getFullYear();
    const fresh = await computeGovContributions(compensation, year, {
        periodGross,
    });
    const factor = contributionFactor(
        compensation.payrollPeriod,
        payroll.payrollFrom,
    );

    // Only the bases that are actually "gross pay" are restated; the others
    // keep the figure stored at creation.
    const pick = (i, key) =>
        bases[i] === SSS_CONTRIBUTION_BASIS.GROSS_PAY
            ? r2((fresh[key] ?? 0) * factor)
            : stored[key];

    return {
        sssContribution: pick(0, "sssContribution"),
        philhealthContribution: pick(1, "philhealthContribution"),
        pagibigContribution: pick(2, "pagibigContribution"),
        sssEmployerContribution: pick(0, "sssEmployerContribution"),
        philhealthEmployerContribution: pick(
            1,
            "philhealthEmployerContribution",
        ),
        pagibigEmployerContribution: pick(2, "pagibigEmployerContribution"),
    };
}

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

    // Contributions on a "gross pay" basis are indexed by what the employee
    // actually earned, so they move every time a record is attached or removed
    // -- which is exactly when this function runs. The other bases read the
    // standing monthly rate and are left as computed at creation, so this
    // cannot quietly restate a historical payroll whose rate table has since
    // been edited.
    const contributions = await recomputeGrossBasisContributions(
        payroll,
        sum(earnings),
        sum(allowances),
    );

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

    return Payroll.findByIdAndUpdate(
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
}
