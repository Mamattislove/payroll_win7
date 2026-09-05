import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingClient } from "../existingMiddleware.js";

export const validateClientInput = withValidationErrors([
    body("clientName").notEmpty().withMessage("client name is required"),
    body("clientAddress").optional(),
    body("clientEmail")
        .optional()
        .isEmail()
        .withMessage("invalid client email"),
    body("clientTelephone").optional(),
    body("contactPerson").optional(),
    body("contactPersonNumber").optional(),
    body("contactPersonEmail")
        .optional()
        .isEmail()
        .withMessage("invalid contact person email"),
    body("clientSince").optional().isDate().withMessage("client since date is invalid"),
]);

export const validateClientUpdateInput = withValidationErrors([
    body("clientName")
        .optional()
        .notEmpty()
        .withMessage("client name cannot be empty"),
    body("clientAddress").optional(),
    body("clientEmail")
        .optional()
        .isEmail()
        .withMessage("invalid client email"),
    body("clientTelephone").optional(),
    body("contactPerson").optional(),
    body("contactPersonNumber").optional(),
    body("contactPersonEmail")
        .optional()
        .isEmail()
        .withMessage("invalid contact person email"),
    body("clientSince")
        .optional()
        .isDate()
        .withMessage("client since date is invalid"),
]);

export const validateClientParamId = async (req, res, next) => {
    req.client = await existingClient(req.params.clientId);
    next();
};
