import { Router } from "express";
import { getAllPhilHealthRates, getPhilHealthRate, createPhilHealthRate, updatePhilHealthRate, deletePhilHealthRate } from "../controllers/philHealthRateController.js";
import { validatePhilHealthRateInput, validatePhilHealthRateUpdateInput, validatePhilHealthRateParamId } from "../middlewares/modelMiddlewares/philHealthRateValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllPhilHealthRates).post(authorizePermission(USER_ROLES.HR), validatePhilHealthRateInput, createPhilHealthRate);
router.route("/:philHealthRateId").all(validatePhilHealthRateParamId).get(getPhilHealthRate).patch(authorizePermission(USER_ROLES.HR), validatePhilHealthRateUpdateInput, updatePhilHealthRate).delete(authorizePermission(USER_ROLES.HR), deletePhilHealthRate);
export default router;
