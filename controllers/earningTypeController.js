import { StatusCodes } from "http-status-codes";
import EarningType from "../models/EarningType.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllEarningTypes = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = search ? { earningName: { $regex: search, $options: "i" } } : {};
    const totalEarningTypes = await EarningType.countDocuments(query);
    const earningTypes = await EarningType.find(query)
        .sort({ earningName: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalEarningTypes, totalPages: Math.ceil(totalEarningTypes / limitNum), currentPage: pageNum, earningTypes });
};

export const getEarningType = (req, res) => {
    res.status(StatusCodes.OK).json({ earningType: req.earningType });
};

export const createEarningType = async (req, res) => {
    const earningType = await EarningType.create(req.body);
    res.status(StatusCodes.CREATED).json({ earningType });
};

export const updateEarningType = async (req, res) => {
    const earningType = await EarningType.findByIdAndUpdate(req.params.earningTypeId, req.body, { new: true, runValidators: true });
    if (!earningType) throw new NotFoundError(`No earning type with id ${req.params.earningTypeId}`);
    res.status(StatusCodes.OK).json({ earningType });
};

export const deleteEarningType = async (req, res) => {
    const earningType = await EarningType.findByIdAndDelete(req.params.earningTypeId);
    if (!earningType) throw new NotFoundError(`No earning type with id ${req.params.earningTypeId}`);
    res.status(StatusCodes.OK).json({ msg: "earning type deleted" });
};
