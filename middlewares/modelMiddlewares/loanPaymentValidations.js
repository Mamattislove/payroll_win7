import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingLoanPayment, existingLoanApplication } from "../existingMiddleware.js";
import LoanPayment from "../../models/LoanPayment.js";

export const validateLoanPaymentInput = withValidationErrors([
    body("loan")
        .notEmpty().withMessage("loan is required")
        .custom(async (id, { req }) => {
            await existingLoanApplication(id);
            const date = req.body.dateOfPayment ? new Date(req.body.dateOfPayment) : new Date();
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
            const existing = await LoanPayment.findOne({
                loan: id,
                dateOfPayment: { $gte: startOfMonth, $lte: endOfMonth },
            });
            if (existing) throw new Error("a payment for this loan already exists for this month");
        }),
    body("amount").notEmpty().withMessage("amount is required").isNumeric().withMessage("amount must be a number"),
    body("dateOfPayment").optional().isISO8601().withMessage("dateOfPayment must be a valid date"),
    body("payroll").optional(),
    body("payslip").optional(),
]);

export const validateLoanPaymentParamId = async (req, res, next) => {
    req.loanPayment = await existingLoanPayment(req.params.loanPaymentId);
    next();
};
