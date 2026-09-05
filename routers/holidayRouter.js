import { Router } from "express";
import { getAllHolidays, getHoliday, createHoliday, updateHoliday, deleteHoliday } from "../controllers/holidayController.js";
import { validateHolidayInput, validateHolidayUpdateInput, validateHolidayParamId } from "../middlewares/modelMiddlewares/holidayValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllHolidays).post(authorizePermission(USER_ROLES.HR), validateHolidayInput, createHoliday);
router.route("/:holidayId").all(validateHolidayParamId).get(getHoliday).patch(authorizePermission(USER_ROLES.HR), validateHolidayUpdateInput, updateHoliday).delete(authorizePermission(USER_ROLES.HR), deleteHoliday);
export default router;
