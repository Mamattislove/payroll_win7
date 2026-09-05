import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";

export const validateSettingsInput = withValidationErrors([
    body("philhealthOverwriteAmount").optional().isNumeric().withMessage("PhilHealth overwrite amount must be a number"),
    body("pagibigOverwriteAmount").optional().isNumeric().withMessage("Pag-IBIG overwrite amount must be a number"),
]);
