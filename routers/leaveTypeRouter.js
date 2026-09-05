import { Router } from "express";
import { getAllLeaveTypes, getLeaveType, createLeaveType, updateLeaveType, deleteLeaveType } from "../controllers/leaveTypeController.js";
import { validateLeaveTypeInput, validateLeaveTypeUpdateInput, validateLeaveTypeParamId } from "../middlewares/modelMiddlewares/leaveTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllLeaveTypes).post(authorizePermission(USER_ROLES.HR), validateLeaveTypeInput, createLeaveType);
router.route("/:leaveTypeId").all(validateLeaveTypeParamId).get(getLeaveType).patch(authorizePermission(USER_ROLES.HR), validateLeaveTypeUpdateInput, updateLeaveType).delete(authorizePermission(USER_ROLES.HR), deleteLeaveType);
export default router;
