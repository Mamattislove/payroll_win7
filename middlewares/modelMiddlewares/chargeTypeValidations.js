import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingChargeType } from "../existingMiddleware.js";
import ChargeType from "../../models/ChargeType.js";

export const validateChargeTypeInput = withValidationErrors([
    body("chargeName")
        .notEmpty()
        .withMessage("charge name is required")
        .custom(async (chargeName) => {
            const existing = await ChargeType.findOne({ chargeName });
            if (existing) throw new Error("charge name already exists");
        }),
    body("chargeDesc").optional(),
]);

export const validateChargeTypeUpdateInput = withValidationErrors([
    body("chargeName")
        .optional()
        .notEmpty()
        .withMessage("charge name cannot be empty")
        .custom(async (chargeName, { req }) => {
            const existing = await ChargeType.findOne({
                chargeName,
                _id: { $ne: req.params.chargeTypeId },
            });
            if (existing) throw new Error("charge name already exists");
        }),
    body("chargeDesc").optional(),
]);

export const validateChargeTypeParamId = async (req, res, next) => {
    req.chargeType = await existingChargeType(req.params.chargeTypeId);
    next();
};
