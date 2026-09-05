import { StatusCodes } from "http-status-codes";
import Attendance from "../models/Attendance.js";
import Compensation from "../models/Compensation.js";
import EmployeeDesignation from "../models/EmployeeDesignation.js";
import Employee from "../models/Employee.js";
import { NotFoundError } from "../errors/customErrors.js";
import { computeAttendance } from "../utils/computeAttendance.js";
import { syncPayrollsCoveringDates } from "../utils/syncPayrollAttendance.js";
import { employeeNameSearchOr } from "../utils/searchHelpers.js";

// Date filters arrive as plain "YYYY-MM-DD". Attendance dates are stored at
// UTC midnight, so pin each bound to the UTC day boundary to keep both ends
// of the range inclusive.
const utcDayStart = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00.000Z`);
const utcDayEnd = (d) => new Date(`${String(d).slice(0, 10)}T23:59:59.999Z`);

export const getAllAttendances = async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        compensation,
        client,
        dayType,
        dateFrom,
        dateTo,
        zeroHours,
        sort = "desc",
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    const compensationIdSets = [];

    if (search) {
        // Attendance -> compensation -> employeeDesignation -> employee
        // Resolve the employee search down to a list of compensation ids,
        // since Mongoose can't filter a find() by a populated/nested field.
        const employees = await Employee.find({
            $or: employeeNameSearchOr(search),
        }).select("_id");

        const designations = await EmployeeDesignation.find({
            employee: { $in: employees.map((e) => e._id) },
        }).select("_id");

        const compensations = await Compensation.find({
            employeeDesignation: { $in: designations.map((d) => d._id) },
        }).select("_id");

        compensationIdSets.push(compensations.map((c) => String(c._id)));
    }
    if (client) {
        const designations = await EmployeeDesignation.find({ client }).select("_id");
        const compIds = await Compensation.find({
            employeeDesignation: { $in: designations.map((d) => d._id) },
        }).select("_id");
        compensationIdSets.push(compIds.map((c) => String(c._id)));
    }
    if (compensation) compensationIdSets.push([String(compensation)]);

    // search, client and compensation each narrow attendance down to a set of
    // compensation ids. Intersect them so combining filters keeps every
    // condition, instead of the last one overwriting the others.
    if (compensationIdSets.length) {
        query.compensation = {
            $in: compensationIdSets.reduce((acc, ids) => {
                const set = new Set(ids);
                return acc.filter((id) => set.has(id));
            }),
        };
    }
    if (dayType) query.dayType = dayType;
    if (dateFrom || dateTo) {
        query.attendanceDate = {};
        if (dateFrom) query.attendanceDate.$gte = utcDayStart(dateFrom);
        if (dateTo) query.attendanceDate.$lte = utcDayEnd(dateTo);
    }
    if (zeroHours === "true") {
        query.regularHours = 0;
        query.nightPremiumHours = 0;
    }

    const totalAttendances = await Attendance.countDocuments(query);
    const totalPages = Math.ceil(totalAttendances / limitNum);

    const attendances = await Attendance.find(query)
        .populate({
            path: "compensation",
            populate: {
                path: "employeeDesignation",
                populate: {
                    path: "employee",
                    select: "firstName lastName employeeCode",
                },
            },
        })
        .sort({ attendanceDate: sort === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalAttendances,
        totalPages,
        currentPage: pageNum,
        attendances,
    });
};

export const getAttendance = (req, res) => {
    res.status(StatusCodes.OK).json({ attendance: req.attendance });
};

export const createAttendance = async (req, res) => {
    const { dailyRate } = req.compensation;
    const {
        dayType,
        regularHours,
        overtimeHours,
        nightPremiumHours,
        overtimeNightPremiumHours,
        lateHr,
        undertimeHr,
    } = req.body;

    const computed = computeAttendance({
        dailyRate,
        dayType,
        regularHours,
        overtimeHours,
        nightPremiumHours,
        overtimeNightPremiumHours,
        lateHr,
        undertimeHr,
    });

    const attendance = await Attendance.create({ ...req.body, ...computed });
    // A payroll may already exist for the period this day lands in. Push the
    // change through to it, or the payroll keeps the figures it was generated
    // with and the journal prints timekeeping that no longer exists.
    await syncPayrollsCoveringDates(attendance.compensation, [
        attendance.attendanceDate,
    ]);
    res.status(StatusCodes.CREATED).json({ attendance });
};

export const bulkCreateAttendance = async (req, res) => {
    const { dailyRate } = req.compensation;
    const { compensation, records } = req.body;

    const dates = records.map((r) => new Date(r.attendanceDate));
    const existing = await Attendance.find({
        compensation,
        attendanceDate: { $in: dates },
    }).select("attendanceDate");
    const existingDates = new Set(
        existing.map((e) => e.attendanceDate.toISOString()),
    );

    const toCreate = [];
    const skipped = [];
    for (const r of records) {
        const dateKey = new Date(r.attendanceDate).toISOString();
        if (existingDates.has(dateKey)) {
            skipped.push(r.attendanceDate);
            continue;
        }
        const computed = computeAttendance({
            dailyRate,
            dayType: r.dayType,
            regularHours: r.regularHours,
            overtimeHours: r.overtimeHours,
            nightPremiumHours: r.nightPremiumHours,
            overtimeNightPremiumHours: r.overtimeNightPremiumHours,
            lateHr: r.lateHr,
            undertimeHr: r.undertimeHr,
        });
        toCreate.push({
            compensation,
            attendanceDate: r.attendanceDate,
            dayType: r.dayType,
            remarks: r.remarks,
            ...computed,
        });
    }

    const created = toCreate.length
        ? await Attendance.insertMany(toCreate)
        : [];

    await syncPayrollsCoveringDates(
        compensation,
        created.map((a) => a.attendanceDate),
    );

    res.status(StatusCodes.CREATED).json({
        createdCount: created.length,
        skipped,
        attendances: created,
    });
};

export const updateAttendance = async (req, res) => {
    const existing = req.attendance;
    const { dailyRate } = existing.compensation;

    const computed = computeAttendance({
        dailyRate,
        dayType: req.body.dayType ?? existing.dayType,
        regularHours: req.body.regularHours ?? existing.regularHours,
        overtimeHours: req.body.overtimeHours ?? existing.overtimeHours,
        nightPremiumHours:
            req.body.nightPremiumHours ?? existing.nightPremiumHours,
        overtimeNightPremiumHours:
            req.body.overtimeNightPremiumHours ??
            existing.overtimeNightPremiumHours,
        lateHr: req.body.lateHr ?? existing.lateHr,
        undertimeHr: req.body.undertimeHr ?? existing.undertimeHr,
    });

    const attendance = await Attendance.findByIdAndUpdate(
        req.params.attendanceId,
        { ...req.body, ...computed },
        { new: true, runValidators: true },
    );
    if (!attendance)
        throw new NotFoundError(
            `No attendance with id ${req.params.attendanceId}`,
        );
    // Sync both dates: moving a day out of one pay period and into another
    // leaves two payrolls needing a refresh, not one.
    await syncPayrollsCoveringDates(attendance.compensation, [
        attendance.attendanceDate,
        existing.attendanceDate,
    ]);
    res.status(StatusCodes.OK).json({ attendance });
};

export const deleteAttendance = async (req, res) => {
    const attendance = await Attendance.findByIdAndDelete(
        req.params.attendanceId,
    );
    if (!attendance)
        throw new NotFoundError(
            `No attendance with id ${req.params.attendanceId}`,
        );
    await syncPayrollsCoveringDates(attendance.compensation, [
        attendance.attendanceDate,
    ]);
    res.status(StatusCodes.OK).json({ msg: "attendance deleted" });
};
