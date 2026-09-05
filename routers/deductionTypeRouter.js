import { Router } from "express";
import { getAllDeductionTypes, getDeductionType, createDeductionType, updateDeductionType, deleteDeductionType } from "../controllers/deductionTypeController.js";
import { validateDeductionTypeInput, validateDeductionTypeUpdateInput, validateDeductionTypeParamId } from "../middlewares/modelMiddlewares/deductionTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllDeductionTypes).post(authorizePermission(USER_ROLES.HR), validateDeductionTypeInput, createDeductionType);
router.route("/:deductionTypeId").all(validateDeductionTypeParamId).get(getDeductionType).patch(authorizePermission(USER_ROLES.HR), validateDeductionTypeUpdateInput, updateDeductionType).delete(authorizePermission(USER_ROLES.HR), deleteDeductionType);
export default router;
