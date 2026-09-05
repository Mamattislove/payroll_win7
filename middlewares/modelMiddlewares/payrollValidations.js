import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingCompensation,
    existingEarningRecord,
    existingAllowanceRecord,
    existingDeductionRecord,
    existingSavingsRecord,
    existingLoanPayment,
    existingChargeRecord,
    existingPayroll,
} from "../existingMiddleware.js";
import Payroll from "../../models/Payroll.js";

// Blocked on both create and update — always server-computed from attendance/records
const attendanceAndTotalFields = [
    "regularPay",
    "regularOTPay",
    "holidayRestDayPay",
    "holidayRestDayOTPay",
    "nightDifferentialPay",
    "leavePay",
    "daysWorked",
    "leaveDays",
    "absences",
    "late",
    "undertime",
    "grossPay",
    "totalDeductions",
    "netSalary",
    "finalPay",
    "earning", // auto-managed ObjectId array on Payroll — use "earnings" to submit record ids
];

// Blocked on create only — server looks them up from rate tables; user can override via PATCH
const createOnlyComputedFields = [
    "sssContribution",
    "philhealthContribution",
    "pagibigContribution",
    "withholdingTax",
];

const sharedOptionalFields = [
    body("payrollFrom")
        .optional()
        .isISO8601()
        .withMessage("payroll from must be a valid date"),
    body("payrollTo")
        .optional()
        .isISO8601()
        .withMessage("payroll to must be a valid date"),
    body("payrollDate")
        .optional()
        .isISO8601()
        .withMessage("payroll date must be a valid date"),
    body("autoDeductDeductions").optional().isBoolean(),
    body("autoDeductLoans").optional().isBoolean(),
    body("autoDeductSavings").optional().isBoolean(),
    body("autoDeductLoanApplications").optional().isBoolean(),
    body("attendance")
        .optional()
        .isArray()
        .withMessage("attendance must be an array"),
    body("attendance.*")
        .optional()
        .isMongoId()
        .withMessage("each attendance id must be a valid id"),
    body("createdBy").optional(),
    body("locked")
        .optional()
        .isBoolean()
        .withMessage("locked must be true or false"),
];

// Builds a custom validator that checks a record id exists and is either
// unlinked or already linked to the payroll being updated (not some other one).
const linkableRecordValidator = (existingFn, label) =>
    async (recordId, { req }) => {
        const record = await existingFn(recordId);
        const currentPayrollId = req.payroll?._id?.toString();
        if (record.payroll && record.payroll.toString() !== currentPayrollId) {
            throw new Error(
                `this ${label} record is already linked to a different payroll`,
            );
        }
    };

const recordArrayFields = [
    body("earnings").optional().isArray().withMessage("earnings must be an array"),
    body("earnings.*").custom(linkableRecordValidator(existingEarningRecord, "earning")),
    body("allowances").optional().isArray().withMessage("allowances must be an array"),
    body("allowances.*").custom(linkableRecordValidator(existingAllowanceRecord, "allowance")),
    body("deductions").optional().isArray().withMessage("deductions must be an array"),
    body("deductions.*").custom(linkableRecordValidator(existingDeductionRecord, "deduction")),
    body("savings").optional().isArray().withMessage("savings must be an array"),
    body("savings.*").custom(linkableRecordValidator(existingSavingsRecord, "savings payment")),
    body("loans").optional().isArray().withMessage("loans must be an array"),
    body("loans.*").custom(linkableRecordValidator(existingLoanPayment, "loan payment")),
    body("charges").optional().isArray().withMessage("charges must be an array"),
    body("charges.*").custom(linkableRecordValidator(existingChargeRecord, "charge")),
];

export const validatePayrollInput = withValidationErrors([
    body("compensation")
        .notEmpty()
        .withMessage("compensation is required")
        .custom(async (compensationId, { req }) => {
            const compensation = await existingCompensation(compensationId);
            req.compensation = compensation;
            if (req.body.payrollFrom) {
                const duplicate = await Payroll.findOne({
                    compensation: compensationId,
                    payrollFrom: new Date(req.body.payrollFrom),
                });
                if (duplicate)
                    throw new Error(
                        "a payroll record already exists for this compensation and period",
                    );
            }
        }),
    body("payrollFrom")
        .notEmpty()
        .withMessage("payroll from is required")
        .isISO8601()
        .withMessage("payroll from must be a valid date"),
    body("payrollTo")
        .notEmpty()
        .withMessage("payroll to is required")
        .isISO8601()
        .withMessage("payroll to must be a valid date"),
    body("payrollDate")
        .optional()
        .isISO8601()
        .withMessage("payroll date must be a valid date"),
    body("autoDeductDeductions").optional().isBoolean(),
    body("autoDeductLoans").optional().isBoolean(),
    body("autoDeductSavings").optional().isBoolean(),
    body("autoDeductLoanApplications").optional().isBoolean(),
    body("attendance")
        .optional()
        .isArray()
        .withMessage("attendance must be an array"),
    body("attendance.*")
        .optional()
        .isMongoId()
        .withMessage("each attendance id must be a valid id"),
    body("createdBy").optional(),
    ...recordArrayFields,
    ...[...attendanceAndTotalFields, ...createOnlyComputedFields].map((field) =>
        body(field)
            .not()
            .exists()
            .withMessage(`${field} is computed automatically, do not send it`),
    ),
]);

export const validatePayrollUpdateInput = withValidationErrors([
    ...sharedOptionalFields,
    // Allow sss/philhealth/pagibig/withholdingTax to be patched (user override)
    body("sssContribution").optional().isNumeric().withMessage("sssContribution must be a number"),
    body("philhealthContribution").optional().isNumeric().withMessage("philhealthContribution must be a number"),
    body("pagibigContribution").optional().isNumeric().withMessage("pagibigContribution must be a number"),
    body("withholdingTax").optional().isNumeric().withMessage("withholdingTax must be a number"),
    ...recordArrayFields,
    ...attendanceAndTotalFields.map((field) =>
        body(field)
            .not()
            .exists()
            .withMessage(`${field} is computed automatically, do not send it`),
    ),
]);

export const validatePayrollParamId = async (req, res, next) => {
    const { payrollId } = req.params;
    const payroll = await existingPayroll(payrollId);
    req.payroll = payroll;
    next();
};
