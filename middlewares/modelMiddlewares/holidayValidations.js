import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingHoliday } from "../existingMiddleware.js";
import { HOLIDAY_TYPES } from "../../utils/constants.js";
import Holiday from "../../models/Holiday.js";

export const validateHolidayInput = withValidationErrors([
    body("date")
        .notEmpty().withMessage("date is required")
        .isDate().withMessage("date is invalid")
        .custom(async (date) => {
            const existing = await Holiday.findOne({ date: new Date(date) });
            if (existing) throw new Error("a holiday already exists on this date");
        }),
    body("eventName").notEmpty().withMessage("event name is required"),
    body("specialLegal")
        .notEmpty().withMessage("type is required")
        .isIn(Object.values(HOLIDAY_TYPES)).withMessage("invalid holiday type"),
]);

export const validateHolidayUpdateInput = withValidationErrors([
    body("date")
        .optional().isDate().withMessage("date is invalid")
        .custom(async (date, { req }) => {
            const existing = await Holiday.findOne({ date: new Date(date), _id: { $ne: req.params.holidayId } });
            if (existing) throw new Error("a holiday already exists on this date");
        }),
    body("eventName").optional().notEmpty().withMessage("event name cannot be empty"),
    body("specialLegal").optional().isIn(Object.values(HOLIDAY_TYPES)).withMessage("invalid holiday type"),
]);

export const validateHolidayParamId = async (req, res, next) => {
    req.holiday = await existingHoliday(req.params.holidayId);
    next();
};
