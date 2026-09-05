import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import { existingPosition } from "../existingMiddleware.js";
import Position from "../../models/Position.js";

export const validatePositionInput = withValidationErrors([
    body("positionName")
        .notEmpty()
        .withMessage("position name is required")
        .custom(async (positionName) => {
            const existing = await Position.findOne({ positionName });
            if (existing) throw new Error("position name already exists");
        }),
    body("positionDesc").optional(),
]);

export const validatePositionUpdateInput = withValidationErrors([
    body("positionName")
        .optional()
        .notEmpty()
        .withMessage("position name cannot be empty")
        .custom(async (positionName, { req }) => {
            const existing = await Position.findOne({
                positionName,
                _id: { $ne: req.params.positionId },
            });
            if (existing) throw new Error("position name already exists");
        }),
    body("positionDesc").optional(),
]);

export const validatePositionParamId = async (req, res, next) => {
    const { positionId } = req.params;
    const position = await existingPosition(positionId);
    req.position = position;
    next();
};
