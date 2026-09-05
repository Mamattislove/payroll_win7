import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingLeaveType } from "../existingMiddleware.js";
import LeaveType from "../../models/LeaveType.js";

export const validateLeaveTypeInput = withValidationErrors([
    body("leaveTypeName")
        .notEmpty().withMessage("leave type name is required")
        .custom(async (leaveTypeName) => {
            const existing = await LeaveType.findOne({ leaveTypeName });
            if (existing) throw new Error("leave type name already exists");
        }),
]);

export const validateLeaveTypeUpdateInput = withValidationErrors([
    body("leaveTypeName")
        .optional().notEmpty().withMessage("leave type name cannot be empty")
        .custom(async (leaveTypeName, { req }) => {
            const existing = await LeaveType.findOne({ leaveTypeName, _id: { $ne: req.params.leaveTypeId } });
            if (existing) throw new Error("leave type name already exists");
        }),
]);

export const validateLeaveTypeParamId = async (req, res, next) => {
    req.leaveType = await existingLeaveType(req.params.leaveTypeId);
    next();
};
