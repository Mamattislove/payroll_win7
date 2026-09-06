import { Router } from "express";
import {
    getAllEarningTypes,
    getEarningType,
    createEarningType,
    updateEarningType,
    deleteEarningType,
} from "../controllers/earningTypeController.js";
import {
    validateEarningTypeInput,
    validateEarningTypeUpdateInput,
    validateEarningTypeParamId,
} from "../middlewares/modelMiddlewares/earningTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();
router
    .route("/")
    .get(getAllEarningTypes)
    .post(
        authorizePermission(...WRITE_ROLES.earningTypes),
        validateEarningTypeInput,
        createEarningType,
    );
router
    .route("/:earningTypeId")
    .all(validateEarningTypeParamId)
    .get(getEarningType)
    .patch(
        authorizePermission(...WRITE_ROLES.earningTypes),
        validateEarningTypeUpdateInput,
        updateEarningType,
    )
    .delete(
        authorizePermission(...WRITE_ROLES.earningTypes),
        deleteEarningType,
    );
export default router;
