import { Router } from "express";
import { getAllEarningTypes, getEarningType, createEarningType, updateEarningType, deleteEarningType } from "../controllers/earningTypeController.js";
import { validateEarningTypeInput, validateEarningTypeUpdateInput, validateEarningTypeParamId } from "../middlewares/modelMiddlewares/earningTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllEarningTypes).post(authorizePermission(USER_ROLES.HR), validateEarningTypeInput, createEarningType);
router.route("/:earningTypeId").all(validateEarningTypeParamId).get(getEarningType).patch(authorizePermission(USER_ROLES.HR), validateEarningTypeUpdateInput, updateEarningType).delete(authorizePermission(USER_ROLES.HR), deleteEarningType);
export default router;
