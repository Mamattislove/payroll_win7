import { Router } from "express";
import {
    getAllAllowanceTypes,
    getAllowanceType,
    createAllowanceType,
    updateAllowanceType,
    deleteAllowanceType,
} from "../controllers/allowanceTypeController.js";
import {
    validateAllowanceTypeInput,
    validateAllowanceTypeUpdateInput,
    validateAllowanceTypeParamId,
} from "../middlewares/modelMiddlewares/allowanceTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();
router
    .route("/")
    .get(getAllAllowanceTypes)
    .post(
        authorizePermission(...WRITE_ROLES.allowanceTypes),
        validateAllowanceTypeInput,
        createAllowanceType,
    );
router
    .route("/:allowanceTypeId")
    .all(validateAllowanceTypeParamId)
    .get(getAllowanceType)
    .patch(
        authorizePermission(...WRITE_ROLES.allowanceTypes),
        validateAllowanceTypeUpdateInput,
        updateAllowanceType,
    )
    .delete(
        authorizePermission(...WRITE_ROLES.allowanceTypes),
        deleteAllowanceType,
    );
export default router;
