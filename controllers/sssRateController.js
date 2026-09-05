import { StatusCodes } from "http-status-codes";
import SSSRate from "../models/SSSRate.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllSSSRates = async (req, res) => {
    const { page = 1, limit = 50, year } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (year) query.year = Number(year);

    const totalSSSRates = await SSSRate.countDocuments(query);
    const sssRates = await SSSRate.find(query)
        .sort({ year: -1, msc: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalSSSRates,
        totalPages: Math.ceil(totalSSSRates / limitNum),
        currentPage: pageNum,
        sssRates,
    });
};

export const getSSSRate = (req, res) => {
    res.status(StatusCodes.OK).json({ sssRate: req.sssRate });
};

export const createSSSRate = async (req, res) => {
    const sssRate = await SSSRate.create(req.body);
    res.status(StatusCodes.CREATED).json({ sssRate });
};

export const updateSSSRate = async (req, res) => {
    const sssRate = await SSSRate.findByIdAndUpdate(
        req.params.sssRateId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!sssRate)
        throw new NotFoundError(`No SSS rate with id ${req.params.sssRateId}`);
    res.status(StatusCodes.OK).json({ sssRate });
};

export const deleteSSSRate = async (req, res) => {
    const sssRate = await SSSRate.findByIdAndDelete(req.params.sssRateId);
    if (!sssRate)
        throw new NotFoundError(`No SSS rate with id ${req.params.sssRateId}`);
    res.status(StatusCodes.OK).json({ msg: "SSS rate deleted" });
};
