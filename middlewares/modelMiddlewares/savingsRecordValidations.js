import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingSavingsRecord, existingSavings } from "../existingMiddleware.js";

export const validateSavingsRecordInput = withValidationErrors([
    body("savings")
        .notEmpty()
        .withMessage("savings record is required")
        .custom(async (id) => {
            await existingSavings(id);
        }),
    body("amount").optional().isNumeric().withMessage("amount must be a number"),
    body("amountDeducted").optional().isNumeric().withMessage("amount deducted must be a number"),
    body("payroll").optional(),
    body("payslip").optional(),
]);

export const validateSavingsRecordParamId = async (req, res, next) => {
    req.savingsRecord = await existingSavingsRecord(req.params.savingsRecordId);
    next();
};
