import { Router } from "express";
import {
    getAllDeductionRecords, getDeductionRecord,
    createDeductionRecord, updateDeductionRecord, deleteDeductionRecord,
} from "../controllers/deductionRecordController.js";
import {
    validateDeductionRecordInput, validateDeductionRecordUpdateInput, validateDeductionRecordParamId,
} from "../middlewares/modelMiddlewares/deductionRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

router.route("/")
    .get(getAllDeductionRecords)
    .post(authorizePermission(...WRITE_ROLES.deductionRecords), validateDeductionRecordInput, createDeductionRecord);

router.route("/:deductionRecordId")
    .all(validateDeductionRecordParamId)
    .get(getDeductionRecord)
    .patch(authorizePermission(...WRITE_ROLES.deductionRecords), validateDeductionRecordUpdateInput, updateDeductionRecord)
    .delete(authorizePermission(...WRITE_ROLES.deductionRecords), deleteDeductionRecord);

export default router;
