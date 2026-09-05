import { Router } from "express";
import { getSettings, upsertSettings } from "../controllers/settingsController.js";
import { validateSettingsInput } from "../middlewares/modelMiddlewares/settingsValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getSettings).patch(authorizePermission(USER_ROLES.HR), validateSettingsInput, upsertSettings);
export default router;
