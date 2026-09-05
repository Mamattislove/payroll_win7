import { Router } from "express";
import { getAllChargeTypes, getChargeType, createChargeType, updateChargeType, deleteChargeType } from "../controllers/chargeTypeController.js";
import { validateChargeTypeInput, validateChargeTypeUpdateInput, validateChargeTypeParamId } from "../middlewares/modelMiddlewares/chargeTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllChargeTypes).post(authorizePermission(USER_ROLES.HR), validateChargeTypeInput, createChargeType);
router.route("/:chargeTypeId").all(validateChargeTypeParamId).get(getChargeType).patch(authorizePermission(USER_ROLES.HR), validateChargeTypeUpdateInput, updateChargeType).delete(authorizePermission(USER_ROLES.HR), deleteChargeType);
export default router;
