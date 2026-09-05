import { StatusCodes } from "http-status-codes";
import BankHolder from "../models/BankHolder.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllBankHolders = async (req, res) => {
    const { page = 1, limit = 10, employee } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (employee) query.employee = employee;

    const totalBankHolders = await BankHolder.countDocuments(query);
    const totalPages = Math.ceil(totalBankHolders / limitNum);

    const bankHolders = await BankHolder.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("bank", "bankName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalBankHolders,
        totalPages,
        currentPage: pageNum,
        bankHolders,
    });
};

export const getBankHolder = (req, res) => {
    res.status(StatusCodes.OK).json({ bankHolder: req.bankHolder });
};

export const createBankHolder = async (req, res) => {
    const bankHolder = await BankHolder.create(req.body);
    res.status(StatusCodes.CREATED).json({ bankHolder });
};

export const updateBankHolder = async (req, res) => {
    const bankHolder = await BankHolder.findByIdAndUpdate(
        req.params.bankHolderId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!bankHolder) throw new NotFoundError(`No bank holder with id ${req.params.bankHolderId}`);
    res.status(StatusCodes.OK).json({ bankHolder });
};

export const deleteBankHolder = async (req, res) => {
    const bankHolder = await BankHolder.findByIdAndDelete(req.params.bankHolderId);
    if (!bankHolder) throw new NotFoundError(`No bank holder with id ${req.params.bankHolderId}`);
    res.status(StatusCodes.OK).json({ msg: "bank holder deleted" });
};
