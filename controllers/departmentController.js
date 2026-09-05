import { StatusCodes } from "http-status-codes";
import Department from "../models/Department.js";
import { NotFoundError } from "../errors/customErrors.js";

export const getAllDepartments = async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = search
        ? { departmentName: { $regex: search, $options: "i" } }
        : {};

    const totalDepartments = await Department.countDocuments(query);
    const totalPages = Math.ceil(totalDepartments / limitNum);

    const departments = await Department.find(query)
        .sort({ departmentName: 1 })
        .skip(skip)
        .limit(limitNum);

    res.status(StatusCodes.OK).json({
        totalDepartments,
        totalPages,
        currentPage: pageNum,
        departments,
    });
};

export const getDepartment = (req, res) => {
    res.status(StatusCodes.OK).json({ department: req.department });
};

export const createDepartment = async (req, res) => {
    const department = await Department.create(req.body);
    res.status(StatusCodes.CREATED).json({ department });
};

export const updateDepartment = async (req, res) => {
    const department = await Department.findByIdAndUpdate(
        req.params.departmentId,
        req.body,
        { new: true, runValidators: true },
    );
    if (!department) throw new NotFoundError(`No department with id ${req.params.departmentId}`);
    res.status(StatusCodes.OK).json({ department });
};

export const deleteDepartment = async (req, res) => {
    const department = await Department.findByIdAndDelete(req.params.departmentId);
    if (!department) throw new NotFoundError(`No department with id ${req.params.departmentId}`);
    res.status(StatusCodes.OK).json({ msg: "department deleted" });
};
