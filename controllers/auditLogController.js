import { StatusCodes } from "http-status-codes";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";

const utcDayStart = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00.000Z`);
const utcDayEnd = (d) => new Date(`${String(d).slice(0, 10)}T23:59:59.999Z`);

export const getAllAuditLogs = async (req, res) => {
    const {
        page = 1,
        limit = 25,
        user,
        action,
        resource,
        dateFrom,
        dateTo,
        search,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (user) query.user = user;
    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = utcDayStart(dateFrom);
        if (dateTo) query.createdAt.$lte = utcDayEnd(dateTo);
    }
    if (search) {
        const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = { $regex: escaped, $options: "i" };
        query.$or = [{ username: rx }, { path: rx }, { resource: rx }];
    }

    const [total, logs] = await Promise.all([
        AuditLog.countDocuments(query),
        AuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
    ]);

    res.status(StatusCodes.OK).json({
        totalLogs: total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        logs,
    });
};

/** Populates the filter dropdowns without the client loading every log row. */
export const getAuditLogFilters = async (req, res) => {
    const [users, resources] = await Promise.all([
        User.find({}).select("username role").sort({ username: 1 }).lean(),
        AuditLog.distinct("resource"),
    ]);

    res.status(StatusCodes.OK).json({
        users,
        resources: resources.filter(Boolean).sort(),
    });
};
