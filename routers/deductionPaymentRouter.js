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
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

router
    .route("/")
    .get(getAllDeductionPayments)
    .post(
        authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR),
        validateDeductionPaymentInput,
        createDeductionPayment,
    );

router
    .route("/:deductionPaymentId")
    .all(validateDeductionPaymentParamId)
    .get(getDeductionPayment)
    .patch(
        authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR),
        validateDeductionPaymentUpdateInput,
        updateDeductionPayment,
    )
    .delete(authorizePermission(USER_ROLES.ADMIN, USER_ROLES.HR), deleteDeductionPayment);

export default router;
