import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingSavings, existingEmployee } from "../existingMiddleware.js";
import Savings from "../../models/Savings.js";

export const validateSavingsInput = withValidationErrors([
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (id) => {
            await existingEmployee(id);
            const active = await Savings.findOne({ employee: id });
            if (active)
                throw new Error("employee already has an active savings plan");
        }),
    body("savingsTarget")
        .notEmpty()
        .withMessage("savings target is required")
        .isNumeric()
        .withMessage("savings target must be a number"),
    body("cutoffDeductionAmount")
        .notEmpty()
        .withMessage("cutoff deduction amount is required")
        .isNumeric()
        .withMessage("must be a number"),
    body("effectiveDate").optional().isISO8601().withMessage("effective date is invalid"),
    body("addedBy").optional(),
]);

export const validateSavingsUpdateInput = withValidationErrors([
    body("savingsTarget")
        .optional()
        .isNumeric()
        .withMessage("savings target must be a number"),
    body("cutoffDeductionAmount")
        .optional()
        .isNumeric()
        .withMessage("must be a number"),
    body("effectiveDate")
        .optional()
        .isISO8601()
        .withMessage("effective date is invalid"),
    body("status").optional(),
]);

export const validateSavingsParamId = async (req, res, next) => {
    req.savings = await existingSavings(req.params.savingsId);
    next();
};
