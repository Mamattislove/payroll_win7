import { StatusCodes } from "http-status-codes";
import PhilHealthRate from "../models/PhilHealthRate.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllPhilHealthRates = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const totalPhilHealthRates = await PhilHealthRate.countDocuments();
    const philHealthRates = await PhilHealthRate.find()
        .sort({ year: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({
        totalPhilHealthRates,
        totalPages: Math.ceil(totalPhilHealthRates / limitNum),
        currentPage: pageNum,
        philHealthRates,
    });
};

export const getPhilHealthRate = (req, res) => {
    res.status(StatusCodes.OK).json({ philHealthRate: req.philHealthRate });
};

export const createPhilHealthRate = async (req, res) => {
    const philHealthRate = await PhilHealthRate.create(req.body);
    res.status(StatusCodes.CREATED).json({ philHealthRate });
};

export const updatePhilHealthRate = async (req, res) => {
    const philHealthRate = await PhilHealthRate.findByIdAndUpdate(
        req.params.philHealthRateId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!philHealthRate)
        throw new NotFoundError(
            `No PhilHealth rate with id ${req.params.philHealthRateId}`,
        );
    res.status(StatusCodes.OK).json({ philHealthRate });
};

export const deletePhilHealthRate = async (req, res) => {
    const philHealthRate = await PhilHealthRate.findByIdAndDelete(
        req.params.philHealthRateId,
    );
    if (!philHealthRate)
        throw new NotFoundError(
            `No PhilHealth rate with id ${req.params.philHealthRateId}`,
        );
    res.status(StatusCodes.OK).json({ msg: "PhilHealth rate deleted" });
};
