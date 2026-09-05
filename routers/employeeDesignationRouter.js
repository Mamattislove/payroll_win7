import { Router } from "express";
import {
    getAllEmployeeDesignations,
    getEmployeeDesignation,
    createEmployeeDesignation,
    updateEmployeeDesignation,
    deleteEmployeeDesignation,
} from "../controllers/employeeDesignationController.js";
import {
    validateEmployeeDesignationInput,
    validateEmployeeDesignationUpdateInput,
    validateEmployeeDesignationParamId,
} from "../middlewares/modelMiddlewares/employeeDesignationValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllEmployeeDesignations)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateEmployeeDesignationInput,
        createEmployeeDesignation,
    );

router
    .route("/:employeeDesignationId")
    .all(validateEmployeeDesignationParamId)
    .get(getEmployeeDesignation)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateEmployeeDesignationUpdateInput,
        updateEmployeeDesignation,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteEmployeeDesignation);

export default router;
