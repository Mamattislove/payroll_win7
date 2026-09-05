import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingSSSRate } from "../existingMiddleware.js";
import SSSRate from "../../models/SSSRate.js";

const numericOptional = (field, label) =>
    body(field).optional().isNumeric().withMessage(`${label} must be a number`);

const sharedOptionalFields = [
    body("effectiveDate").optional().isISO8601().withMessage("effective date must be a valid date"),
    body("compensationFrom").optional().isNumeric().withMessage("compensation from must be a number"),
    body("compensationTo").optional().isNumeric().withMessage("compensation to must be a number"),
    numericOptional("employeeMPF", "employee MPF"),
    numericOptional("employerMPF", "employer MPF"),
    body("isBaseline").optional().isBoolean().withMessage("isBaseline must be a boolean"),
];

export const validateSSSRateInput = withValidationErrors([
    body("year")
        .notEmpty()
        .withMessage("year is required")
        .isInt({ min: 2000 })
        .withMessage("year must be a valid year"),
    body("msc")
        .notEmpty()
        .withMessage("MSC is required")
        .isNumeric()
        .withMessage("MSC must be a number")
        .custom(async (msc, { req }) => {
            const duplicate = await SSSRate.findOne({
                year: req.body.year,
                msc: Number(msc),
            });
            if (duplicate)
                throw new Error("an SSS rate for this year and MSC already exists");
        }),
    body("employeeShare")
        .notEmpty()
        .withMessage("employee share is required")
        .isNumeric()
        .withMessage("employee share must be a number"),
    body("employerShare")
        .notEmpty()
        .withMessage("employer share is required")
        .isNumeric()
        .withMessage("employer share must be a number"),
    body("employerEC")
        .notEmpty()
        .withMessage("employer EC is required")
        .isNumeric()
        .withMessage("employer EC must be a number"),
    body("totalEmployeeContribution")
        .notEmpty()
        .withMessage("total employee contribution is required")
        .isNumeric()
        .withMessage("total employee contribution must be a number"),
    body("totalEmployerContribution")
        .notEmpty()
        .withMessage("total employer contribution is required")
        .isNumeric()
        .withMessage("total employer contribution must be a number"),
    body("totalContribution")
        .notEmpty()
        .withMessage("total contribution is required")
        .isNumeric()
        .withMessage("total contribution must be a number"),
    ...sharedOptionalFields,
]);

export const validateSSSRateUpdateInput = withValidationErrors([
    body("year").optional().isInt({ min: 2000 }).withMessage("year must be a valid year"),
    body("msc")
        .optional()
        .isNumeric()
        .withMessage("MSC must be a number")
        .custom(async (msc, { req }) => {
            const year = req.body.year ?? req.sssRate.year;
            const conflict = await SSSRate.findOne({
                year,
                msc: Number(msc),
                _id: { $ne: req.sssRate._id },
            });
            if (conflict)
                throw new Error("an SSS rate for this year and MSC already exists");
        }),
    body("employeeShare").optional().isNumeric().withMessage("employee share must be a number"),
    body("employerShare").optional().isNumeric().withMessage("employer share must be a number"),
    body("employerEC").optional().isNumeric().withMessage("employer EC must be a number"),
    body("totalEmployeeContribution").optional().isNumeric().withMessage("total employee contribution must be a number"),
    body("totalEmployerContribution").optional().isNumeric().withMessage("total employer contribution must be a number"),
    body("totalContribution").optional().isNumeric().withMessage("total contribution must be a number"),
    ...sharedOptionalFields,
]);

export const validateSSSRateParamId = async (req, res, next) => {
    const { sssRateId } = req.params;
    const sssRate = await existingSSSRate(sssRateId);
    req.sssRate = sssRate;
    next();
};
