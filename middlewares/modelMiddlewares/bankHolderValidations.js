import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingBankHolder,
    existingEmployee,
    existingBank,
} from "../existingMiddleware.js";
import BankHolder from "../../models/BankHolder.js";

export const validateBankHolderInput = withValidationErrors([
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (employeeId) => {
            await existingEmployee(employeeId);
        }),
    body("bank")
        .notEmpty()
        .withMessage("bank is required")
        .custom(async (bankId, { req }) => {
            await existingBank(bankId);
            const duplicate = await BankHolder.findOne({
                employee: req.body.employee,
                bank: bankId,
                status: 1,
            });
            if (duplicate)
                throw new Error(
                    "this employee already has an active account in this bank",
                );
        }),
    body("accountNumber")
        .notEmpty()
        .withMessage("account number is required"),
    body("charges")
        .optional()
        .isNumeric()
        .withMessage("charges must be a number"),
    body("status")
        .optional()
        .isIn([0, 1])
        .withMessage("status must be 0 or 1"),
]);

export const validateBankHolderUpdateInput = withValidationErrors([
    body("employee")
        .optional()
        .custom(async (employeeId) => {
            await existingEmployee(employeeId);
        }),
    body("bank")
        .optional()
        .custom(async (bankId, { req }) => {
            await existingBank(bankId);
            const employeeId = req.body.employee ?? req.bankHolder.employee;
            const conflict = await BankHolder.findOne({
                employee: employeeId,
                bank: bankId,
                status: 1,
                _id: { $ne: req.bankHolder._id },
            });
            if (conflict)
                throw new Error(
                    "this employee already has an active account in this bank",
                );
        }),
    body("accountNumber")
        .optional()
        .notEmpty()
        .withMessage("account number cannot be empty"),
    body("charges")
        .optional()
        .isNumeric()
        .withMessage("charges must be a number"),
    body("status")
        .optional()
        .isIn([0, 1])
        .withMessage("status must be 0 or 1"),
]);

export const validateBankHolderParamId = async (req, res, next) => {
    const { bankHolderId } = req.params;
    const bankHolder = await existingBankHolder(bankHolderId);
    req.bankHolder = bankHolder;
    next();
};
