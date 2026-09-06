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
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

router
    .route("/")
    .get(getAllSavingsRecords)
    .post(authorizePermission(...WRITE_ROLES.savingsRecords), validateSavingsRecordInput, createSavingsRecord);

router
    .route("/:savingsRecordId")
    .all(validateSavingsRecordParamId)
    .get(getSavingsRecord)
    .delete(authorizePermission(...WRITE_ROLES.savingsRecords), deleteSavingsRecord);

export default router;
