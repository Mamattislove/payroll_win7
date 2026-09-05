import { StatusCodes } from "http-status-codes";
import SavingsRecord from "../models/SavingsPayment.js";
import { NotFoundError } from "../errors/customErrors.js";
import { recomputePayrollTotals } from "../utils/recomputePayroll.js";

export const getAllSavingsRecords = async (req, res) => {
    const { page = 1, limit = 10, savings } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (savings) query.savings = savings;

    const totalSavingsRecords = await SavingsRecord.countDocuments(query);
    const savingsRecords = await SavingsRecord.find(query)
        .populate("savings")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalSavingsRecords,
        totalPages: Math.ceil(totalSavingsRecords / limitNum),
        currentPage: pageNum,
        savingsRecords,
    });
};

export const getSavingsRecord = (req, res) => {
    res.status(StatusCodes.OK).json({ savingsRecord: req.savingsRecord });
};

export const createSavingsRecord = async (req, res) => {
    const savingsRecord = await SavingsRecord.create(req.body);
    if (savingsRecord.payroll) await recomputePayrollTotals(savingsRecord.payroll);
    res.status(StatusCodes.CREATED).json({ savingsRecord });
};

export const deleteSavingsRecord = async (req, res) => {
    const savingsRecord = await SavingsRecord.findByIdAndDelete(
        req.params.savingsRecordId,
    );
    if (!savingsRecord)
        throw new NotFoundError(
            `No savings deduction record with id ${req.params.savingsRecordId}`,
        );
    if (savingsRecord.payroll) await recomputePayrollTotals(savingsRecord.payroll);
    res.status(StatusCodes.OK).json({ msg: "savings deduction record deleted" });
};
