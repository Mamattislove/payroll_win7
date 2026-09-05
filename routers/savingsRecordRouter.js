import { Router } from "express";
import {
    getAllSavingsRecords,
    getSavingsRecord,
    createSavingsRecord,
    deleteSavingsRecord,
} from "../controllers/savingsRecordController.js";
import {
    validateSavingsRecordInput,
    validateSavingsRecordParamId,
} from "../middlewares/modelMiddlewares/savingsRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllSavingsRecords)
    .post(authorizePermission(USER_ROLES.HR), validateSavingsRecordInput, createSavingsRecord);

router
    .route("/:savingsRecordId")
    .all(validateSavingsRecordParamId)
    .get(getSavingsRecord)
    .delete(authorizePermission(USER_ROLES.HR), deleteSavingsRecord);

export default router;
