import { Router } from "express";
import {
    getAllLoanApplications,
    getLoanApplication,
    createLoanApplication,
    updateLoanApplication,
    deleteLoanApplication,
} from "../controllers/loanApplicationController.js";
import {
    validateLoanApplicationInput,
    validateLoanApplicationUpdateInput,
    validateLoanApplicationParamId,
} from "../middlewares/modelMiddlewares/loanApplicationValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router
    .route("/")
    .get(getAllLoanApplications)
    .post(
        authorizePermission(USER_ROLES.HR),
        validateLoanApplicationInput,
        createLoanApplication,
    );
router
    .route("/:loanApplicationId")
    .all(validateLoanApplicationParamId)
    .get(getLoanApplication)
    .patch(
        authorizePermission(USER_ROLES.HR),
        validateLoanApplicationUpdateInput,
        updateLoanApplication,
    )
    .delete(authorizePermission(USER_ROLES.HR), deleteLoanApplication);
export default router;
