import { StatusCodes } from "http-status-codes";
import EarningRecord from "../models/EarningRecord.js";
import { NotFoundError } from "../errors/customErrors.js";
import { recomputePayrollTotals } from "../utils/recomputePayroll.js";

export const getAllEarningRecords = async (req, res) => {
    const { page = 1, limit = 50, payroll, employee, earningType } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (payroll) query.payroll = payroll;
    if (employee) query.employee = employee;
    if (earningType) query.earningType = earningType;

    const totalEarningRecords = await EarningRecord.countDocuments(query);
    const earningRecords = await EarningRecord.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("earningType", "earningName")
        .populate("payroll", "payrollFrom payrollTo")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalEarningRecords,
        totalPages: Math.ceil(totalEarningRecords / limitNum),
        currentPage: pageNum,
        earningRecords,
    });
};

export const getEarningRecord = (req, res) => {
    res.status(StatusCodes.OK).json({ earningRecord: req.earningRecord });
};

export const createEarningRecord = async (req, res) => {
    const earningRecord = await EarningRecord.create(req.body);
    if (earningRecord.payroll) await recomputePayrollTotals(earningRecord.payroll);
    res.status(StatusCodes.CREATED).json({ earningRecord });
};

export const updateEarningRecord = async (req, res) => {
    const earningRecord = await EarningRecord.findByIdAndUpdate(
        req.params.earningRecordId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!earningRecord)
        throw new NotFoundError(`No earning record with id ${req.params.earningRecordId}`);
    if (earningRecord.payroll) await recomputePayrollTotals(earningRecord.payroll);
    res.status(StatusCodes.OK).json({ earningRecord });
};

export const deleteEarningRecord = async (req, res) => {
    const earningRecord = await EarningRecord.findByIdAndDelete(req.params.earningRecordId);
    if (!earningRecord)
        throw new NotFoundError(`No earning record with id ${req.params.earningRecordId}`);
    if (earningRecord.payroll) await recomputePayrollTotals(earningRecord.payroll);
    res.status(StatusCodes.OK).json({ msg: "earning record deleted" });
};
