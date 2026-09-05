import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import { NotFoundError } from "../errors/customErrors.js";
import { EMPLOYMENT_STATUS } from "../utils/constants.js";
import { employeeNameSearchOr } from "../utils/searchHelpers.js";

export const getAllEmployees = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        search = "",
        status = "",
        gender = "",
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (search) {
        query.$or = employeeNameSearchOr(search);
    }
    if (status) {
        const escaped = status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.employmentStatus = { $regex: `^${escaped}$`, $options: "i" };
    }
    if (gender) query.gender = gender;

    const totalEmployees = await Employee.countDocuments(query);
    const totalPages = Math.ceil(totalEmployees / limitNum);

    const employees = await Employee.find(query).skip(skip).limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalEmployees,
        totalPages,
        currentPage: pageNum,
        employees,
    });
};

// Employee list annotated with each employee's current compensation (if any),
// filterable by hasComp=yes/no. Joins + paginates server-side via aggregation
// instead of shipping full employees/compensations collections to the client.
export const getEmployeesWithCompensation = async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search = "",
        hasComp = "",
        status = "",
        client = "",
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const matchStage = {};
    if (search) {
        matchStage.$or = employeeNameSearchOr(search);
    }
    if (status) {
        const escaped = status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        matchStage.employmentStatus = { $regex: `^${escaped}$`, $options: "i" };
    }

    const pipeline = [
        { $match: matchStage },
        {
            $lookup: {
                from: "employeedesignations",
                localField: "_id",
                foreignField: "employee",
                as: "designations",
            },
        },
        {
            $lookup: {
                from: "compensations",
                localField: "designations._id",
                foreignField: "employeeDesignation",
                as: "compensationDocs",
            },
        },
        {
            $addFields: {
                compensation: {
                    $ifNull: [{ $arrayElemAt: ["$compensationDocs", 0] }, null],
                },
                designation: {
                    $ifNull: [{ $arrayElemAt: ["$designations", 0] }, null],
                },
            },
        },
        // Where the employee is deployed. client/department/position hang off
        // the designation, so they need resolving before they can be shown.
        {
            $lookup: {
                from: "clients",
                localField: "designation.client",
                foreignField: "_id",
                as: "clientDoc",
            },
        },
        {
            $lookup: {
                from: "departments",
                localField: "designation.department",
                foreignField: "_id",
                as: "departmentDoc",
            },
        },
        {
            $lookup: {
                from: "positions",
                localField: "designation.position",
                foreignField: "_id",
                as: "positionDoc",
            },
        },
        {
            $addFields: {
                client: { $arrayElemAt: ["$clientDoc", 0] },
                department: { $arrayElemAt: ["$departmentDoc", 0] },
                position: { $arrayElemAt: ["$positionDoc", 0] },
            },
        },
    ];

    // Matches any of the employee's designations, not just the first, so an
    // employee posted to two clients still appears under both.
    if (client && mongoose.isValidObjectId(client)) {
        pipeline.push({
            $match: {
                "designations.client": new mongoose.Types.ObjectId(client),
            },
        });
    }

    if (hasComp === "yes") pipeline.push({ $match: { compensation: { $ne: null } } });
    if (hasComp === "no") pipeline.push({ $match: { compensation: null } });

    pipeline.push(
        // Surname first, matching how the column renders the name. Collation is
        // required, not cosmetic: the default byte sort puts Ñ after Z and any
        // lower-case surname after every upper-case one.
        { $sort: { lastName: 1, firstName: 1 } },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limitNum },
                    {
                        $project: {
                            firstName: 1,
                            middleName: 1,
                            lastName: 1,
                            employeeCode: 1,
                            employedSince: 1,
                            employmentStatus: 1,
                            "client._id": 1,
                            "client.clientName": 1,
                            "client.clientAddress": 1,
                            "department.departmentName": 1,
                            "position.positionName": 1,
                            "compensation._id": 1,
                            "compensation.employeeDesignation": 1,
                            "compensation.dailyRate": 1,
                            "compensation.monthlyRate": 1,
                            "compensation.payrollPeriod": 1,
                            "compensation.contractType": 1,
                            "compensation.employmentType": 1,
                            "compensation.startContract": 1,
                            "compensation.endContract": 1,
                            "compensation.activeStatus": 1,
                        },
                    },
                ],
                totalCount: [{ $count: "count" }],
            },
        },
    );

    const [result] = await Employee.aggregate(pipeline).collation({
        locale: "en",
        strength: 1,
    });
    const employees = result.data;
    const totalEmployees = result.totalCount[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(totalEmployees / limitNum));

    res.status(StatusCodes.OK).json({
        employees,
        totalEmployees,
        totalPages,
        currentPage: pageNum,
    });
};

export const getNextEmployeeCode = async (req, res) => {
    const prefix = req.query.prefix?.trim().toUpperCase();
    if (!prefix) return res.status(StatusCodes.BAD_REQUEST).json({ msg: "prefix is required" });

    const employees = await Employee.find(
        { employeeCode: { $regex: `^${prefix}-`, $options: "i" } },
        "employeeCode",
    );

    let maxNum = 0;
    for (const emp of employees) {
        const num = parseInt(emp.employeeCode.slice(prefix.length + 1), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    res.status(StatusCodes.OK).json({ nextSuffix: String(maxNum + 1).padStart(5, "0") });
};

export const getEmployee = (req, res) => {
    res.status(StatusCodes.OK).json({ employee: req.employee });
};

export const createEmployee = async (req, res) => {
    const employee = await Employee.create(req.body);
    res.status(StatusCodes.CREATED).json({ employee });
};

export const updateEmployee = async (req, res) => {
    const { employeeId } = req.params;
    const employee = await Employee.findByIdAndUpdate(employeeId, req.body, {
        new: true,
        runValidators: true,
    });
    res.status(StatusCodes.OK).json({ employee });
};

export const deleteEmployee = async (req, res) => {
    const { employeeId } = req.params;
    const employee = await Employee.findByIdAndUpdate(
        employeeId,
        { employmentStatus: EMPLOYMENT_STATUS.INACTIVE },
        { new: true },
    );
    res.status(StatusCodes.OK).json({ employee });
};
