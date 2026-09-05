import { Router } from "express";
import { getAllLoanTypes, getLoanType, createLoanType, updateLoanType, deleteLoanType } from "../controllers/loanTypeController.js";
import { validateLoanTypeInput, validateLoanTypeUpdateInput, validateLoanTypeParamId } from "../middlewares/modelMiddlewares/loanTypeValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllLoanTypes).post(authorizePermission(USER_ROLES.HR), validateLoanTypeInput, createLoanType);
router.route("/:loanTypeId").all(validateLoanTypeParamId).get(getLoanType).patch(authorizePermission(USER_ROLES.HR), validateLoanTypeUpdateInput, updateLoanType).delete(authorizePermission(USER_ROLES.HR), deleteLoanType);
export default router;
