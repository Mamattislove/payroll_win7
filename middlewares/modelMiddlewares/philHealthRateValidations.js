import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingPhilHealthRate } from "../existingMiddleware.js";
import PhilHealthRate from "../../models/PhilHealthRate.js";

export const validatePhilHealthRateInput = withValidationErrors([
    body("year")
        .notEmpty().withMessage("year is required")
        .isInt({ min: 2000 }).withMessage("year must be a valid year")
        .custom(async (year) => {
            const existing = await PhilHealthRate.findOne({ year: Number(year) });
            if (existing) throw new Error("a PhilHealth rate for this year already exists");
        }),
    body("premiumRate").notEmpty().withMessage("premium rate is required").isNumeric().withMessage("premium rate must be a number"),
    body("employeeShare").notEmpty().withMessage("employee share is required").isNumeric().withMessage("employee share must be a number"),
    body("minimumSalaryThreshold").notEmpty().withMessage("minimum salary threshold is required").isNumeric().withMessage("must be a number"),
    body("deductionCeiling").optional().isNumeric().withMessage("deduction ceiling must be a number"),
]);

export const validatePhilHealthRateUpdateInput = withValidationErrors([
    body("year")
        .optional().isInt({ min: 2000 }).withMessage("year must be a valid year")
        .custom(async (year, { req }) => {
            const existing = await PhilHealthRate.findOne({ year: Number(year), _id: { $ne: req.params.philHealthRateId } });
            if (existing) throw new Error("a PhilHealth rate for this year already exists");
        }),
    body("premiumRate").optional().isNumeric().withMessage("premium rate must be a number"),
    body("employeeShare").optional().isNumeric().withMessage("employee share must be a number"),
    body("minimumSalaryThreshold").optional().isNumeric().withMessage("must be a number"),
    body("deductionCeiling").optional().isNumeric().withMessage("deduction ceiling must be a number"),
]);

export const validatePhilHealthRateParamId = async (req, res, next) => {
    req.philHealthRate = await existingPhilHealthRate(req.params.philHealthRateId);
    next();
};
