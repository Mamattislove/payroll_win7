import { StatusCodes } from "http-status-codes";
import Position from "../models/Position.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllPositions = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = search
        ? { positionName: { $regex: search, $options: "i" } }
        : {};

    const totalPositions = await Position.countDocuments(query);
    const totalPages = Math.ceil(totalPositions / limitNum);

    const positions = await Position.find(query)
        .sort({ positionName: 1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalPositions,
        totalPages,
        currentPage: pageNum,
        positions,
    });
};

export const getPosition = (req, res) => {
    res.status(StatusCodes.OK).json({ position: req.position });
};

export const createPosition = async (req, res) => {
    const position = await Position.create(req.body);
    res.status(StatusCodes.CREATED).json({ position });
};

export const updatePosition = async (req, res) => {
    const position = await Position.findByIdAndUpdate(
        req.params.positionId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!position) throw new NotFoundError(`No position with id ${req.params.positionId}`);
    res.status(StatusCodes.OK).json({ position });
};

export const deletePosition = async (req, res) => {
    const position = await Position.findByIdAndDelete(req.params.positionId);
    if (!position) throw new NotFoundError(`No position with id ${req.params.positionId}`);
    res.status(StatusCodes.OK).json({ msg: "position deleted" });
};
