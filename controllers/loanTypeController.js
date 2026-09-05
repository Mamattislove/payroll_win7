import { StatusCodes } from "http-status-codes";
import LoanType from "../models/LoanType.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllLoanTypes = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = search ? { loanTypeName: { $regex: search, $options: "i" } } : {};
    const totalLoanTypes = await LoanType.countDocuments(query);
    const loanTypes = await LoanType.find(query)
        .sort({ loanTypeName: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalLoanTypes, totalPages: Math.ceil(totalLoanTypes / limitNum), currentPage: pageNum, loanTypes });
};

export const getLoanType = (req, res) => {
    res.status(StatusCodes.OK).json({ loanType: req.loanType });
};

export const createLoanType = async (req, res) => {
    const loanType = await LoanType.create(req.body);
    res.status(StatusCodes.CREATED).json({ loanType });
};

export const updateLoanType = async (req, res) => {
    const loanType = await LoanType.findByIdAndUpdate(req.params.loanTypeId, req.body, { new: true, runValidators: true });
    if (!loanType) throw new NotFoundError(`No loan type with id ${req.params.loanTypeId}`);
    res.status(StatusCodes.OK).json({ loanType });
};

export const deleteLoanType = async (req, res) => {
    const loanType = await LoanType.findByIdAndDelete(req.params.loanTypeId);
    if (!loanType) throw new NotFoundError(`No loan type with id ${req.params.loanTypeId}`);
    res.status(StatusCodes.OK).json({ msg: "loan type deleted" });
};
