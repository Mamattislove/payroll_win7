import { Router } from "express";
import {
    getAllDeductionTypes,
    getDeductionType,
    createDeductionType,
    updateDeductionType,
    deleteDeductionType,
} from "../controllers/deductionTypeController.js";
import {
    validateDeductionTypeInput,
    validateDeductionTypeUpdateInput,
    validateDeductionTypeParamId,
} from "../middlewares/modelMiddlewares/deductionTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();
router
    .route("/")
    .get(getAllDeductionTypes)
    .post(
        authorizePermission(...WRITE_ROLES.deductionTypes),
        validateDeductionTypeInput,
        createDeductionType,
    );
router
    .route("/:deductionTypeId")
    .all(validateDeductionTypeParamId)
    .get(getDeductionType)
    .patch(
        authorizePermission(...WRITE_ROLES.deductionTypes),
        validateDeductionTypeUpdateInput,
        updateDeductionType,
    )
    .delete(
        authorizePermission(...WRITE_ROLES.deductionTypes),
        deleteDeductionType,
    );
export default router;
