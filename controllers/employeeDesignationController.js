import { StatusCodes } from "http-status-codes";
import EmployeeDesignation from "../models/EmployeeDesignation.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllEmployeeDesignations = async (req, res) => {
    const { page = 1, limit = 10, employee, client, department, position } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (employee) query.employee = employee;
    if (client) query.client = client;
    if (department) query.department = department;
    if (position) query.position = position;

    const totalEmployeeDesignations = await EmployeeDesignation.countDocuments(query);
    const totalPages = Math.ceil(totalEmployeeDesignations / limitNum);

    const employeeDesignations = await EmployeeDesignation.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("client", "clientName")
        .populate("department", "departmentName")
        .populate("position", "positionName")
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalEmployeeDesignations,
        totalPages,
        currentPage: pageNum,
        employeeDesignations,
    });
};

export const getEmployeeDesignation = (req, res) => {
    res.status(StatusCodes.OK).json({ employeeDesignation: req.employeeDesignation });
};

const designationPopulate = [
    { path: "employee", select: "firstName lastName employeeCode" },
    { path: "client", select: "clientName" },
    { path: "department", select: "departmentName" },
    { path: "position", select: "positionName" },
];

export const createEmployeeDesignation = async (req, res) => {
    const employeeDesignation = await EmployeeDesignation.create(req.body);
    await employeeDesignation.populate(designationPopulate);
    res.status(StatusCodes.CREATED).json({ employeeDesignation });
};

export const updateEmployeeDesignation = async (req, res) => {
    const employeeDesignation = await EmployeeDesignation.findByIdAndUpdate(
        req.params.employeeDesignationId,
        req.body,
        { new: true, runValidators: true },
    ).populate(designationPopulate);
    if (!employeeDesignation)
        throw new NotFoundError(
            `No employee designation with id ${req.params.employeeDesignationId}`,
        );
    res.status(StatusCodes.OK).json({ employeeDesignation });
};

export const deleteEmployeeDesignation = async (req, res) => {
    const employeeDesignation = await EmployeeDesignation.findByIdAndDelete(
        req.params.employeeDesignationId,
    );
    if (!employeeDesignation)
        throw new NotFoundError(
            `No employee designation with id ${req.params.employeeDesignationId}`,
        );
    res.status(StatusCodes.OK).json({ msg: "employee designation deleted" });
};
