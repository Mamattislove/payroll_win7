import { StatusCodes } from "http-status-codes";
import DeductionPayment from "../models/DeductionPayment.js";
import DeductionRecord from "../models/DeductionRecord.js";
import { NotFoundError } from "../errors/customErrors.js";
import { recomputePayrollTotals } from "../utils/recomputePayroll.js";

const r2 = (n) => Math.round(n * 100) / 100;

const paymentPopulate = [
    {
        path: "deductionRecord",
        select: "name employee deductionType initialAmount currentAmount monthlyDeduction",
        populate: [
            { path: "employee", select: "firstName lastName employeeCode" },
            { path: "deductionType", select: "deductionName" },
        ],
    },
    { path: "payroll", select: "payrollFrom payrollTo" },
];

export const getAllDeductionPayments = async (req, res) => {
    const { page = 1, limit = 50, payroll, deductionRecord } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (payroll) query.payroll = payroll;
    if (deductionRecord) query.deductionRecord = deductionRecord;

    const totalDeductionPayments = await DeductionPayment.countDocuments(query);
    const deductionPayments = await DeductionPayment.find(query)
        .populate(paymentPopulate)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalDeductionPayments,
        totalPages: Math.ceil(totalDeductionPayments / limitNum),
        currentPage: pageNum,
        deductionPayments,
    });
};

export const getDeductionPayment = (req, res) => {
    res.status(StatusCodes.OK).json({ deductionPayment: req.deductionPayment });
};

/**
 * If the client provides employee/deductionType/name (no deductionRecord), a
 * master DeductionRecord is created automatically before the payment.
 * This keeps the frontend to a single POST call for ad-hoc one-time deductions.
 */
export const createDeductionPayment = async (req, res) => {
    let {
        deductionRecord,
        payroll,
        amount,
        deductionDate,
        employee,
        deductionType,
        name,
    } = req.body;
    if (!deductionRecord) {
        const master = await DeductionRecord.create({
            employee,
            deductionType,
            name,
            initialAmount: amount,
            // currentAmount defaults to initialAmount via pre-save hook
        });
        deductionRecord = master._id;
    }

    const payment = await DeductionPayment.create({
        deductionRecord,
        payroll: payroll || null,
        amount,
        deductionDate: deductionDate || null,
    });

    // Always decrement — currentAmount starts at initialAmount and reduces with each payment
    await DeductionRecord.findByIdAndUpdate(deductionRecord, {
        $inc: { currentAmount: -r2(amount) },
    });

    if (payment.payroll) await recomputePayrollTotals(payment.payroll);
    res.status(StatusCodes.CREATED).json({ deductionPayment: payment });
};

export const updateDeductionPayment = async (req, res) => {
    const payment = await DeductionPayment.findByIdAndUpdate(
        req.params.deductionPaymentId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!payment)
        throw new NotFoundError(
            `No deduction payment with id ${req.params.deductionPaymentId}`,
        );
    if (payment.payroll) await recomputePayrollTotals(payment.payroll);
    res.status(StatusCodes.OK).json({ deductionPayment: payment });
};

export const deleteDeductionPayment = async (req, res) => {
    const payment = await DeductionPayment.findByIdAndDelete(
        req.params.deductionPaymentId,
    );
    if (!payment)
        throw new NotFoundError(
            `No deduction payment with id ${req.params.deductionPaymentId}`,
        );

    // Restore the amount to the master record's remaining balance
    await DeductionRecord.findByIdAndUpdate(payment.deductionRecord, {
        $inc: { currentAmount: r2(payment.amount) },
    });

    if (payment.payroll) await recomputePayrollTotals(payment.payroll);
    res.status(StatusCodes.OK).json({ msg: "deduction payment deleted" });
};
