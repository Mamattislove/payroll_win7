import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingEarningType } from "../existingMiddleware.js";
import EarningType from "../../models/EarningType.js";

export const validateEarningTypeInput = withValidationErrors([
    body("earningName")
        .notEmpty()
        .withMessage("earning name is required")
        .custom(async (earningName) => {
            const existing = await EarningType.findOne({ earningName });
            if (existing) throw new Error("earning name already exists");
        }),
    body("earningDesc").optional(),
]);

export const validateEarningTypeUpdateInput = withValidationErrors([
    body("earningName")
        .optional()
        .notEmpty()
        .withMessage("earning name cannot be empty")
        .custom(async (earningName, { req }) => {
            const existing = await EarningType.findOne({
                earningName,
                _id: { $ne: req.params.earningTypeId },
            });
            if (existing) throw new Error("earning name already exists");
        }),
    body("earningDesc").optional(),
]);

export const validateEarningTypeParamId = async (req, res, next) => {
    req.earningType = await existingEarningType(req.params.earningTypeId);
    next();
};
