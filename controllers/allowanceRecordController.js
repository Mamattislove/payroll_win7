import { StatusCodes } from "http-status-codes";
import AllowanceRecord from "../models/AllowanceRecord.js";
import { NotFoundError } from "../errors/customErrors.js";
import { recomputePayrollTotals } from "../utils/recomputePayroll.js";

export const getAllAllowanceRecords = async (req, res) => {
    const { page = 1, limit = 50, payroll, employee, allowanceType } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (payroll) query.payroll = payroll;
    if (employee) query.employee = employee;
    if (allowanceType) query.allowanceType = allowanceType;

    const totalAllowanceRecords = await AllowanceRecord.countDocuments(query);
    const allowanceRecords = await AllowanceRecord.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("allowanceType", "allowanceName")
        .populate("payroll", "payrollFrom payrollTo")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalAllowanceRecords,
        totalPages: Math.ceil(totalAllowanceRecords / limitNum),
        currentPage: pageNum,
        allowanceRecords,
    });
};

export const getAllowanceRecord = (req, res) => {
    res.status(StatusCodes.OK).json({ allowanceRecord: req.allowanceRecord });
};

export const createAllowanceRecord = async (req, res) => {
    const allowanceRecord = await AllowanceRecord.create(req.body);
    if (allowanceRecord.payroll) await recomputePayrollTotals(allowanceRecord.payroll);
    res.status(StatusCodes.CREATED).json({ allowanceRecord });
};

export const updateAllowanceRecord = async (req, res) => {
    const allowanceRecord = await AllowanceRecord.findByIdAndUpdate(
        req.params.allowanceRecordId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!allowanceRecord)
        throw new NotFoundError(`No allowance record with id ${req.params.allowanceRecordId}`);
    if (allowanceRecord.payroll) await recomputePayrollTotals(allowanceRecord.payroll);
    res.status(StatusCodes.OK).json({ allowanceRecord });
};

export const deleteAllowanceRecord = async (req, res) => {
    const allowanceRecord = await AllowanceRecord.findByIdAndDelete(req.params.allowanceRecordId);
    if (!allowanceRecord)
        throw new NotFoundError(`No allowance record with id ${req.params.allowanceRecordId}`);
    if (allowanceRecord.payroll) await recomputePayrollTotals(allowanceRecord.payroll);
    res.status(StatusCodes.OK).json({ msg: "allowance record deleted" });
};
