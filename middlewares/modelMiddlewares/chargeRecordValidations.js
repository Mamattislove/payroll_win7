import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingChargeRecord,
    existingPayroll,
    existingEmployee,
    existingChargeType,
} from "../existingMiddleware.js";

const sharedOptionalFields = [
    body("name").optional().isString().withMessage("name must be a string"),
    body("amount").optional().isNumeric().withMessage("amount must be a number"),
];

export const validateChargeRecordInput = withValidationErrors([
    body("payroll")
        .optional()
        .custom(async (id) => { await existingPayroll(id); }),
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (id) => { await existingEmployee(id); }),
    body("chargeType")
        .notEmpty()
        .withMessage("charge type is required")
        .custom(async (id) => { await existingChargeType(id); }),
    body("name").notEmpty().withMessage("name is required").isString(),
    body("amount")
        .notEmpty()
        .withMessage("amount is required")
        .isNumeric()
        .withMessage("amount must be a number"),
    ...sharedOptionalFields,
]);

export const validateChargeRecordUpdateInput = withValidationErrors([
    ...sharedOptionalFields,
]);

export const validateChargeRecordParamId = async (req, res, next) => {
    const { chargeRecordId } = req.params;
    const chargeRecord = await existingChargeRecord(chargeRecordId);
    req.chargeRecord = chargeRecord;
    next();
};
