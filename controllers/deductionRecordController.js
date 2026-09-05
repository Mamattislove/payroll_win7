import { StatusCodes } from "http-status-codes";
import DeductionRecord from "../models/DeductionRecord.js";
import DeductionPayment from "../models/DeductionPayment.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllDeductionRecords = async (req, res) => {
    const { page = 1, limit = 50, employee, deductionType } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (employee) query.employee = employee;
    if (deductionType) query.deductionType = deductionType;

    const totalDeductionRecords = await DeductionRecord.countDocuments(query);
    const deductionRecords = await DeductionRecord.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("deductionType", "deductionName")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalDeductionRecords,
        totalPages: Math.ceil(totalDeductionRecords / limitNum),
        currentPage: pageNum,
        deductionRecords,
    });
};

export const getDeductionRecord = (req, res) => {
    res.status(StatusCodes.OK).json({ deductionRecord: req.deductionRecord });
};

export const createDeductionRecord = async (req, res) => {
    const deductionRecord = await DeductionRecord.create(req.body);
    res.status(StatusCodes.CREATED).json({ deductionRecord });
};

export const updateDeductionRecord = async (req, res) => {
    const deductionRecord = await DeductionRecord.findByIdAndUpdate(
        req.params.deductionRecordId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!deductionRecord)
        throw new NotFoundError(`No deduction record with id ${req.params.deductionRecordId}`);
    res.status(StatusCodes.OK).json({ deductionRecord });
};

export const deleteDeductionRecord = async (req, res) => {
    const deductionRecord = await DeductionRecord.findByIdAndDelete(req.params.deductionRecordId);
    if (!deductionRecord)
        throw new NotFoundError(`No deduction record with id ${req.params.deductionRecordId}`);
    // Orphan any payments that referenced this master (they already settled, leave amounts intact)
    await DeductionPayment.updateMany(
        { deductionRecord: deductionRecord._id },
        { deductionRecord: null },
    );
    res.status(StatusCodes.OK).json({ msg: "deduction record deleted" });
};
