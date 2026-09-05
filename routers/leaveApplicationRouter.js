import { Router } from "express";
import {
    getAllLeaveApplications,
    getLeaveApplication,
    createLeaveApplication,
    updateLeaveApplication,
    deleteLeaveApplication,
} from "../controllers/leaveApplicationController.js";
import {
    validateLeaveApplicationInput,
    validateLeaveApplicationUpdateInput,
    validateLeaveApplicationParamId,
} from "../middlewares/modelMiddlewares/leaveApplicationValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router
    .route("/")
    .get(getAllLeaveApplications)
    .post(validateLeaveApplicationInput, createLeaveApplication);
router
    .route("/:leaveApplicationId")
    .all(validateLeaveApplicationParamId)
    .get(getLeaveApplication)
    .patch(validateLeaveApplicationUpdateInput, updateLeaveApplication)
    .delete(authorizePermission(USER_ROLES.HR), deleteLeaveApplication);
export default router;
