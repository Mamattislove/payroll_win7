import { StatusCodes } from "http-status-codes";
import AllowanceType from "../models/AllowanceType.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllAllowanceTypes = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = search
        ? { allowanceName: { $regex: search, $options: "i" } }
        : {};
    const totalAllowanceTypes = await AllowanceType.countDocuments(query);
    const allowanceTypes = await AllowanceType.find(query)
        .sort({ allowanceName: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({
        totalAllowanceTypes,
        totalPages: Math.ceil(totalAllowanceTypes / limitNum),
        currentPage: pageNum,
        allowanceTypes,
    });
};

export const getAllowanceType = (req, res) => {
    res.status(StatusCodes.OK).json({ allowanceType: req.allowanceType });
};

export const createAllowanceType = async (req, res) => {
    const allowanceType = await AllowanceType.create(req.body);
    res.status(StatusCodes.CREATED).json({ allowanceType });
};

export const updateAllowanceType = async (req, res) => {
    const allowanceType = await AllowanceType.findByIdAndUpdate(
        req.params.allowanceTypeId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!allowanceType)
        throw new NotFoundError(
            `No allowance type with id ${req.params.allowanceTypeId}`,
        );
    res.status(StatusCodes.OK).json({ allowanceType });
};

export const deleteAllowanceType = async (req, res) => {
    const allowanceType = await AllowanceType.findByIdAndDelete(
        req.params.allowanceTypeId,
    );
    if (!allowanceType)
        throw new NotFoundError(
            `No allowance type with id ${req.params.allowanceTypeId}`,
        );
    res.status(StatusCodes.OK).json({ msg: "allowance type deleted" });
};
