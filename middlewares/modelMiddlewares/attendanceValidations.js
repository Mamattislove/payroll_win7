import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { DAY_TYPES } from "../../utils/constants.js";
import {
    existingAttendance,
    existingCompensation,
} from "../existingMiddleware.js";
import Attendance from "../../models/Attendance.js";

const NO_WORK_DAY_TYPES = new Set([
    DAY_TYPES.REST_DAY, // "Rest Day (OFF / Absent)"
    DAY_TYPES.ABSENT, // "Absent"
    DAY_TYPES.LEAVE, // "Leave"
]);

const computedPayFields = [
    "regularHoursPay",
    "overtimeHoursPay",
    "nightPremiumPay",
    "overtimeNightPremiumPay",
    "lateDeduction",
    "undertimeDeduction",
];

const sharedOptionalFields = [
    body("dayType")
        .optional()
        .isIn(Object.values(DAY_TYPES))
        .withMessage("invalid day type"),
    body("timeIn")
        .optional()
        .matches(/^\d{2}:\d{2}$/)
        .withMessage("timeIn must be in HH:MM format"),
    body("timeOut")
        .optional()
        .matches(/^\d{2}:\d{2}$/)
        .withMessage("timeOut must be in HH:MM format"),
    body("lateHr")
        .optional()
        .isNumeric()
        .withMessage("late hours must be a number"),
    body("undertimeHr")
        .optional()
        .isNumeric()
        .withMessage("undertime hours must be a number"),
    body("regularHours")
        .optional()
        .isNumeric()
        .withMessage("regular hours must be a number"),
    body("overtimeHours")
        .optional()
        .isNumeric()
        .withMessage("overtime hours must be a number"),
    body("nightPremiumHours")
        .optional()
        .isNumeric()
        .withMessage("night premium hours must be a number"),
    body("overtimeNightPremiumHours")
        .optional()
        .isNumeric()
        .withMessage("overtime night premium hours must be a number"),
    body("remarks").optional().isString(),
    ...computedPayFields.map((field) =>
        body(field)
            .not()
            .exists()
            .withMessage(`${field} is computed automatically, do not send it`),
    ),
];

export const validateAttendanceInput = withValidationErrors([
    body("compensation")
        .notEmpty()
        .withMessage("compensation is required")
        .custom(async (compensationId, { req }) => {
            const compensation = await existingCompensation(compensationId);
            req.compensation = compensation;
        }),
    body("attendanceDate")
        .notEmpty()
        .withMessage("attendance date is required")
        .isISO8601()
        .withMessage("attendance date is invalid")
        .custom(async (attendanceDate, { req }) => {
            const existing = await Attendance.findOne({
                compensation: req.body.compensation,
                attendanceDate: new Date(attendanceDate),
            });
            if (existing)
                throw new Error(
                    "attendance already exists for this compensation on this date",
                );
        }),
    ...sharedOptionalFields,
    // body("regularHours").custom((_, { req }) => {
    //     if (NO_WORK_DAY_TYPES.has(req.body.dayType)) return true;
    //     const rh = Number(req.body.regularHours ?? 0);
    //     const ndh = Number(req.body.nightPremiumHours ?? 0);
    //     if (rh === 0 && ndh === 0)
    //         throw new Error(
    //             "at least one of regularHours or nightPremiumHours must be greater than zero",
    //         );
    //     return true;
    // }),
]);

export const validateBulkAttendanceInput = withValidationErrors([
    body("compensation")
        .notEmpty()
        .withMessage("compensation is required")
        .custom(async (compensationId, { req }) => {
            const compensation = await existingCompensation(compensationId);
            req.compensation = compensation;
        }),
    body("records")
        .isArray({ min: 1 })
        .withMessage("records must be a non-empty array"),
    body("records.*.attendanceDate")
        .notEmpty()
        .withMessage("each record needs an attendanceDate")
        .isISO8601()
        .withMessage("attendanceDate is invalid"),
    body("records.*.dayType")
        .optional()
        .isIn(Object.values(DAY_TYPES))
        .withMessage("invalid day type"),
    body("records.*.lateHr").optional().isNumeric(),
    body("records.*.undertimeHr").optional().isNumeric(),
    body("records.*.regularHours").optional().isNumeric(),
    body("records.*.overtimeHours").optional().isNumeric(),
    body("records.*.nightPremiumHours").optional().isNumeric(),
    body("records.*.overtimeNightPremiumHours").optional().isNumeric(),
    body("records.*.remarks").optional().isString(),
    body("records").custom((records) => {
        const seen = new Set();
        for (const r of records) {
            const key = new Date(r.attendanceDate).toISOString();
            if (seen.has(key))
                throw new Error(
                    `duplicate attendanceDate in records: ${r.attendanceDate}`,
                );
            seen.add(key);
        }
        return true;
    }),
]);

export const validateAttendanceUpdateInput = withValidationErrors([
    body("compensation")
        .optional()
        .custom(async (compensationId) => {
            await existingCompensation(compensationId);
        }),
    body("attendanceDate")
        .optional()
        .isISO8601()
        .withMessage("attendance date is invalid")
        .custom(async (attendanceDate, { req }) => {
            const compensationId =
                req.body.compensation ??
                req.attendance?.compensation?._id ??
                req.attendance?.compensation;
            const existing = await Attendance.findOne({
                compensation: compensationId,
                attendanceDate: new Date(attendanceDate),
                _id: { $ne: req.params.attendanceId },
            });
            if (existing)
                throw new Error(
                    "attendance already exists for this compensation on this date",
                );
        }),
    ...sharedOptionalFields,
    // body("regularHours").custom((_, { req }) => {
    //     const dayType = req.body.dayType ?? req.attendance?.dayType;
    //     if (NO_WORK_DAY_TYPES.has(dayType)) return true;
    //     const rh = Number(
    //         req.body.regularHours ?? req.attendance?.regularHours ?? 0,
    //     );
    //     const ndh = Number(
    //         req.body.nightPremiumHours ??
    //             req.attendance?.nightPremiumHours ??
    //             0,
    //     );
    //     if (rh === 0 && ndh === 0)
    //         throw new Error(
    //             "at least one of regularHours or nightPremiumHours must be greater than zero",
    //         );
    //     return true;
    // }),
]);

export const validateAttendanceParamId = async (req, res, next) => {
    const { attendanceId } = req.params;
    const attendance = await existingAttendance(attendanceId);
    req.attendance = attendance;
    next();
};
