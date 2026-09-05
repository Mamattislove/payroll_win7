import { Router } from "express";
import {
    getAllChargeRecords, getChargeRecord,
    createChargeRecord, updateChargeRecord, deleteChargeRecord,
} from "../controllers/chargeRecordController.js";
import {
    validateChargeRecordInput, validateChargeRecordUpdateInput, validateChargeRecordParamId,
} from "../middlewares/modelMiddlewares/chargeRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router.route("/")
    .get(getAllChargeRecords)
    .post(authorizePermission(USER_ROLES.HR), validateChargeRecordInput, createChargeRecord);

router.route("/:chargeRecordId")
    .all(validateChargeRecordParamId)
    .get(getChargeRecord)
    .patch(authorizePermission(USER_ROLES.HR), validateChargeRecordUpdateInput, updateChargeRecord)
    .delete(authorizePermission(USER_ROLES.HR), deleteChargeRecord);

export default router;
