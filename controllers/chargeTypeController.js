import { StatusCodes } from "http-status-codes";
import ChargeType from "../models/ChargeType.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllChargeTypes = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = search ? { chargeName: { $regex: search, $options: "i" } } : {};
    const totalChargeTypes = await ChargeType.countDocuments(query);
    const chargeTypes = await ChargeType.find(query)
        .sort({ chargeName: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalChargeTypes, totalPages: Math.ceil(totalChargeTypes / limitNum), currentPage: pageNum, chargeTypes });
};

export const getChargeType = (req, res) => {
    res.status(StatusCodes.OK).json({ chargeType: req.chargeType });
};

export const createChargeType = async (req, res) => {
    const chargeType = await ChargeType.create(req.body);
    res.status(StatusCodes.CREATED).json({ chargeType });
};

export const updateChargeType = async (req, res) => {
    const chargeType = await ChargeType.findByIdAndUpdate(req.params.chargeTypeId, req.body, { new: true, runValidators: true });
    if (!chargeType) throw new NotFoundError(`No charge type with id ${req.params.chargeTypeId}`);
    res.status(StatusCodes.OK).json({ chargeType });
};

export const deleteChargeType = async (req, res) => {
    const chargeType = await ChargeType.findByIdAndDelete(req.params.chargeTypeId);
    if (!chargeType) throw new NotFoundError(`No charge type with id ${req.params.chargeTypeId}`);
    res.status(StatusCodes.OK).json({ msg: "charge type deleted" });
};
