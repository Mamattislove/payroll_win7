import { Router } from "express";
import {
    getAllSavings,
    getSavings,
    createSavings,
    updateSavings,
    deleteSavings,
} from "../controllers/savingsController.js";
import {
    validateSavingsInput,
    validateSavingsUpdateInput,
    validateSavingsParamId,
} from "../middlewares/modelMiddlewares/savingsValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllSavings)
    .post(authorizePermission(USER_ROLES.HR), validateSavingsInput, createSavings);

router
    .route("/:savingsId")
    .all(validateSavingsParamId)
    .get(getSavings)
    .patch(authorizePermission(USER_ROLES.HR), validateSavingsUpdateInput, updateSavings)
    .delete(authorizePermission(USER_ROLES.HR), deleteSavings);

export default router;
