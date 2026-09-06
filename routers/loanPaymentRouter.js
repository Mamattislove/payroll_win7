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
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();
router
    .route("/")
    .get(getAllLoanPayments)
    .post(
        authorizePermission(...WRITE_ROLES.loanPayments),
        validateLoanPaymentInput,
        createLoanPayment,
    );
router
    .route("/:loanPaymentId")
    .all(validateLoanPaymentParamId)
    .get(getLoanPayment)
    .delete(authorizePermission(...WRITE_ROLES.loanPayments), deleteLoanPayment);
export default router;
