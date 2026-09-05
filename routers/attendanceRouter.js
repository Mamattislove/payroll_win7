import { Router } from "express";
import {
    getAllAttendances,
    getAttendance,
    createAttendance,
    bulkCreateAttendance,
    updateAttendance,
    deleteAttendance,
} from "../controllers/attendanceController.js";
import {
    validateAttendanceInput,
    validateBulkAttendanceInput,
    validateAttendanceUpdateInput,
    validateAttendanceParamId,
} from "../middlewares/modelMiddlewares/attendanceValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllAttendances)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateAttendanceInput,
        createAttendance,
    );

router
    .route("/bulk")
    .post(
        authorizePermission(USER_ROLES.HR),
        validateBulkAttendanceInput,
        bulkCreateAttendance,
    );

router
    .route("/:attendanceId")
    .all(validateAttendanceParamId)
    .get(getAttendance)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateAttendanceUpdateInput,
        updateAttendance,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteAttendance);
// router
//     .route("/:attendanceId/compensations/:compensationId")
//     .all(validateAttendanceParamId);

export default router;
