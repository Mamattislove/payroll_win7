import { Router } from "express";
import {
    getAllAllowanceRecords, getAllowanceRecord,
    createAllowanceRecord, updateAllowanceRecord, deleteAllowanceRecord,
} from "../controllers/allowanceRecordController.js";
import {
    validateAllowanceRecordInput, validateAllowanceRecordUpdateInput, validateAllowanceRecordParamId,
} from "../middlewares/modelMiddlewares/allowanceRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

router.route("/")
    .get(getAllAllowanceRecords)
    .post(authorizePermission(...WRITE_ROLES.allowanceRecords), validateAllowanceRecordInput, createAllowanceRecord);

router.route("/:allowanceRecordId")
    .all(validateAllowanceRecordParamId)
    .get(getAllowanceRecord)
    .patch(authorizePermission(...WRITE_ROLES.allowanceRecords), validateAllowanceRecordUpdateInput, updateAllowanceRecord)
    .delete(authorizePermission(...WRITE_ROLES.allowanceRecords), deleteAllowanceRecord);

export default router;
