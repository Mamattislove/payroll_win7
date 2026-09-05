import { StatusCodes } from "http-status-codes";
import LeaveApplication from "../models/LeaveApplication.js";
import { NotFoundError } from "../errors/customErrors.js";
import { LEAVE_STATUS } from "../utils/constants.js";

const SORTABLE_FIELDS = ["dateFrom", "dateTo"];

export const getAllLeaveApplications = async (req, res) => {
    const { page = 1, limit = 10, employee, status, sort = "-dateFrom" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = {};
    if (employee) query.employee = employee;
    if (status) query.status = status;

    const sortDesc = sort.startsWith("-");
    const sortField = sortDesc ? sort.slice(1) : sort;
    const sortBy = SORTABLE_FIELDS.includes(sortField) ? sortField : "dateFrom";

    const totalLeaveApplications = await LeaveApplication.countDocuments(query);
    const leaveApplications = await LeaveApplication.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("leaveType", "leaveTypeName")
        .sort({ [sortBy]: sortDesc ? -1 : 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalLeaveApplications, totalPages: Math.ceil(totalLeaveApplications / limitNum), currentPage: pageNum, leaveApplications });
};

export const getLeaveApplication = (req, res) => {
    res.status(StatusCodes.OK).json({ leaveApplication: req.leaveApplication });
};

export const createLeaveApplication = async (req, res) => {
    const leaveApplication = await LeaveApplication.create(req.body);
    res.status(StatusCodes.CREATED).json({ leaveApplication });
};

export const updateLeaveApplication = async (req, res) => {
    const leaveApplication = await LeaveApplication.findByIdAndUpdate(req.params.leaveApplicationId, req.body, { new: true, runValidators: true });
    if (!leaveApplication) throw new NotFoundError(`No leave application with id ${req.params.leaveApplicationId}`);
    res.status(StatusCodes.OK).json({ leaveApplication });
};

export const deleteLeaveApplication = async (req, res) => {
    const leaveApplication = await LeaveApplication.findByIdAndDelete(req.params.leaveApplicationId);
    if (!leaveApplication) throw new NotFoundError(`No leave application with id ${req.params.leaveApplicationId}`);
    res.status(StatusCodes.OK).json({ msg: "leave application deleted" });
};
