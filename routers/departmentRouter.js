import { Router } from "express";
import {
    getAllDepartments,
    getDepartment,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} from "../controllers/departmentController.js";
import {
    validateDepartmentInput,
    validateDepartmentUpdateInput,
    validateDepartmentParamId,
} from "../middlewares/modelMiddlewares/departmentValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllDepartments)
    .post(
        authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR),
        validateDepartmentInput,
        createDepartment,
    );

router
    .route("/:departmentId")
    .all(validateDepartmentParamId)
    .get(getDepartment)
    .patch(
        authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR),
        validateDepartmentUpdateInput,
        updateDepartment,
    )
    .delete(authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR), deleteDepartment);

export default router;
