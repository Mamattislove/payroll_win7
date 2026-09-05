import { StatusCodes } from "http-status-codes";
import Client from "../models/Client.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllClients = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = search
        ? { clientName: { $regex: search, $options: "i" } }
        : {};
    const totalClients = await Client.countDocuments(query);
    const clients = await Client.find(query)
        .sort({ clientName: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({
        totalClients,
        totalPages: Math.ceil(totalClients / limitNum),
        currentPage: pageNum,
        clients,
    });
};

export const getClient = (req, res) => {
    res.status(StatusCodes.OK).json({ client: req.client });
};

export const createClient = async (req, res) => {
    const client = await Client.create(req.body);
    res.status(StatusCodes.CREATED).json({ client });
};

export const updateClient = async (req, res) => {
    const client = await Client.findByIdAndUpdate(
        req.params.clientId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!client)
        throw new NotFoundError(`No client with id ${req.params.clientId}`);
    res.status(StatusCodes.OK).json({ client });
};

export const deleteClient = async (req, res) => {
    const client = await Client.findByIdAndDelete(req.params.clientId);
    if (!client)
        throw new NotFoundError(`No client with id ${req.params.clientId}`);
    res.status(StatusCodes.OK).json({ msg: "client deleted" });
};
