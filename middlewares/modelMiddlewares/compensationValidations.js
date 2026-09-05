import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    CONTRACT_TYPES,
    DAYS,
    PAYROLL_PERIODS,
    COMPENSATION_STATUS,
    SSS_CONTRIBUTION_BASIS,
    PHILHEALTH_CONTRIBUTION_BASIS,
    PAGIBIG_CONTRIBUTION_BASIS,
    PAYROLL_EMPLOYMENT_TYPE,
} from "../../utils/constants.js";
import {
    existingCompensation,
    existingEmployeeDesignation,
} from "../existingMiddleware.js";
import Compensation from "../../models/Compensation.js";

const sharedOptionalFields = [
    body("weeklySchedule")
        .optional()
        .isArray()
        .withMessage("weekly schedule must be an array"),
    body("weeklySchedule.*")
        .optional()
        .isIn(Object.values(DAYS))
        .withMessage("invalid day in weekly schedule"),
    body("timeIn")
        .optional()
        .isString()
        .withMessage("time in must be a string"),
    body("timeOut")
        .optional()
        .isString()
        .withMessage("time out must be a string"),
    body("nightShiftTimeIn").optional().isString(),
    body("nightShiftTimeOut").optional().isString(),
    body("restDay")
        .optional()
        .isIn(Object.values(DAYS))
        .withMessage("invalid rest day"),
    body("startContract")
        .optional()
        .isISO8601()
        .withMessage("start contract must be a valid date"),
    body("endContract")
        .optional()
        .isISO8601()
        .withMessage("end contract must be a valid date"),
    body("dateOfRegularization")
        .optional()
        .isISO8601()
        .withMessage("date of regularization must be a valid date"),
    body("insuranceName").optional().isString(),
    body("dateInsured")
        .optional()
        .isISO8601()
        .withMessage("date insured must be a valid date"),
    body("insuredUntil")
        .optional()
        .isISO8601()
        .withMessage("insured until must be a valid date"),
    body("sssContributionBasis")
        .optional()
        .isIn(Object.values(SSS_CONTRIBUTION_BASIS))
        .withMessage("invalid SSS contribution basis"),
    body("philhealthContributionBasis")
        .optional()
        .isIn(Object.values(PHILHEALTH_CONTRIBUTION_BASIS))
        .withMessage("invalid PhilHealth contribution basis"),
    body("pagibigContributionBasis")
        .optional()
        .isIn(Object.values(PAGIBIG_CONTRIBUTION_BASIS))
        .withMessage("invalid Pag-IBIG contribution basis"),
    body("sssOverwriteAmount")
        .optional()
        .isNumeric()
        .withMessage("SSS overwrite amount must be a number"),
    body("philhealthOverwriteAmount")
        .optional()
        .isNumeric()
        .withMessage("PhilHealth overwrite amount must be a number"),
    body("pagibigOverwriteAmount")
        .optional()
        .isNumeric()
        .withMessage("Pag-IBIG overwrite amount must be a number"),
    body("terminateReason").optional().isString(),
    body("terminateDate")
        .optional()
        .isISO8601()
        .withMessage("terminate date must be a valid date"),
    body("terminateNotes").optional().isString(),
];

export const validateCompensationInput = withValidationErrors([
    body("employeeDesignation")
        .notEmpty()
        .withMessage("employee designation is required")
        .custom(async (employeeDesignationId) => {
            await existingEmployeeDesignation(employeeDesignationId);
            const duplicate = await Compensation.findOne({
                employeeDesignation: employeeDesignationId,
            });
            if (duplicate)
                throw new Error(
                    "a compensation record already exists for this employee designation",
                );
        }),
    body("monthlyRate")
        .isNumeric()
        .withMessage("monthly rate must be a number"),
    body("contractType")
        .isIn(Object.values(CONTRACT_TYPES))
        .withMessage("invalid contract type"),
    body("employmentType")
        .isIn(Object.values(PAYROLL_EMPLOYMENT_TYPE))
        .withMessage("invalid employment type"),
    body("payrollPeriod")
        .isIn(Object.values(PAYROLL_PERIODS))
        .withMessage("invalid payroll period"),
    ...sharedOptionalFields,
]);

export const validateCompensationUpdateInput = withValidationErrors([
    body("employeeDesignation")
        .optional()
        .custom(async (employeeDesignationId, { req }) => {
            await existingEmployeeDesignation(employeeDesignationId);
            const conflict = await Compensation.findOne({
                employeeDesignation: employeeDesignationId,
                _id: { $ne: req.compensation._id },
            });
            if (conflict)
                throw new Error(
                    "a compensation record already exists for this employee designation",
                );
        }),
    body("monthlyRate")
        .optional()
        .isNumeric()
        .withMessage("monthly rate must be a number"),
    body("contractType")
        .optional()
        .isIn(Object.values(CONTRACT_TYPES))
        .withMessage("invalid contract type"),
    body("employmentType")
        .optional()
        .isIn(Object.values(PAYROLL_EMPLOYMENT_TYPE))
        .withMessage("invalid employment type"),
    body("payrollPeriod")
        .optional()
        .isIn(Object.values(PAYROLL_PERIODS))
        .withMessage("invalid payroll period"),
    ...sharedOptionalFields,
]);

export const validateCompensationParamId = async (req, res, next) => {
    const { compensationId } = req.params;
    const compensation = await existingCompensation(compensationId);
    req.compensation = compensation;
    next();
};
