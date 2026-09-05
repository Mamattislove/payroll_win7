import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingDeductionPayment,
    existingDeductionRecord,
    existingEmployee,
    existingDeductionType,
    existingPayroll,
} from "../existingMiddleware.js";
import DeductionPayment from "../../models/DeductionPayment.js";

export const validateDeductionPaymentInput = withValidationErrors([
    // Either deductionRecord OR (employee + deductionType + name) must be provided
    body("deductionRecord")
        .optional()
        .custom(async (id, { req }) => {
            if (!id) return;
            await existingDeductionRecord(id);
            const date = req.body.deductionDate ? new Date(req.body.deductionDate) : new Date();
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
            const existing = await DeductionPayment.findOne({
                deductionRecord: id,
                createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            });
            if (existing) throw new Error("a payment for this deduction already exists for this month");
        }),
    body("employee")
        .if(body("deductionRecord").not().exists())
        .notEmpty()
        .withMessage("employee is required when deductionRecord is not provided")
        .custom(async (id) => { await existingEmployee(id); }),
    body("deductionType")
        .if(body("deductionRecord").not().exists())
        .notEmpty()
        .withMessage("deduction type is required when deductionRecord is not provided")
        .custom(async (id) => { await existingDeductionType(id); }),
    body("name")
        .if(body("deductionRecord").not().exists())
        .notEmpty()
        .withMessage("name is required when deductionRecord is not provided")
        .isString(),
    body("payroll")
        .optional()
        .custom(async (id) => { if (id) await existingPayroll(id); }),
    body("amount")
        .notEmpty()
        .withMessage("amount is required")
        .isNumeric()
        .withMessage("amount must be a number"),
    body("deductionDate")
        .optional()
        .isISO8601()
        .withMessage("deduction date must be a valid date"),
]);

export const validateDeductionPaymentUpdateInput = withValidationErrors([
    body("amount").optional().isNumeric().withMessage("amount must be a number"),
    body("deductionDate")
        .optional()
        .isISO8601()
        .withMessage("deduction date must be a valid date"),
]);

export const validateDeductionPaymentParamId = async (req, res, next) => {
    const { deductionPaymentId } = req.params;
    const deductionPayment = await existingDeductionPayment(deductionPaymentId);
    req.deductionPayment = deductionPayment;
    next();
};
