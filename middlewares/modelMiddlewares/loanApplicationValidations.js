import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingLoanApplication,
    existingEmployee,
    existingLoanType,
} from "../existingMiddleware.js";
import {
    LOAN_STATUS,
    LOAN_RECORD_STATUS,
} from "../../utils/constants.js";
import LoanApplication from "../../models/LoanApplication.js";
import { BadRequestError } from "../../errors/customErrors.js";

export const validateLoanApplicationInput = withValidationErrors([
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (id) => {
            await existingEmployee(id);
        }),
    body("loanType")
        .notEmpty()
        .withMessage("loan type is required")
        .custom(async (loanTypeId, { req }) => {
            await existingLoanType(loanTypeId);
            const loan = await LoanApplication.findOne({
                employee: req.body.employee,
                loanType: loanTypeId,
                isDeleted: LOAN_RECORD_STATUS.ACTIVE,
            });
            if (loan) {
                throw new BadRequestError(
                    "a loan of this type already exists for the selected employee",
                );
            }
        }),
    body("loanName").optional().isString().withMessage("loan name must be a string"),
    body("loanAmount")
        .notEmpty()
        .withMessage("loan amount is required")
        .isNumeric()
        .withMessage("loan amount must be a number"),
    body("loanPayable")
        .optional()
        .isNumeric()
        .withMessage("loan payable must be a number"),
    body("monthlyAmortization")
        .notEmpty()
        .withMessage("monthly amortization is required")
        .isNumeric()
        .withMessage("monthly amortization must be a number"),
    body("firstMonthAmortization")
        .optional()
        .isISO8601()
        .withMessage("first month amortization date is invalid"),
    body("checkNumber").optional(),
    body("dateGranted").optional().isISO8601().withMessage("date granted must be a valid date"),
    body("loanTermFrom").optional().isISO8601().withMessage("loan term from must be a valid date"),
    body("loanTermTo").optional().isISO8601().withMessage("loan term to must be a valid date"),
    body("remarks").optional(),
]);

export const validateLoanApplicationUpdateInput = withValidationErrors([
    body("employee").optional().custom(async (id) => { await existingEmployee(id); }),
    body("loanType").optional().custom(async (loanTypeId) => { await existingLoanType(loanTypeId); }),
    body("loanName").optional().isString().withMessage("loan name must be a string"),
    body("loanAmount").optional().isNumeric().withMessage("loan amount must be a number"),
    body("loanPayable").optional().isNumeric().withMessage("loan payable must be a number"),
    body("monthlyAmortization").optional().isNumeric().withMessage("monthly amortization must be a number"),
    body("firstMonthAmortization").optional().isISO8601().withMessage("first month amortization date is invalid"),
    body("checkNumber").optional(),
    body("dateGranted").optional().isISO8601().withMessage("date granted must be a valid date"),
    body("loanTermFrom").optional().isISO8601().withMessage("loan term from must be a valid date"),
    body("loanTermTo").optional().isISO8601().withMessage("loan term to must be a valid date"),
    body("loanStatus").optional().isIn(Object.values(LOAN_STATUS)).withMessage("invalid loan status"),
    body("remarks").optional(),
]);

export const validateLoanApplicationParamId = async (req, res, next) => {
    req.loanApplication = await existingLoanApplication(
        req.params.loanApplicationId,
    );
    next();
};
