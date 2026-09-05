import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingDeductionRecord,
    existingEmployee,
    existingDeductionType,
} from "../existingMiddleware.js";

export const validateDeductionRecordInput = withValidationErrors([
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (id) => {
            await existingEmployee(id);
        }),
    body("deductionType")
        .notEmpty()
        .withMessage("deduction type is required")
        .custom(async (id) => {
            await existingDeductionType(id);
        }),
    body("name").notEmpty().withMessage("name is required").isString(),
    body("currentAmount")
        .optional()
        .isNumeric()
        .withMessage("current amount must be a number"),
    body("monthlyDeduction")
        .optional()
        .isNumeric()
        .withMessage("monthlyDeduction must be a number"),
    body("applicationDate")
        .optional()
        .isISO8601()
        .withMessage("application date must be a valid date"),
]);

export const validateDeductionRecordUpdateInput = withValidationErrors([
    body("name").optional().isString().withMessage("name must be a string"),
    body("currentAmount")
        .optional()
        .isNumeric()
        .withMessage("current amount must be a number"),
    body("monthlyDeduction")
        .optional()
        .isNumeric()
        .withMessage("monthlyDeduction must be a number"),
    body("applicationDate")
        .optional()
        .isISO8601()
        .withMessage("application date must be a valid date"),
]);

export const validateDeductionRecordParamId = async (req, res, next) => {
    const { deductionRecordId } = req.params;
    const deductionRecord = await existingDeductionRecord(deductionRecordId);
    req.deductionRecord = deductionRecord;
    next();
};
