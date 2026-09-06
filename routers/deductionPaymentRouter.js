import { Router } from "express";
import {
    getAllDeductionPayments,
    getDeductionPayment,
    createDeductionPayment,
    updateDeductionPayment,
    deleteDeductionPayment,
} from "../controllers/deductionPaymentController.js";
import {
    validateDeductionPaymentInput,
    validateDeductionPaymentUpdateInput,
    validateDeductionPaymentParamId,
} from "../middlewares/modelMiddlewares/deductionPaymentValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

router
    .route("/")
    .get(getAllDeductionPayments)
    .post(
        authorizePermission(...WRITE_ROLES.deductionPayments),
        validateDeductionPaymentInput,
        createDeductionPayment,
    );

router
    .route("/:deductionPaymentId")
    .all(validateDeductionPaymentParamId)
    .get(getDeductionPayment)
    .patch(
        authorizePermission(...WRITE_ROLES.deductionPayments),
        validateDeductionPaymentUpdateInput,
        updateDeductionPayment,
    )
    .delete(authorizePermission(...WRITE_ROLES.deductionPayments), deleteDeductionPayment);

export default router;
