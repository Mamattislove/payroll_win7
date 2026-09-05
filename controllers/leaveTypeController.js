import { StatusCodes } from "http-status-codes";
import LeaveType from "../models/LeaveType.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllLeaveTypes = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = search ? { leaveTypeName: { $regex: search, $options: "i" } } : {};
    const totalLeaveTypes = await LeaveType.countDocuments(query);
    const leaveTypes = await LeaveType.find(query)
        .sort({ leaveTypeName: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalLeaveTypes, totalPages: Math.ceil(totalLeaveTypes / limitNum), currentPage: pageNum, leaveTypes });
};

export const getLeaveType = (req, res) => {
    res.status(StatusCodes.OK).json({ leaveType: req.leaveType });
};

export const createLeaveType = async (req, res) => {
    const leaveType = await LeaveType.create(req.body);
    res.status(StatusCodes.CREATED).json({ leaveType });
};

export const updateLeaveType = async (req, res) => {
    const leaveType = await LeaveType.findByIdAndUpdate(req.params.leaveTypeId, req.body, { new: true, runValidators: true });
    if (!leaveType) throw new NotFoundError(`No leave type with id ${req.params.leaveTypeId}`);
    res.status(StatusCodes.OK).json({ leaveType });
};

export const deleteLeaveType = async (req, res) => {
    const leaveType = await LeaveType.findByIdAndDelete(req.params.leaveTypeId);
    if (!leaveType) throw new NotFoundError(`No leave type with id ${req.params.leaveTypeId}`);
    res.status(StatusCodes.OK).json({ msg: "leave type deleted" });
};
