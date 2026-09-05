import { Router } from "express";
import {
    getAllSSSRates,
    getSSSRate,
    createSSSRate,
    updateSSSRate,
    deleteSSSRate,
} from "../controllers/sssRateController.js";
import {
    validateSSSRateInput,
    validateSSSRateUpdateInput,
    validateSSSRateParamId,
} from "../middlewares/modelMiddlewares/sssRateValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllSSSRates)
    .post(authorizePermission(USER_ROLES.HR), validateSSSRateInput, createSSSRate);

router
    .route("/:sssRateId")
    .all(validateSSSRateParamId)
    .get(getSSSRate)
    .patch(authorizePermission(USER_ROLES.HR), validateSSSRateUpdateInput, updateSSSRate)
    .delete(authorizePermission(USER_ROLES.HR), deleteSSSRate);

export default router;
