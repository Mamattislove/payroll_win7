import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingBank } from "../existingMiddleware.js";
import Bank from "../../models/Bank.js";

export const validateBankInput = withValidationErrors([
    body("bankName")
        .notEmpty()
        .withMessage("bank name is required")
        .custom(async (bankName) => {
            const existing = await Bank.findOne({ bankName });
            if (existing) throw new Error("bank name already exists");
        }),
]);

export const validateBankUpdateInput = withValidationErrors([
    body("bankName")
        .optional()
        .notEmpty()
        .withMessage("bank name cannot be empty")
        .custom(async (bankName, { req }) => {
            const existing = await Bank.findOne({
                bankName,
                _id: { $ne: req.params.bankId },
            });
            if (existing) throw new Error("bank name already exists");
        }),
]);

export const validateBankParamId = async (req, res, next) => {
    const { bankId } = req.params;
    const bank = await existingBank(bankId);
    req.bank = bank;
    next();
};
