import { StatusCodes } from "http-status-codes";
import ChargeRecord from "../models/ChargeRecord.js";
import { NotFoundError } from "../errors/customErrors.js";
import { recomputePayrollTotals } from "../utils/recomputePayroll.js";

export const getAllChargeRecords = async (req, res) => {
    const { page = 1, limit = 50, payroll, employee, chargeType } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (payroll) query.payroll = payroll;
    if (employee) query.employee = employee;
    if (chargeType) query.chargeType = chargeType;

    const totalChargeRecords = await ChargeRecord.countDocuments(query);
    const chargeRecords = await ChargeRecord.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("chargeType", "chargeName")
        .populate("payroll", "payrollFrom payrollTo")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalChargeRecords,
        totalPages: Math.ceil(totalChargeRecords / limitNum),
        currentPage: pageNum,
        chargeRecords,
    });
};

export const getChargeRecord = (req, res) => {
    res.status(StatusCodes.OK).json({ chargeRecord: req.chargeRecord });
};

export const createChargeRecord = async (req, res) => {
    const chargeRecord = await ChargeRecord.create(req.body);
    if (chargeRecord.payroll) await recomputePayrollTotals(chargeRecord.payroll);
    res.status(StatusCodes.CREATED).json({ chargeRecord });
};

export const updateChargeRecord = async (req, res) => {
    const chargeRecord = await ChargeRecord.findByIdAndUpdate(
        req.params.chargeRecordId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!chargeRecord)
        throw new NotFoundError(`No charge record with id ${req.params.chargeRecordId}`);
    if (chargeRecord.payroll) await recomputePayrollTotals(chargeRecord.payroll);
    res.status(StatusCodes.OK).json({ chargeRecord });
};

export const deleteChargeRecord = async (req, res) => {
    const chargeRecord = await ChargeRecord.findByIdAndDelete(req.params.chargeRecordId);
    if (!chargeRecord)
        throw new NotFoundError(`No charge record with id ${req.params.chargeRecordId}`);
    if (chargeRecord.payroll) await recomputePayrollTotals(chargeRecord.payroll);
    res.status(StatusCodes.OK).json({ msg: "charge record deleted" });
};
