import { StatusCodes } from "http-status-codes";
import LeaveApplication from "../models/LeaveApplication.js";
import EmployeeDesignation from "../models/EmployeeDesignation.js";
import { NotFoundError } from "../errors/customErrors.js";
import { LEAVE_STATUS } from "../utils/constants.js";

const SORTABLE_FIELDS = ["dateFrom", "dateTo"];

// Range filters arrive as plain "YYYY-MM-DD". Pin them to UTC day bounds so
// both ends of the range stay inclusive.
const utcDayStart = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00.000Z`);
const utcDayEnd = (d) => new Date(`${String(d).slice(0, 10)}T23:59:59.999Z`);

// A leave belongs to a client through the employee's designation; the leave
// record itself carries no client. More than one designation can point at the
// same employee, so the ids are de-duplicated.
const employeeIdsForClient = async (client, department) => {
    const filter = {};
    if (client) filter.client = client;
    if (department) filter.department = department;
    const designations = await EmployeeDesignation.find(filter).select(
        "employee",
    );
    return [...new Set(designations.map((d) => String(d.employee)))];
};

export const getAllLeaveApplications = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        employee,
        status,
        client,
        department,
        from,
        to,
        sort = "-dateFrom",
    } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = {};
    if (employee) query.employee = employee;
    if (status) query.status = status;
    if ((client || department) && !employee)
        query.employee = {
            $in: await employeeIdsForClient(client, department),
        };
    // Overlap, not containment: a leave that starts before the range and ends
    // inside it was still taken during the period being reported on.
    if (from) query.dateTo = { $gte: utcDayStart(from) };
    if (to) query.dateFrom = { $lte: utcDayEnd(to) };

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
