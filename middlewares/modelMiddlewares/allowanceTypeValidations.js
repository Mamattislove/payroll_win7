import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingAllowanceType } from "../existingMiddleware.js";
import AllowanceType from "../../models/AllowanceType.js";

export const validateAllowanceTypeInput = withValidationErrors([
    body("allowanceName")
        .notEmpty().withMessage("allowance name is required")
        .custom(async (allowanceName) => {
            const existing = await AllowanceType.findOne({ allowanceName });
            if (existing) throw new Error("allowance name already exists");
        }),
    body("allowanceDesc").optional(),
]);

export const validateAllowanceTypeUpdateInput = withValidationErrors([
    body("allowanceName")
        .optional().notEmpty().withMessage("allowance name cannot be empty")
        .custom(async (allowanceName, { req }) => {
            const existing = await AllowanceType.findOne({ allowanceName, _id: { $ne: req.params.allowanceTypeId } });
            if (existing) throw new Error("allowance name already exists");
        }),
    body("allowanceDesc").optional(),
]);

export const validateAllowanceTypeParamId = async (req, res, next) => {
    req.allowanceType = await existingAllowanceType(req.params.allowanceTypeId);
    next();
};
