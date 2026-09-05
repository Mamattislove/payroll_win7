import { Router } from "express";
import {
    getAllCompensations,
    getCompensation,
    createCompensation,
    updateCompensation,
    deleteCompensation,
} from "../controllers/compensationController.js";
import {
    validateCompensationInput,
    validateCompensationUpdateInput,
    validateCompensationParamId,
} from "../middlewares/modelMiddlewares/compensationValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllCompensations)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateCompensationInput,
        createCompensation,
    );

router
    .route("/:compensationId")
    .all(validateCompensationParamId)
    .get(getCompensation)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateCompensationUpdateInput,
        updateCompensation,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteCompensation);

export default router;
