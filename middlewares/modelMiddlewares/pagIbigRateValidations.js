import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingPagIbigRate } from "../existingMiddleware.js";

export const validatePagIbigRateInput = withValidationErrors([
    body("year").optional().isInt({ min: 2000 }).withMessage("year must be a valid year"),
    body("effectiveDate").optional().isDate().withMessage("effective date is invalid"),
    body("incomeCeiling").optional().isNumeric().withMessage("income ceiling must be a number"),
    body("basicEmployeeShare").optional().isNumeric().withMessage("must be a number"),
    body("basicEmployerShare").optional().isNumeric().withMessage("must be a number"),
    body("overThresholdEmployeeShare").optional().isNumeric().withMessage("must be a number"),
    body("overThresholdEmployerShare").optional().isNumeric().withMessage("must be a number"),
    body("flatRateMaxDeduction").optional().isNumeric().withMessage("must be a number"),
    body("percentageRateSalaryThreshold").optional().isNumeric().withMessage("must be a number"),
    body("isBaseline").optional().isBoolean().withMessage("isBaseline must be a boolean"),
]);

export const validatePagIbigRateUpdateInput = withValidationErrors([
    body("year").optional().isInt({ min: 2000 }).withMessage("year must be a valid year"),
    body("effectiveDate").optional().isDate().withMessage("effective date is invalid"),
    body("incomeCeiling").optional().isNumeric().withMessage("income ceiling must be a number"),
    body("basicEmployeeShare").optional().isNumeric().withMessage("must be a number"),
    body("basicEmployerShare").optional().isNumeric().withMessage("must be a number"),
    body("overThresholdEmployeeShare").optional().isNumeric().withMessage("must be a number"),
    body("overThresholdEmployerShare").optional().isNumeric().withMessage("must be a number"),
    body("flatRateMaxDeduction").optional().isNumeric().withMessage("must be a number"),
    body("percentageRateSalaryThreshold").optional().isNumeric().withMessage("must be a number"),
    body("isBaseline").optional().isBoolean().withMessage("isBaseline must be a boolean"),
]);

export const validatePagIbigRateParamId = async (req, res, next) => {
    req.pagIbigRate = await existingPagIbigRate(req.params.pagIbigRateId);
    next();
};
