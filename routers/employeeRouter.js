import { Router } from "express";
import {
    createEmployee,
    deleteEmployee,
    getAllEmployees,
    getEmployee,
    getEmployeesWithCompensation,
    getNextEmployeeCode,
    updateEmployee,
} from "../controllers/employeeController.js";
import {
    validateEmployeeInput,
    validateEmployeeParamid,
    validateEmployeeUpdateInput,
} from "../middlewares/modelMiddlewares/employeeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router.get("/next-code", getNextEmployeeCode);
router.get("/with-compensation", getEmployeesWithCompensation);

router
    .route("/")
    .get(getAllEmployees)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateEmployeeInput,
        createEmployee,
    );
router
    .route("/:employeeId")
    .all(validateEmployeeParamid)
    .get(getEmployee)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateEmployeeUpdateInput,
        updateEmployee,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteEmployee);

export default router;
