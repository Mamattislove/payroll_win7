import { Router } from "express";
import { getAllPagIbigRates, getPagIbigRate, createPagIbigRate, updatePagIbigRate, deletePagIbigRate } from "../controllers/pagIbigRateController.js";
import { validatePagIbigRateInput, validatePagIbigRateUpdateInput, validatePagIbigRateParamId } from "../middlewares/modelMiddlewares/pagIbigRateValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllPagIbigRates).post(authorizePermission(USER_ROLES.HR), validatePagIbigRateInput, createPagIbigRate);
router.route("/:pagIbigRateId").all(validatePagIbigRateParamId).get(getPagIbigRate).patch(authorizePermission(USER_ROLES.HR), validatePagIbigRateUpdateInput, updatePagIbigRate).delete(authorizePermission(USER_ROLES.HR), deletePagIbigRate);
export default router;
