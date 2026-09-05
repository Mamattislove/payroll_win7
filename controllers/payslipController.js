import { StatusCodes } from "http-status-codes";
import Payslip from "../models/Payslip.js";
import { NotFoundError } from "../errors/customErrors.js";

const compensationPopulate = {
    path: "compensation",
    populate: {
        path: "employeeDesignation",
        populate: [
            { path: "employee", select: "firstName lastName employeeCode" },
            { path: "client", select: "clientName" },
            { path: "department", select: "departmentName" },
            { path: "position", select: "positionName" },
        ],
    },
};

export const getAllPayslips = async (req, res) => {
    const { page = 1, limit = 10, compensation, status } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (compensation) query.compensation = compensation;
    if (status) query.status = status;

    const totalPayslips = await Payslip.countDocuments(query);
    const totalPages = Math.ceil(totalPayslips / limitNum);

    const payslips = await Payslip.find(query)
        .populate(compensationPopulate)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalPayslips,
        totalPages,
        currentPage: pageNum,
        payslips,
    });
};

export const getPayslip = (req, res) => {
    res.status(StatusCodes.OK).json({ payslip: req.payslip });
};

export const createPayslip = async (req, res) => {
    const payslip = await Payslip.create(req.body);
    res.status(StatusCodes.CREATED).json({ payslip });
};

export const updatePayslip = async (req, res) => {
    const payslip = await Payslip.findByIdAndUpdate(
        req.params.payslipId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!payslip)
        throw new NotFoundError(`No payslip with id ${req.params.payslipId}`);
    res.status(StatusCodes.OK).json({ payslip });
};

export const deletePayslip = async (req, res) => {
    const payslip = await Payslip.findByIdAndDelete(req.params.payslipId);
    if (!payslip)
        throw new NotFoundError(`No payslip with id ${req.params.payslipId}`);
    res.status(StatusCodes.OK).json({ msg: "payslip deleted" });
};
