import { StatusCodes } from "http-status-codes";
import Holiday from "../models/Holiday.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllHolidays = async (req, res) => {
    const { page = 1, limit = 10, year } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = {};
    if (year) {
        const y = Number(year);
        query.date = { $gte: new Date(`${y}-01-01`), $lte: new Date(`${y}-12-31`) };
    }
    const totalHolidays = await Holiday.countDocuments(query);
    const holidays = await Holiday.find(query)
        .sort({ date: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalHolidays, totalPages: Math.ceil(totalHolidays / limitNum), currentPage: pageNum, holidays });
};

export const getHoliday = (req, res) => {
    res.status(StatusCodes.OK).json({ holiday: req.holiday });
};

export const createHoliday = async (req, res) => {
    const holiday = await Holiday.create(req.body);
    res.status(StatusCodes.CREATED).json({ holiday });
};

export const updateHoliday = async (req, res) => {
    const holiday = await Holiday.findByIdAndUpdate(req.params.holidayId, req.body, { new: true, runValidators: true });
    if (!holiday) throw new NotFoundError(`No holiday with id ${req.params.holidayId}`);
    res.status(StatusCodes.OK).json({ holiday });
};

export const deleteHoliday = async (req, res) => {
    const holiday = await Holiday.findByIdAndDelete(req.params.holidayId);
    if (!holiday) throw new NotFoundError(`No holiday with id ${req.params.holidayId}`);
    res.status(StatusCodes.OK).json({ msg: "holiday deleted" });
};
