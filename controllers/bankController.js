import { StatusCodes } from "http-status-codes";
import Bank from "../models/Bank.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllBanks = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = search
        ? { bankName: { $regex: search, $options: "i" } }
        : {};

    const totalBanks = await Bank.countDocuments(query);
    const totalPages = Math.ceil(totalBanks / limitNum);

    const banks = await Bank.find(query)
        .sort({ bankName: 1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({ totalBanks, totalPages, currentPage: pageNum, banks });
};

export const getBank = (req, res) => {
    res.status(StatusCodes.OK).json({ bank: req.bank });
};

export const createBank = async (req, res) => {
    const bank = await Bank.create(req.body);
    res.status(StatusCodes.CREATED).json({ bank });
};

export const updateBank = async (req, res) => {
    const bank = await Bank.findByIdAndUpdate(
        req.params.bankId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!bank) throw new NotFoundError(`No bank with id ${req.params.bankId}`);
    res.status(StatusCodes.OK).json({ bank });
};

export const deleteBank = async (req, res) => {
    const bank = await Bank.findByIdAndDelete(req.params.bankId);
    if (!bank) throw new NotFoundError(`No bank with id ${req.params.bankId}`);
    res.status(StatusCodes.OK).json({ msg: "bank deleted" });
};
