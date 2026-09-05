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
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router
    .route("/")
    .get(getAllAllowanceTypes)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateAllowanceTypeInput,
        createAllowanceType,
    );
router
    .route("/:allowanceTypeId")
    .all(validateAllowanceTypeParamId)
    .get(getAllowanceType)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateAllowanceTypeUpdateInput,
        updateAllowanceType,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteAllowanceType);
export default router;
