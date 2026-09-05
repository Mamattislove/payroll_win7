import { StatusCodes } from "http-status-codes";
import PagIbigRate from "../models/PagIbigRate.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllPagIbigRates = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const totalPagIbigRates = await PagIbigRate.countDocuments();
    const pagIbigRates = await PagIbigRate.find()
        .sort({ year: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalPagIbigRates, totalPages: Math.ceil(totalPagIbigRates / limitNum), currentPage: pageNum, pagIbigRates });
};

export const getPagIbigRate = (req, res) => {
    res.status(StatusCodes.OK).json({ pagIbigRate: req.pagIbigRate });
};

export const createPagIbigRate = async (req, res) => {
    const pagIbigRate = await PagIbigRate.create(req.body);
    res.status(StatusCodes.CREATED).json({ pagIbigRate });
};

export const updatePagIbigRate = async (req, res) => {
    const pagIbigRate = await PagIbigRate.findByIdAndUpdate(req.params.pagIbigRateId, req.body, { new: true, runValidators: true });
    if (!pagIbigRate) throw new NotFoundError(`No Pag-IBIG rate with id ${req.params.pagIbigRateId}`);
    res.status(StatusCodes.OK).json({ pagIbigRate });
};

export const deletePagIbigRate = async (req, res) => {
    const pagIbigRate = await PagIbigRate.findByIdAndDelete(req.params.pagIbigRateId);
    if (!pagIbigRate) throw new NotFoundError(`No Pag-IBIG rate with id ${req.params.pagIbigRateId}`);
    res.status(StatusCodes.OK).json({ msg: "Pag-IBIG rate deleted" });
};
