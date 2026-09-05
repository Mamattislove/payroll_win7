import { Router } from "express";
import {
    getAllEarningRecords, getEarningRecord,
    createEarningRecord, updateEarningRecord, deleteEarningRecord,
} from "../controllers/earningRecordController.js";
import {
    validateEarningRecordInput, validateEarningRecordUpdateInput, validateEarningRecordParamId,
} from "../middlewares/modelMiddlewares/earningRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router.route("/")
    .get(getAllEarningRecords)
    .post(authorizePermission(USER_ROLES.HR), validateEarningRecordInput, createEarningRecord);

router.route("/:earningRecordId")
    .all(validateEarningRecordParamId)
    .get(getEarningRecord)
    .patch(authorizePermission(USER_ROLES.HR), validateEarningRecordUpdateInput, updateEarningRecord)
    .delete(authorizePermission(USER_ROLES.HR), deleteEarningRecord);

export default router;
