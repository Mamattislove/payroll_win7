import { Router } from "express";
import { getAllEmployeeAllowances, getEmployeeAllowance, createEmployeeAllowance, updateEmployeeAllowance, deleteEmployeeAllowance } from "../controllers/employeeAllowanceController.js";
import { validateEmployeeAllowanceInput, validateEmployeeAllowanceUpdateInput, validateEmployeeAllowanceParamId } from "../middlewares/modelMiddlewares/employeeAllowanceValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllEmployeeAllowances).post(authorizePermission(USER_ROLES.HR), validateEmployeeAllowanceInput, createEmployeeAllowance);
router.route("/:employeeAllowanceId").all(validateEmployeeAllowanceParamId).get(getEmployeeAllowance).patch(authorizePermission(USER_ROLES.HR), validateEmployeeAllowanceUpdateInput, updateEmployeeAllowance).delete(authorizePermission(USER_ROLES.HR), deleteEmployeeAllowance);
export default router;
