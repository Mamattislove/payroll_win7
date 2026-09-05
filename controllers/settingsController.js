import { StatusCodes } from "http-status-codes";
import Settings from "../models/Settings.js";

export const getSettings = async (req, res) => {
    const settings = await Settings.findOne();
    res.status(StatusCodes.OK).json({ settings: settings || {} });
};

export const upsertSettings = async (req, res) => {
    const settings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true, runValidators: true });
    res.status(StatusCodes.OK).json({ settings });
};
