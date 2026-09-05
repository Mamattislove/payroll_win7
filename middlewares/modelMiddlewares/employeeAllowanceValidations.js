import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingEmployeeAllowance, existingEmployee, existingAllowanceType } from "../existingMiddleware.js";
import { PAYROLL_PERIODS, COMPENSATION_STATUS } from "../../utils/constants.js";
import EmployeeAllowance from "../../models/EmployeeAllowance.js";

export const validateEmployeeAllowanceInput = withValidationErrors([
    body("employee").notEmpty().withMessage("employee is required").custom(async (id) => { await existingEmployee(id); }),
    body("allowanceType")
        .notEmpty().withMessage("allowance type is required")
        .custom(async (allowanceTypeId, { req }) => {
            await existingAllowanceType(allowanceTypeId);
            const duplicate = await EmployeeAllowance.findOne({ employee: req.body.employee, allowanceType: allowanceTypeId });
            if (duplicate) throw new Error("this employee already has this allowance type");
        }),
    body("amount").notEmpty().withMessage("amount is required").isNumeric().withMessage("amount must be a number"),
    body("payrollPeriod").optional().isIn(Object.values(PAYROLL_PERIODS)).withMessage("invalid payroll period"),
    body("activeStatus").optional().isIn(Object.values(COMPENSATION_STATUS)).withMessage("invalid active status"),
]);

export const validateEmployeeAllowanceUpdateInput = withValidationErrors([
    body("allowanceType")
        .optional()
        .custom(async (allowanceTypeId, { req }) => {
            await existingAllowanceType(allowanceTypeId);
            const conflict = await EmployeeAllowance.findOne({
                employee: req.employeeAllowance.employee,
                allowanceType: allowanceTypeId,
                _id: { $ne: req.employeeAllowance._id },
            });
            if (conflict) throw new Error("this employee already has this allowance type");
        }),
    body("amount").optional().isNumeric().withMessage("amount must be a number"),
    body("payrollPeriod").optional().isIn(Object.values(PAYROLL_PERIODS)).withMessage("invalid payroll period"),
    body("activeStatus").optional().isIn(Object.values(COMPENSATION_STATUS)).withMessage("invalid active status"),
]);

export const validateEmployeeAllowanceParamId = async (req, res, next) => {
    req.employeeAllowance = await existingEmployeeAllowance(req.params.employeeAllowanceId);
    next();
};
