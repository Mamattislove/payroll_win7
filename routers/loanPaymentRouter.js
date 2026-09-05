import { Router } from "express";
import {
    getAllLoanPayments,
    getLoanPayment,
    createLoanPayment,
    deleteLoanPayment,
} from "../controllers/loanPaymentController.js";
import {
    validateLoanPaymentInput,
    validateLoanPaymentParamId,
} from "../middlewares/modelMiddlewares/loanPaymentValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router
    .route("/")
    .get(getAllLoanPayments)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateLoanPaymentInput,
        createLoanPayment,
    );
router
    .route("/:loanPaymentId")
    .all(validateLoanPaymentParamId)
    .get(getLoanPayment)
    .delete(authorizePermission(USER_ROLES.HR), deleteLoanPayment);
export default router;
