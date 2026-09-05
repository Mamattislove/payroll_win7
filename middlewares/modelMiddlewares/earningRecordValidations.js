import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingEarningRecord,
    existingPayroll,
    existingEmployee,
    existingEarningType,
} from "../existingMiddleware.js";

const sharedOptionalFields = [
    body("name").optional().isString().withMessage("name must be a string"),
    body("amount").optional().isNumeric().withMessage("amount must be a number"),
];

export const validateEarningRecordInput = withValidationErrors([
    body("payroll")
        .optional()
        .custom(async (id) => { await existingPayroll(id); }),
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (id) => { await existingEmployee(id); }),
    body("earningType")
        .notEmpty()
        .withMessage("earning type is required")
        .custom(async (id) => { await existingEarningType(id); }),
    body("name").notEmpty().withMessage("name is required").isString(),
    body("amount")
        .notEmpty()
        .withMessage("amount is required")
        .isNumeric()
        .withMessage("amount must be a number"),
    ...sharedOptionalFields,
]);

export const validateEarningRecordUpdateInput = withValidationErrors([
    ...sharedOptionalFields,
]);

export const validateEarningRecordParamId = async (req, res, next) => {
    const { earningRecordId } = req.params;
    const earningRecord = await existingEarningRecord(earningRecordId);
    req.earningRecord = earningRecord;
    next();
};
