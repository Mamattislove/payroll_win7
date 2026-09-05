import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingDepartment } from "../existingMiddleware.js";
import Department from "../../models/Department.js";
import { BadRequestError } from "../../errors/customErrors.js";

export const validateDepartmentInput = withValidationErrors([
    body("departmentName")
        .notEmpty()
        .withMessage("department name is required")
        .custom(async (departmentName) => {
            const existing = await Department.findOne({ departmentName });
            if (existing) throw new Error("department name already exists");
        }),
    body("departmentDesc").optional(),
]);

export const validateDepartmentUpdateInput = withValidationErrors([
    body("departmentName")
        .optional()
        .notEmpty()
        .withMessage("department name cannot be empty")
        .custom(async (departmentName, { req }) => {
            const existing = await Department.findOne({
                departmentName,
                _id: { $ne: req.params.departmentId },
            });
            if (existing) throw new Error("department name already exists");
        }),
    body("departmentDesc").optional(),
]);

export const validateDepartmentParamId = async (req, res, next) => {
    const { departmentId } = req.params;
    const department = await existingDepartment(departmentId);
    req.department = department;
    next();
};
