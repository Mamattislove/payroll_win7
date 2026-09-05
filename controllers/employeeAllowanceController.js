import { StatusCodes } from "http-status-codes";
import EmployeeAllowance from "../models/EmployeeAllowance.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllEmployeeAllowances = async (req, res) => {
    const { page = 1, limit = 10, employee, activeStatus } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = {};
    if (employee) query.employee = employee;
    if (activeStatus) query.activeStatus = activeStatus;
    const totalEmployeeAllowances = await EmployeeAllowance.countDocuments(query);
    const employeeAllowances = await EmployeeAllowance.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("allowanceType", "allowanceName")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalEmployeeAllowances, totalPages: Math.ceil(totalEmployeeAllowances / limitNum), currentPage: pageNum, employeeAllowances });
};

export const getEmployeeAllowance = (req, res) => {
    res.status(StatusCodes.OK).json({ employeeAllowance: req.employeeAllowance });
};

export const createEmployeeAllowance = async (req, res) => {
    const employeeAllowance = await EmployeeAllowance.create(req.body);
    res.status(StatusCodes.CREATED).json({ employeeAllowance });
};

export const updateEmployeeAllowance = async (req, res) => {
    const employeeAllowance = await EmployeeAllowance.findByIdAndUpdate(req.params.employeeAllowanceId, req.body, { new: true, runValidators: true });
    if (!employeeAllowance) throw new NotFoundError(`No employee allowance with id ${req.params.employeeAllowanceId}`);
    res.status(StatusCodes.OK).json({ employeeAllowance });
};

export const deleteEmployeeAllowance = async (req, res) => {
    const employeeAllowance = await EmployeeAllowance.findByIdAndDelete(req.params.employeeAllowanceId);
    if (!employeeAllowance) throw new NotFoundError(`No employee allowance with id ${req.params.employeeAllowanceId}`);
    res.status(StatusCodes.OK).json({ msg: "employee allowance deleted" });
};
