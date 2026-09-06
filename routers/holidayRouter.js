import { Router } from "express";
import {
    getAllHolidays,
    getHoliday,
    createHoliday,
    updateHoliday,
    deleteHoliday,
} from "../controllers/holidayController.js";
import {
    validateHolidayInput,
    validateHolidayUpdateInput,
    validateHolidayParamId,
} from "../middlewares/modelMiddlewares/holidayValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();
router
    .route("/")
    .get(getAllHolidays)
    .post(
        authorizePermission(...WRITE_ROLES.holidays),
        validateHolidayInput,
        createHoliday,
    );
router
    .route("/:holidayId")
    .all(validateHolidayParamId)
    .get(getHoliday)
    .patch(
        authorizePermission(...WRITE_ROLES.holidays),
        validateHolidayUpdateInput,
        updateHoliday,
    )
    .delete(
        authorizePermission(...WRITE_ROLES.holidays),
        deleteHoliday,
    );
export default router;
