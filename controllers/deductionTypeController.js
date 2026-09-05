import { StatusCodes } from "http-status-codes";
import DeductionType from "../models/DeductionType.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllDeductionTypes = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = search ? { deductionName: { $regex: search, $options: "i" } } : {};
    const totalDeductionTypes = await DeductionType.countDocuments(query);
    const deductionTypes = await DeductionType.find(query)
        .sort({ deductionName: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalDeductionTypes, totalPages: Math.ceil(totalDeductionTypes / limitNum), currentPage: pageNum, deductionTypes });
};

export const getDeductionType = (req, res) => {
    res.status(StatusCodes.OK).json({ deductionType: req.deductionType });
};

export const createDeductionType = async (req, res) => {
    const deductionType = await DeductionType.create(req.body);
    res.status(StatusCodes.CREATED).json({ deductionType });
};

export const updateDeductionType = async (req, res) => {
    const deductionType = await DeductionType.findByIdAndUpdate(req.params.deductionTypeId, req.body, { new: true, runValidators: true });
    if (!deductionType) throw new NotFoundError(`No deduction type with id ${req.params.deductionTypeId}`);
    res.status(StatusCodes.OK).json({ deductionType });
};

export const deleteDeductionType = async (req, res) => {
    const deductionType = await DeductionType.findByIdAndDelete(req.params.deductionTypeId);
    if (!deductionType) throw new NotFoundError(`No deduction type with id ${req.params.deductionTypeId}`);
    res.status(StatusCodes.OK).json({ msg: "deduction type deleted" });
};
