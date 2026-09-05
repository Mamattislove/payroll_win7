import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { PAYSLIP_STATUS } from "../../utils/constants.js";
import { existingPayslip, existingCompensation } from "../existingMiddleware.js";

export const validatePayslipInput = withValidationErrors([
    body("compensation")
        .notEmpty()
        .withMessage("compensation is required")
        .custom(async (compensationId) => {
            await existingCompensation(compensationId);
        }),
    body("status")
        .optional()
        .isIn(Object.values(PAYSLIP_STATUS))
        .withMessage("invalid payslip status"),
    body("createdBy").optional(),
]);

export const validatePayslipUpdateInput = withValidationErrors([
    body("status")
        .optional()
        .isIn(Object.values(PAYSLIP_STATUS))
        .withMessage("invalid payslip status"),
]);

export const validatePayslipParamId = async (req, res, next) => {
    const { payslipId } = req.params;
    const payslip = await existingPayslip(payslipId);
    req.payslip = payslip;
    next();
};
