import { Router } from "express";
import {
    getAllChargeRecords, getChargeRecord,
    createChargeRecord, updateChargeRecord, deleteChargeRecord,
} from "../controllers/chargeRecordController.js";
import {
    validateChargeRecordInput, validateChargeRecordUpdateInput, validateChargeRecordParamId,
} from "../middlewares/modelMiddlewares/chargeRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

router.route("/")
    .get(getAllChargeRecords)
    .post(authorizePermission(...WRITE_ROLES.chargeRecords), validateChargeRecordInput, createChargeRecord);

router.route("/:chargeRecordId")
    .all(validateChargeRecordParamId)
    .get(getChargeRecord)
    .patch(authorizePermission(...WRITE_ROLES.chargeRecords), validateChargeRecordUpdateInput, updateChargeRecord)
    .delete(authorizePermission(...WRITE_ROLES.chargeRecords), deleteChargeRecord);

export default router;
