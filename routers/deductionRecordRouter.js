import { Router } from "express";
import {
    getAllDeductionRecords, getDeductionRecord,
    createDeductionRecord, updateDeductionRecord, deleteDeductionRecord,
} from "../controllers/deductionRecordController.js";
import {
    validateDeductionRecordInput, validateDeductionRecordUpdateInput, validateDeductionRecordParamId,
} from "../middlewares/modelMiddlewares/deductionRecordValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router.route("/")
    .get(getAllDeductionRecords)
    .post(authorizePermission(USER_ROLES.HR), validateDeductionRecordInput, createDeductionRecord);

router.route("/:deductionRecordId")
    .all(validateDeductionRecordParamId)
    .get(getDeductionRecord)
    .patch(authorizePermission(USER_ROLES.HR), validateDeductionRecordUpdateInput, updateDeductionRecord)
    .delete(authorizePermission(USER_ROLES.HR), deleteDeductionRecord);

export default router;
