import { Router } from "express";
import {
    getAllEarningRecords, getEarningRecord,
    createEarningRecord, updateEarningRecord, deleteEarningRecord,
} from "../controllers/earningRecordController.js";
import {
    validateEarningRecordInput, validateEarningRecordUpdateInput, validateEarningRecordParamId,
} from "../middlewares/modelMiddlewares/earningRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

router.route("/")
    .get(getAllEarningRecords)
    .post(authorizePermission(...WRITE_ROLES.earningRecords), validateEarningRecordInput, createEarningRecord);

router.route("/:earningRecordId")
    .all(validateEarningRecordParamId)
    .get(getEarningRecord)
    .patch(authorizePermission(...WRITE_ROLES.earningRecords), validateEarningRecordUpdateInput, updateEarningRecord)
    .delete(authorizePermission(...WRITE_ROLES.earningRecords), deleteEarningRecord);

export default router;
