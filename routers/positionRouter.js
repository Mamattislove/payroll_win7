import { Router } from "express";
import {
    getAllPositions,
    getPosition,
    createPosition,
    updatePosition,
    deletePosition,
} from "../controllers/positionController.js";
import {
    validatePositionInput,
    validatePositionUpdateInput,
    validatePositionParamId,
} from "../middlewares/modelMiddlewares/positionValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllPositions)
    .post(
        authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR),
        validatePositionInput,
        createPosition,
    );

router
    .route("/:positionId")
    .all(validatePositionParamId)
    .get(getPosition)
    .patch(
        authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR),
        validatePositionUpdateInput,
        updatePosition,
    )
    .delete(authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR), deletePosition);

export default router;
