import { StatusCodes } from "http-status-codes";
import Payroll from "../models/Payroll.js";
import Attendance from "../models/Attendance.js";
import EmployeeDesignation from "../models/EmployeeDesignation.js";
import Compensation from "../models/Compensation.js";
import EarningRecord from "../models/EarningRecord.js";
import AllowanceRecord from "../models/AllowanceRecord.js";
import DeductionRecord from "../models/DeductionRecord.js";
import DeductionPayment from "../models/DeductionPayment.js";
import Savings from "../models/Savings.js";
import SavingsPayment from "../models/SavingsPayment.js";
import LoanApplication from "../models/LoanApplication.js";
import LoanPayment from "../models/LoanPayment.js";
import ChargeRecord from "../models/ChargeRecord.js";
import { NotFoundError } from "../errors/customErrors.js";
import { LOAN_STATUS } from "../utils/constants.js";
import { computePayroll } from "../utils/computePayroll.js";
import { recomputePayrollTotals } from "../utils/recomputePayroll.js";
import { syncPayrollAttendance } from "../utils/syncPayrollAttendance.js";
import { computeGovContributions } from "../utils/computeGovContributions.js";
import { contributionFactor } from "../utils/contributionFactor.js";

const r2 = (n) => Math.round(n * 100) / 100;

// Range filters arrive as plain "YYYY-MM-DD". Pin them to UTC day bounds so
// both ends of the range stay inclusive.
const utcDayStart = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00.000Z`);
const utcDayEnd = (d) => new Date(`${String(d).slice(0, 10)}T23:59:59.999Z`);

const compensationPopulate = {
    path: "compensation",
    populate: {
        path: "employeeDesignation",
        populate: [
            { path: "employee", select: "firstName lastName employeeCode" },
            { path: "client", select: "clientName" },
            { path: "department", select: "departmentName" },
            { path: "position", select: "positionName" },
        ],
    },
};

const RECORD_MODELS = {
    earnings: EarningRecord,
    allowances: AllowanceRecord,
    deductions: DeductionPayment,
    charges: ChargeRecord,
};

// Links pre-existing records (selected by id from the form) to a payroll.
async function linkRecords(payrollId, { earnings = [], allowances = [], deductions = [], charges = [] }) {
    const ids = { earnings, allowances, deductions, charges };
    await Promise.all(
        Object.entries(RECORD_MODELS).map(([key, Model]) =>
            ids[key].length
                ? Model.updateMany({ _id: { $in: ids[key] } }, { payroll: payrollId })
                : null,
        ),
    );
}

// Deletes DeductionPayment docs for a payroll and restores loan balances where applicable.
async function unlinkDeductions(paymentDocs) {
    await Promise.all(
        paymentDocs.map(async (payment) => {
            if (payment.deductionRecord) {
                await DeductionRecord.findByIdAndUpdate(
                    payment.deductionRecord,
                    { $inc: { currentAmount: r2(payment.amount) } },
                );
            }
            await DeductionPayment.findByIdAndDelete(payment._id);
        }),
    );
}

// Unlinks earning/allowance/charge records from a payroll (no balance to restore).
async function unlinkSimpleRecords(Model, payrollId) {
    await Model.updateMany({ payroll: payrollId }, { payroll: null });
}

async function replaceSavingsPayments(payrollId, savingsIds) {
    await SavingsPayment.deleteMany({ payroll: payrollId });
    if (savingsIds.length) {
        await SavingsPayment.updateMany({ _id: { $in: savingsIds } }, { payroll: payrollId });
    }
}

async function replaceLoanPayments(payrollId, loanPaymentIds) {
    const current = await LoanPayment.find({ payroll: payrollId });
    await unlinkLoanPayments(current);
    if (loanPaymentIds.length) {
        await LoanPayment.updateMany({ _id: { $in: loanPaymentIds } }, { payroll: payrollId });
    }
}

async function replaceRecords(payrollId, { earnings, allowances, deductions, savings, loans, charges }) {
    if (earnings !== undefined) {
        await unlinkSimpleRecords(EarningRecord, payrollId);
        await linkRecords(payrollId, { earnings });
    }
    if (allowances !== undefined) {
        await unlinkSimpleRecords(AllowanceRecord, payrollId);
        await linkRecords(payrollId, { allowances });
    }
    if (charges !== undefined) {
        await unlinkSimpleRecords(ChargeRecord, payrollId);
        await linkRecords(payrollId, { charges });
    }
    if (deductions !== undefined) {
        const current = await DeductionPayment.find({ payroll: payrollId });
        await unlinkDeductions(current);
        await linkRecords(payrollId, { deductions });
    }
    if (savings !== undefined) {
        await replaceSavingsPayments(payrollId, savings);
    }
    if (loans !== undefined) {
        await replaceLoanPayments(payrollId, loans);
    }
}

const appDateFilter = (payrollTo) => ({
    $or: [{ applicationDate: null }, { applicationDate: { $lte: new Date(payrollTo) } }],
});

const effectiveDateFilter = (payrollTo) => ({
    $or: [{ effectiveDate: null }, { effectiveDate: { $lte: new Date(payrollTo) } }],
});

// Flat/one-time deductions — records with no recurring monthly amount.
// Deducts the entire remaining balance in one payment.
async function generateDeductionInstances(payrollId, employeeId, payrollTo) {
    const records = await DeductionRecord.find({
        employee: employeeId,
        currentAmount: { $gt: 0 },
        // $not: { $gt: 0 } matches null, missing, and 0 in one expression
        monthlyDeduction: { $not: { $gt: 0 } },
        ...appDateFilter(payrollTo),
    });

    for (const record of records) {
        await DeductionPayment.create({
            deductionRecord: record._id,
            payroll: payrollId,
            amount: r2(record.currentAmount),
        });
        record.currentAmount = 0;
        await record.save();
    }
}

async function unlinkLoanPayments(paymentDocs) {
    await Promise.all(
        paymentDocs.map(async (payment) => {
            if (payment.loan) {
                const updated = await LoanApplication.findByIdAndUpdate(
                    payment.loan,
                    { $inc: { loanPayable: r2(payment.amount) } },
                    { new: true },
                );
                // Restore to ONGOING if loanPayable is now positive again --
                // but only for a loan that closed by being paid off. One that
                // was stopped by hand stays stopped, or deleting a payroll
                // would quietly restart deductions someone had paused.
                if (
                    updated &&
                    updated.loanPayable > 0 &&
                    updated.loanStatus === LOAN_STATUS.FULLY_PAID
                ) {
                    await LoanApplication.findByIdAndUpdate(updated._id, {
                        loanStatus: LOAN_STATUS.ONGOING,
                    });
                }
            }
            await LoanPayment.findByIdAndDelete(payment._id);
        }),
    );
}

async function generateLoanApplicationInstances(payrollId, employeeId, payrollTo) {
    // Only "on going" loans are deducted, so a stopped one is skipped here
    // and simply does not appear on the payroll until it is resumed.
    const activeLoans = await LoanApplication.find({
        employee: employeeId,
        loanStatus: LOAN_STATUS.ONGOING,
        isDeleted: "active",
        loanPayable: { $gt: 0 },
        $or: [
            { firstMonthAmortization: null },
            { firstMonthAmortization: { $lte: new Date(payrollTo) } },
        ],
    });

    for (const loan of activeLoans) {
        const paymentAmount = r2(Math.min(loan.monthlyAmortization || 0, loan.loanPayable));
        if (paymentAmount <= 0) continue;

        await LoanPayment.create({
            loan: loan._id,
            payroll: payrollId,
            dateOfPayment: new Date(payrollTo),
            amount: paymentAmount,
        });

        loan.loanPayable = r2(loan.loanPayable - paymentAmount);
        await loan.save();
    }
}

async function generateSavingsInstances(payrollId, employeeId, payrollTo) {
    const activeSavings = await Savings.find({
        employee: employeeId,
        status: "active",
        ...effectiveDateFilter(payrollTo),
    });

    for (const s of activeSavings) {
        await SavingsPayment.create({
            savings: s._id,
            payroll: payrollId,
            amount: s.cutoffDeductionAmount,
        });
    }
}

// Installment/loan deductions — records with a recurring monthly amount.
// Deducts min(monthlyDeduction, currentAmount) per payroll period.
async function generateLoanInstances(payrollId, employeeId, payrollTo) {
    const activeLoans = await DeductionRecord.find({
        employee: employeeId,
        monthlyDeduction: { $gt: 0 },
        currentAmount: { $gt: 0 },
        ...appDateFilter(payrollTo),
    });

    for (const loan of activeLoans) {
        const paymentAmount = Math.min(loan.monthlyDeduction, loan.currentAmount);

        await DeductionPayment.create({
            deductionRecord: loan._id,
            payroll: payrollId,
            amount: paymentAmount,
        });

        loan.currentAmount = r2(loan.currentAmount - paymentAmount);
        await loan.save();
    }
}

// Lightweight summary for the Payslips page: distinct pay periods + how many
// payroll records fall in each, with no populate. The full populated records
// for a period are only fetched on demand (see getAllPayrolls with
// payrollFrom/payrollTo) when the user actually downloads that period's PDFs
// — pulling every payroll record (each with 6 nested populate chains) just to
// list periods was the slow part.
// Payroll carries no direct client reference — it hangs off
// compensation -> employeeDesignation -> client. Resolve a client down to the
// compensation ids sitting underneath it.
async function compensationIdsForClient(client) {
    const designations = await EmployeeDesignation.find({ client }).select("_id");
    const compensations = await Compensation.find({
        employeeDesignation: { $in: designations.map((d) => d._id) },
    }).select("_id");
    return compensations.map((c) => c._id);
}

export const getPayrollPeriods = async (req, res) => {
    const { client } = req.query;

    const pipeline = [];
    if (client) {
        pipeline.push({
            $match: {
                compensation: { $in: await compensationIdsForClient(client) },
            },
        });
    }
    pipeline.push(
        {
            $group: {
                _id: { from: "$payrollFrom", to: "$payrollTo" },
                count: { $sum: 1 },
            },
        },
        { $sort: { "_id.from": -1 } },
    );

    const periods = await Payroll.aggregate(pipeline);

    res.status(StatusCodes.OK).json({
        periods: periods.map((p) => ({
            payrollFrom: p._id.from,
            payrollTo: p._id.to,
            count: p.count,
        })),
    });
};

export const getAllPayrolls = async (req, res) => {
    const { page = 1, limit = 10, compensation, from, to, payrollFrom, payrollTo, client } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (client && !compensation) {
        query.compensation = { $in: await compensationIdsForClient(client) };
    }
    if (compensation) query.compensation = compensation;
    // Matches whole pay periods that fall inside the range, so a range that
    // cuts across a cutoff boundary returns nothing rather than a part period.
    if (from) query.payrollFrom = { $gte: utcDayStart(from) };
    if (to) query.payrollTo = { $lte: utcDayEnd(to) };
    // Exact-match variants (as opposed to from/to above, which are ranges) —
    // used to fetch exactly one pay period's records, e.g. for bulk PDF export.
    if (payrollFrom) query.payrollFrom = new Date(payrollFrom);
    if (payrollTo) query.payrollTo = new Date(payrollTo);

    const totalPayrolls = await Payroll.countDocuments(query);
    const totalPages = Math.ceil(totalPayrolls / limitNum);

    const payrolls = await Payroll.find(query)
        .populate(compensationPopulate)
        .populate("earning", "name amount earningType")
        .populate("allowances", "name amount allowanceType")
        .populate({
            path: "deductions",
            select: "deductionRecord amount deductionDate",
            populate: {
                path: "deductionRecord",
                select: "name employee deductionType initialAmount currentAmount monthlyDeduction",
                populate: [
                    { path: "employee", select: "firstName lastName employeeCode" },
                    { path: "deductionType", select: "deductionName" },
                ],
            },
        })
        .populate({
            path: "savings",
            select: "savings amount",
            populate: {
                path: "savings",
                select: "savingsTarget cutoffDeductionAmount status",
            },
        })
        .populate({
            path: "loans",
            select: "loan amount dateOfPayment",
            populate: {
                path: "loan",
                select: "loanName loanType loanPayable monthlyAmortization loanStatus",
                populate: { path: "loanType", select: "loanTypeName" },
            },
        })
        .populate({
            path: "charges",
            select: "name amount chargeType",
            populate: { path: "chargeType", select: "chargeName" },
        })
        .sort({ payrollFrom: -1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalPayrolls,
        totalPages,
        currentPage: pageNum,
        payrolls,
    });
};

export const getPayroll = (req, res) => {
    res.status(StatusCodes.OK).json({ payroll: req.payroll });
};

export const createPayroll = async (req, res) => {
    const { dailyRate } = req.compensation;
    const {
        compensation,
        payrollFrom,
        payrollTo,
        autoDeductDeductions = false,
        autoDeductLoans = false,
        autoDeductSavings = false,
        autoDeductLoanApplications = false,
        attendance: attendanceIds,
        earnings = [],
        allowances = [],
        deductions = [],
        charges = [],
        ...payrollFields
    } = req.body;

    const attendances =
        attendanceIds?.length > 0
            ? await Attendance.find({ _id: { $in: attendanceIds } })
            : await Attendance.find({
                  compensation,
                  attendanceDate: {
                      $gte: new Date(payrollFrom),
                      $lte: new Date(payrollTo),
                  },
              });

    const {
        regularPay,
        regularOtPay,
        holidayRestDayPay,
        holidayRestDayOtPay,
        nightDiffPay,
        leavePay,
        absences,
        late,
        undertime,
        daysWorked,
        leaveDays,
    } = computePayroll(attendances, dailyRate);

    const year = new Date(payrollFrom).getFullYear();
    const {
        sssContribution: rawSss,
        philhealthContribution: rawPh,
        pagibigContribution: rawPi,
        sssEmployerContribution: rawSssEmp,
        philhealthEmployerContribution: rawPhEmp,
        pagibigEmployerContribution: rawPiEmp,
    } = await computeGovContributions(req.compensation, year);

    // Government contributions are monthly obligations, so each run deducts
    // only its share of the month (see utils/contributionFactor.js).
    const factor = contributionFactor(
        req.compensation.payrollPeriod,
        payrollFrom,
    );
    const sssContribution = r2(rawSss * factor);
    const philhealthContribution = r2(rawPh * factor);
    const pagibigContribution = r2(rawPi * factor);
    const sssEmployerContribution = r2(rawSssEmp * factor);
    const philhealthEmployerContribution = r2(rawPhEmp * factor);
    const pagibigEmployerContribution = r2(rawPiEmp * factor);

    const payroll = await Payroll.create({
        ...payrollFields,
        compensation,
        payrollFrom,
        payrollTo,
        attendance: attendances.map((a) => a._id),
        regularPay,
        regularOTPay: regularOtPay,
        holidayRestDayPay,
        holidayRestDayOTPay: holidayRestDayOtPay,
        nightDifferentialPay: nightDiffPay,
        leavePay,
        absences,
        late,
        undertime,
        daysWorked,
        leaveDays,
        sssContribution,
        philhealthContribution,
        pagibigContribution,
        sssEmployerContribution,
        philhealthEmployerContribution,
        pagibigEmployerContribution,
    });

    const employeeId =
        req.compensation.employeeDesignation?.employee?._id ??
        req.compensation.employeeDesignation?.employee;

    const unlinked = { payroll: null, employee: employeeId };

    // Auto-attach all unlinked standing records for this employee
    await Promise.all([
        EarningRecord.updateMany(unlinked, { payroll: payroll._id }),
        AllowanceRecord.updateMany(unlinked, { payroll: payroll._id }),
        ChargeRecord.updateMany(unlinked, { payroll: payroll._id }),
    ]);

    if (autoDeductDeductions) {
        await generateDeductionInstances(payroll._id, employeeId, payrollTo);
    }
    if (autoDeductLoans) {
        await generateLoanInstances(payroll._id, employeeId, payrollTo);
    }
    if (autoDeductSavings) {
        await generateSavingsInstances(payroll._id, employeeId, payrollTo);
    }
    if (autoDeductLoanApplications) {
        await generateLoanApplicationInstances(payroll._id, employeeId, payrollTo);
    }

    // Link any records explicitly selected by id from the form
    await linkRecords(payroll._id, { earnings, allowances, deductions, charges });

    const updated = await recomputePayrollTotals(payroll._id);
    res.status(StatusCodes.CREATED).json({ payroll: updated });
};

export const updatePayroll = async (req, res) => {
    const payrollId = req.params.payrollId;
    const { earnings, allowances, deductions, charges, ...payrollFields } = req.body;

    const payroll = await Payroll.findByIdAndUpdate(payrollId, payrollFields, {
        new: true,
        runValidators: true,
    });
    if (!payroll) throw new NotFoundError(`No payroll with id ${payrollId}`);

    await replaceRecords(payrollId, { earnings, allowances, deductions, charges });

    // Re-read the attendance rather than trusting what was banked at generation
    // time: the period dates may have just moved, and timekeeping is routinely
    // keyed in or corrected after the run. syncPayrollAttendance recomputes the
    // totals on the way out, so it stands in for recomputePayrollTotals here.
    const updated = await syncPayrollAttendance(payrollId);
    res.status(StatusCodes.OK).json({ payroll: updated });
};

export const deletePayroll = async (req, res) => {
    const payrollId = req.params.payrollId;

    const linkedDeductions = await DeductionPayment.find({ payroll: payrollId });
    const linkedLoanPayments = await LoanPayment.find({ payroll: payrollId });
    await Promise.all([
        unlinkDeductions(linkedDeductions),
        unlinkLoanPayments(linkedLoanPayments),
        SavingsPayment.deleteMany({ payroll: payrollId }),
        unlinkSimpleRecords(EarningRecord, payrollId),
        unlinkSimpleRecords(AllowanceRecord, payrollId),
        unlinkSimpleRecords(ChargeRecord, payrollId),
    ]);

    const payroll = await Payroll.findByIdAndDelete(payrollId);
    if (!payroll) throw new NotFoundError(`No payroll with id ${payrollId}`);
    res.status(StatusCodes.OK).json({ msg: "payroll deleted" });
};

// ─── Dashboard summary ───────────────────────────────────────────────────────

/**
 * Everything the dashboard needs about the payroll cycle, in one round trip.
 *
 * The counts here are aggregations over thousands of records — "which employees
 * have attendance this cutoff but no payroll yet" cannot be answered in the
 * browser without downloading the lot, so it is answered in Mongo instead.
 */
export const getDashboardSummary = async (req, res) => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const dayOfMonth = now.getUTCDate();

    // Semi-monthly cutoffs: the 1st-15th, then the 16th to end of month. Dates
    // are stored at UTC midnight, so build the bounds in UTC to match.
    const isFirstHalf = dayOfMonth <= 15;
    const cutoffFrom = new Date(Date.UTC(year, month, isFirstHalf ? 1 : 16));
    const cutoffTo = isFirstHalf
        ? new Date(Date.UTC(year, month, 15, 23, 59, 59, 999))
        : new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    const inCutoff = {
        payrollFrom: { $gte: cutoffFrom },
        payrollTo: { $lte: cutoffTo },
    };

    const [activeEmployees, processed, withAttendance, paidCompensations, latest] =
        await Promise.all([
            Compensation.countDocuments({ activeStatus: "active" }),
            Payroll.countDocuments(inCutoff),
            Attendance.distinct("compensation", {
                attendanceDate: { $gte: cutoffFrom, $lte: cutoffTo },
            }),
            Payroll.distinct("compensation", inCutoff),
            Payroll.aggregate([
                {
                    $group: {
                        _id: { from: "$payrollFrom", to: "$payrollTo" },
                        count: { $sum: 1 },
                        gross: { $sum: "$grossPay" },
                        deductions: { $sum: "$totalDeductions" },
                        net: { $sum: "$netSalary" },
                    },
                },
                { $sort: { "_id.from": -1 } },
                { $limit: 1 },
            ]),
        ]);

    // Timekeeping is in, but the payroll run has not happened for these people —
    // the usual reason a cutoff silently stalls.
    const paid = new Set(paidCompensations.map(String));
    const awaitingPayroll = withAttendance.filter((c) => !paid.has(String(c)));

    const daysRemaining = Math.max(
        0,
        Math.ceil((cutoffTo - now) / (1000 * 60 * 60 * 24)),
    );

    res.status(StatusCodes.OK).json({
        cutoff: {
            from: cutoffFrom,
            to: cutoffTo,
            daysRemaining,
            activeEmployees,
            processed,
            withAttendance: withAttendance.length,
            awaitingPayroll: awaitingPayroll.length,
        },
        latestPayroll: latest[0]
            ? {
                  from: latest[0]._id.from,
                  to: latest[0]._id.to,
                  count: latest[0].count,
                  gross: latest[0].gross,
                  deductions: latest[0].deductions,
                  net: latest[0].net,
              }
            : null,
    });
};
