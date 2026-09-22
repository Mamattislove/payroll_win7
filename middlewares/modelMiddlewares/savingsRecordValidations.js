import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingSavingsRecord, existingSavings } from "../existingMiddleware.js";
import SavingsRecord from "../../models/SavingsPayment.js";

export const validateSavingsRecordInput = withValidationErrors([
    body("savings")
        .notEmpty()
        .withMessage("savings record is required")
        .custom(async (id) => {
            await existingSavings(id);
        }),
    body("amount").optional().isNumeric().withMessage("amount must be a number"),
    body("amountDeducted").optional().isNumeric().withMessage("amount deducted must be a number"),
    // One plan, one deduction per payroll. The payroll run already creates a
    // record for every active plan, so a second one for the same plan doubles
    // the deduction in the payroll totals with nothing on screen to explain it.
    body("payroll")
        .optional()
        .custom(async (payrollId, { req }) => {
            if (!payrollId || !req.body.savings) return;
            const duplicate = await SavingsRecord.findOne({
                savings: req.body.savings,
                payroll: payrollId,
            });
            if (duplicate)
                throw new Error(
                    "this savings plan is already deducted on this payroll",
                );
        }),
    body("payslip").optional(),
]);

export const validateSavingsRecordParamId = async (req, res, next) => {
    req.savingsRecord = await existingSavingsRecord(req.params.savingsRecordId);
    next();
};
