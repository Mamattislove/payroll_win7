import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import { BadRequestError, NotFoundError } from "../errors/customErrors.js";
import User from "../models/User.js";
import { USER_ROLES } from "../utils/constants.js";

export const withValidationErrors = (validateValues) => {
    return [
        ...validateValues,
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorMessages = errors.array().map((error) => error.msg);
                throw new BadRequestError(errorMessages);
            }
            next();
        },
    ];
};

export const valitdateAuthRegisterinput = withValidationErrors([
    body("username")
        .trim()
        .notEmpty()
        .withMessage("username is required")
        .custom(async (username) => {
            const user = await User.findOne({ username });
            if (user) {
                throw new BadRequestError("that username is already in use");
            }
        }),
    body("email")
        .notEmpty()
        .withMessage("email is required")
        .isEmail()
        .withMessage("invalid email format")
        .custom(async (email) => {
            const user = await User.findOne({ email });
            if (user) {
                throw new BadRequestError("user is already exist");
            }
        }),
    body("password").notEmpty().withMessage("password is required"),
    body("role")
        .optional()
        .isIn(Object.values(USER_ROLES))
        .withMessage("invalid role"),
    body("confirmPassword")
        .notEmpty()
        .withMessage("confirm password is required")
        .custom(
            (confirmPassword, { req }) => confirmPassword === req.body.password,
        )
        .withMessage("password and confirm password are not equal"),
]);

export const validateAuthLoginInput = withValidationErrors([
    body("username").trim().notEmpty().withMessage("username is required"),
    body("password").notEmpty().withMessage("password is required"),
]);

export const validateIdParam = async (req, res, next) => {
    const { id } = req.params;
    if (!isValidMongoId(id)) {
        throw new BadRequestError("invalid Mongo ID");
    }
    next();
};

// Admin user-management edits. Every field is optional (the form patches only
// what changed), but each must still be valid when present. Email uniqueness is
// checked against other users so saving a user without changing their email
// does not trip the "already exists" rule.
export const validateUserUpdateInput = withValidationErrors([
    body("username")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("username cannot be empty")
        .custom(async (username, { req }) => {
            const existing = await User.findOne({ username });
            if (existing && String(existing._id) !== req.params.userId) {
                throw new BadRequestError("that username is already in use");
            }
        }),
    body("email")
        .optional()
        .isEmail()
        .withMessage("invalid email format")
        .custom(async (email, { req }) => {
            const existing = await User.findOne({ email });
            if (existing && String(existing._id) !== req.params.userId) {
                throw new BadRequestError("that email is already in use");
            }
        }),
    body("role")
        .optional()
        .isIn(Object.values(USER_ROLES))
        .withMessage("invalid role"),
]);

export const validatePasswordResetInput = withValidationErrors([
    body("password")
        .notEmpty()
        .withMessage("password is required")
        .isLength({ min: 8 })
        .withMessage("password must be at least 8 characters"),
    body("confirmPassword")
        .notEmpty()
        .withMessage("confirm password is required")
        .custom((confirmPassword, { req }) => confirmPassword === req.body.password)
        .withMessage("password and confirm password are not equal"),
]);
