import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingDeductionType } from "../existingMiddleware.js";
import DeductionType from "../../models/DeductionType.js";

export const validateDeductionTypeInput = withValidationErrors([
    body("deductionName")
        .notEmpty().withMessage("deduction name is required")
        .custom(async (deductionName) => {
            const existing = await DeductionType.findOne({ deductionName });
            if (existing) throw new Error("deduction name already exists");
        }),
    body("deductionDesc").optional(),
]);

export const validateDeductionTypeUpdateInput = withValidationErrors([
    body("deductionName")
        .optional().notEmpty().withMessage("deduction name cannot be empty")
        .custom(async (deductionName, { req }) => {
            const existing = await DeductionType.findOne({ deductionName, _id: { $ne: req.params.deductionTypeId } });
            if (existing) throw new Error("deduction name already exists");
        }),
    body("deductionDesc").optional(),
]);

export const validateDeductionTypeParamId = async (req, res, next) => {
    req.deductionType = await existingDeductionType(req.params.deductionTypeId);
    next();
};
