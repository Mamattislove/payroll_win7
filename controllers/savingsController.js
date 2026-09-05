import { StatusCodes } from "http-status-codes";
import Savings from "../models/Savings.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllSavings = async (req, res) => {
    const { page = 1, limit = 10, employee, status } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));

    const query = {};
    if (employee) query.employee = employee;
    if (status !== undefined) query.status = status;

    const totalSavings = await Savings.countDocuments(query);
    const savings = await Savings.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("addedBy", "firstName lastName employeeCode")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalSavings,
        totalPages: Math.ceil(totalSavings / limitNum),
        currentPage: pageNum,
        savings,
    });
};

export const getSavings = (req, res) => {
    res.status(StatusCodes.OK).json({ savings: req.savings });
};

export const createSavings = async (req, res) => {
    const savings = await Savings.create(req.body);
    res.status(StatusCodes.CREATED).json({ savings });
};

export const updateSavings = async (req, res) => {
    const savings = await Savings.findByIdAndUpdate(
        req.params.savingsId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!savings)
        throw new NotFoundError(`No savings record with id ${req.params.savingsId}`);
    res.status(StatusCodes.OK).json({ savings });
};

export const deleteSavings = async (req, res) => {
    const savings = await Savings.findByIdAndDelete(req.params.savingsId);
    if (!savings)
        throw new NotFoundError(`No savings record with id ${req.params.savingsId}`);
    res.status(StatusCodes.OK).json({ msg: "savings record deleted" });
};
