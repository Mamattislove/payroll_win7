import { Router } from "express";
import {
    getAllAllowanceRecords, getAllowanceRecord,
    createAllowanceRecord, updateAllowanceRecord, deleteAllowanceRecord,
} from "../controllers/allowanceRecordController.js";
import {
    validateAllowanceRecordInput, validateAllowanceRecordUpdateInput, validateAllowanceRecordParamId,
} from "../middlewares/modelMiddlewares/allowanceRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router.route("/")
    .get(getAllAllowanceRecords)
    .post(authorizePermission(USER_ROLES.HR), validateAllowanceRecordInput, createAllowanceRecord);

router.route("/:allowanceRecordId")
    .all(validateAllowanceRecordParamId)
    .get(getAllowanceRecord)
    .patch(authorizePermission(USER_ROLES.HR), validateAllowanceRecordUpdateInput, updateAllowanceRecord)
    .delete(authorizePermission(USER_ROLES.HR), deleteAllowanceRecord);

export default router;
