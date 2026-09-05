import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingLoanType } from "../existingMiddleware.js";
import LoanType from "../../models/LoanType.js";

export const validateLoanTypeInput = withValidationErrors([
    body("loanTypeName")
        .notEmpty()
        .withMessage("loan type name is required")
        .custom(async (loanTypeName) => {
            const existing = await LoanType.findOne({ loanTypeName });
            if (existing) throw new Error("loan type name already exists");
        }),
    body("loanTypeDesc").optional(),
]);

export const validateLoanTypeUpdateInput = withValidationErrors([
    body("loanTypeName")
        .optional()
        .notEmpty()
        .withMessage("loan type name cannot be empty")
        .custom(async (loanTypeName, { req }) => {
            const existing = await LoanType.findOne({
                loanTypeName,
                _id: { $ne: req.params.loanTypeId },
            });
            if (existing) throw new Error("loan type name already exists");
        }),
    body("loanTypeDesc").optional(),
]);

export const validateLoanTypeParamId = async (req, res, next) => {
    req.loanType = await existingLoanType(req.params.loanTypeId);
    next();
};
