import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingLeaveApplication,
    existingEmployee,
    existingLeaveType,
} from "../existingMiddleware.js";
import {
    LEAVE_STATUS,
    LEAVE_WITH_PAY,
    LEAVE_HALFDAY,
} from "../../utils/constants.js";

export const validateLeaveApplicationInput = withValidationErrors([
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (id) => {
            await existingEmployee(id);
        }),
    body("leaveType")
        .notEmpty()
        .withMessage("leave type is required")
        .custom(async (id) => {
            await existingLeaveType(id);
        }),
    body("dateFrom")
        .notEmpty()
        .withMessage("date from is required")
        .isDate()
        .withMessage("date from is invalid"),
    body("dateTo")
        .notEmpty()
        .withMessage("date to is required")
        .isDate()
        .withMessage("date to is invalid"),
    body("notes").optional(),
    body("withPay")
        .optional()
        .isIn(Object.values(LEAVE_WITH_PAY))
        .withMessage("invalid with pay value"),
    body("halfday")
        .optional()
        .isIn(Object.values(LEAVE_HALFDAY))
        .withMessage("invalid halfday value"),
    body("status")
        .optional()
        .isIn(Object.values(LEAVE_STATUS))
        .withMessage("invalid status"),
]);

export const validateLeaveApplicationUpdateInput = withValidationErrors([
    body("employee")
        .optional()
        .custom(async (id) => {
            await existingEmployee(id);
        }),
    body("leaveType")
        .optional()
        .custom(async (id) => {
            await existingLeaveType(id);
        }),
    body("dateFrom").optional().isDate().withMessage("date from is invalid"),
    body("dateTo").optional().isDate().withMessage("date to is invalid"),
    body("notes").optional(),
    body("withPay")
        .optional()
        .isIn(Object.values(LEAVE_WITH_PAY))
        .withMessage("invalid with pay value"),
    body("halfday")
        .optional()
        .isIn(Object.values(LEAVE_HALFDAY))
        .withMessage("invalid halfday value"),
    body("status")
        .optional()
        .isIn(Object.values(LEAVE_STATUS))
        .withMessage("invalid status"),
]);

export const validateLeaveApplicationParamId = async (req, res, next) => {
    req.leaveApplication = await existingLeaveApplication(
        req.params.leaveApplicationId,
    );
    next();
};
