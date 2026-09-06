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
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

router
    .route("/")
    .get(getAllAttendances)
    .post(
        authorizePermission(...WRITE_ROLES.attendances),
        validateAttendanceInput,
        createAttendance,
    );

router
    .route("/bulk")
    .post(
        authorizePermission(...WRITE_ROLES.attendances),
        validateBulkAttendanceInput,
        bulkCreateAttendance,
    );

router
    .route("/:attendanceId")
    .all(validateAttendanceParamId)
    .get(getAttendance)
    .patch(
        authorizePermission(...WRITE_ROLES.attendances),
        validateAttendanceUpdateInput,
        updateAttendance,
    )
    .delete(
        authorizePermission(...WRITE_ROLES.attendances),
        deleteAttendance,
    );
// router
//     .route("/:attendanceId/compensations/:compensationId")
//     .all(validateAttendanceParamId);

export default router;
