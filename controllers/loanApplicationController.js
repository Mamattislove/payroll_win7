import { StatusCodes } from "http-status-codes";
import LoanApplication from "../models/LoanApplication.js";
import { NotFoundError } from "../errors/customErrors.js";
import { LOAN_RECORD_STATUS } from "../utils/constants.js";

export const getAllLoanApplications = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        employee,
        loanType,
        loanStatus,
    } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = { isDeleted: LOAN_RECORD_STATUS.ACTIVE };
    if (employee) query.employee = employee;
    if (loanType) query.loanType = loanType;
    if (loanStatus) query.loanStatus = loanStatus;
    const totalLoanApplications = await LoanApplication.countDocuments(query);
    const loanApplications = await LoanApplication.find(query)
        .populate("employee", "firstName lastName employeeCode")
        .populate("loanType", "loanTypeName loanTypeDesc")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({
        totalLoanApplications,
        totalPages: Math.ceil(totalLoanApplications / limitNum),
        currentPage: pageNum,
        loanApplications,
    });
};

export const getLoanApplication = (req, res) => {
    res.status(StatusCodes.OK).json({ loanApplication: req.loanApplication });
};

export const createLoanApplication = async (req, res) => {
    const loanApplication = await LoanApplication.create(req.body);
    res.status(StatusCodes.CREATED).json({ loanApplication });
};

export const updateLoanApplication = async (req, res) => {
    const loanApplication = await LoanApplication.findByIdAndUpdate(
        req.params.loanApplicationId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!loanApplication)
        throw new NotFoundError(
            `No loan application with id ${req.params.loanApplicationId}`,
        );
    res.status(StatusCodes.OK).json({ loanApplication });
};

export const deleteLoanApplication = async (req, res) => {
    const loanApplication = await LoanApplication.findByIdAndUpdate(
        req.params.loanApplicationId,
        { isDeleted: LOAN_RECORD_STATUS.SOFT_DELETED },
        { new: true },
    );
    if (!loanApplication)
        throw new NotFoundError(
            `No loan application with id ${req.params.loanApplicationId}`,
        );
    res.status(StatusCodes.OK).json({ loanApplication });
};
