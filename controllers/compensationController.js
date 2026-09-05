import { StatusCodes } from "http-status-codes";
import Compensation from "../models/Compensation.js";
import Employee from "../models/Employee.js";
import EmployeeDesignation from "../models/EmployeeDesignation.js";
import { NotFoundError } from "../errors/customErrors.js";
import { COMPENSATION_STATUS } from "../utils/constants.js";
import { employeeNameSearchOr } from "../utils/searchHelpers.js";

export const getAllCompensations = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        employeeDesignation,
        activeStatus,
        client,
        search = "",
        employeeStatus = "",
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (employeeDesignation) query.employeeDesignation = employeeDesignation;
    if (activeStatus) query.activeStatus = activeStatus;

    // Employee-picker comboboxes search compensations by employee name/code,
    // and can restrict to a given Employee.employmentStatus (e.g. "active" so
    // you can't log new attendance against a resigned/terminated employee) or
    // to a single client. Compensation stores neither the employee nor the
    // client directly — both hang off EmployeeDesignation — so resolve down to
    // the matching designations and restrict the compensation query to those,
    // rather than loading every compensation to filter client-side.
    if (search || employeeStatus || client) {
        const designationQuery = {};

        // client sits on the designation, so it narrows the same lookup.
        if (client) designationQuery.client = client;

        if (search || employeeStatus) {
            const employeeQuery = {};
            if (search) {
                employeeQuery.$or = employeeNameSearchOr(search);
            }
            if (employeeStatus) {
                const escaped = employeeStatus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                employeeQuery.employmentStatus = { $regex: `^${escaped}$`, $options: "i" };
            }
            const matchingEmployees = await Employee.find(employeeQuery, "_id");
            designationQuery.employee = {
                $in: matchingEmployees.map((e) => e._id),
            };
        }

        const designations = await EmployeeDesignation.find(designationQuery, "_id");
        query.employeeDesignation = { $in: designations.map((d) => d._id) };
    }

    const totalCompensations = await Compensation.countDocuments(query);
    const totalPages = Math.ceil(totalCompensations / limitNum);

    const compensations = await Compensation.find(query)
        .populate({
            path: "employeeDesignation",
            populate: [
                { path: "employee", select: "firstName lastName employeeCode" },
                { path: "client", select: "clientName" },
                { path: "department", select: "departmentName" },
                { path: "position", select: "positionName" },
            ],
        })
        // "active" sorts before "inactive" — when a name/code matches more than one
        // compensation (e.g. duplicate employee records), surface the live one first
        // instead of an arbitrary insertion-order pick with no payroll history.
        .sort({ activeStatus: 1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalCompensations,
        totalPages,
        currentPage: pageNum,
        compensations,
    });
};

export const getCompensation = (req, res) => {
    res.status(StatusCodes.OK).json({ compensation: req.compensation });
};

export const createCompensation = async (req, res) => {
    const compensation = await Compensation.create(req.body);
    res.status(StatusCodes.CREATED).json({ compensation });
};

export const updateCompensation = async (req, res) => {
    const compensation = await Compensation.findByIdAndUpdate(
        req.params.compensationId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!compensation)
        throw new NotFoundError(
            `No compensation with id ${req.params.compensationId}`,
        );
    res.status(StatusCodes.OK).json({ compensation });
};

export const deleteCompensation = async (req, res) => {
    const compensation = await Compensation.findByIdAndUpdate(
        req.params.compensationId,
        { activeStatus: COMPENSATION_STATUS.INACTIVE },
        { new: true },
    );
    if (!compensation)
        throw new NotFoundError(
            `No compensation with id ${req.params.compensationId}`,
        );
    res.status(StatusCodes.OK).json({ compensation });
};
