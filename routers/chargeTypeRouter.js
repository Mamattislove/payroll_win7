import { Router } from "express";
import {
    getAllChargeTypes,
    getChargeType,
    createChargeType,
    updateChargeType,
    deleteChargeType,
} from "../controllers/chargeTypeController.js";
import {
    validateChargeTypeInput,
    validateChargeTypeUpdateInput,
    validateChargeTypeParamId,
} from "../middlewares/modelMiddlewares/chargeTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();
router
    .route("/")
    .get(getAllChargeTypes)
    .post(
        authorizePermission(...WRITE_ROLES.chargeTypes),
        validateChargeTypeInput,
        createChargeType,
    );
router
    .route("/:chargeTypeId")
    .all(validateChargeTypeParamId)
    .get(getChargeType)
    .patch(
        authorizePermission(...WRITE_ROLES.chargeTypes),
        validateChargeTypeUpdateInput,
        updateChargeType,
    )
    .delete(
        authorizePermission(...WRITE_ROLES.chargeTypes),
        deleteChargeType,
    );
export default router;
