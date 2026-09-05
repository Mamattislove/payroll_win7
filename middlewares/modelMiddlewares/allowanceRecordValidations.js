import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingAllowanceRecord,
    existingPayroll,
    existingEmployee,
    existingAllowanceType,
} from "../existingMiddleware.js";

const sharedOptionalFields = [
    body("name").optional().isString().withMessage("name must be a string"),
    body("amount").optional().isNumeric().withMessage("amount must be a number"),
];

export const validateAllowanceRecordInput = withValidationErrors([
    body("payroll")
        .optional()
        .custom(async (id) => { await existingPayroll(id); }),
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (id) => { await existingEmployee(id); }),
    body("allowanceType")
        .notEmpty()
        .withMessage("allowance type is required")
        .custom(async (id) => { await existingAllowanceType(id); }),
    body("name").notEmpty().withMessage("name is required").isString(),
    body("amount")
        .notEmpty()
        .withMessage("amount is required")
        .isNumeric()
        .withMessage("amount must be a number"),
    ...sharedOptionalFields,
]);

export const validateAllowanceRecordUpdateInput = withValidationErrors([
    ...sharedOptionalFields,
]);

export const validateAllowanceRecordParamId = async (req, res, next) => {
    const { allowanceRecordId } = req.params;
    const allowanceRecord = await existingAllowanceRecord(allowanceRecordId);
    req.allowanceRecord = allowanceRecord;
    next();
};
