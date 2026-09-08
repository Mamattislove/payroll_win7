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
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();
router
    .route("/")
    .get(getAllLoanApplications)
    .post(
        authorizePermission(...WRITE_ROLES.loanApplications),
        validateLoanApplicationInput,
        createLoanApplication,
    );
router
    .route("/:loanApplicationId")
    .all(validateLoanApplicationParamId)
    .get(getLoanApplication)
    .patch(
        authorizePermission(...WRITE_ROLES.loanApplications),
        validateLoanApplicationUpdateInput,
        updateLoanApplication,
    )
    .delete(authorizePermission(...WRITE_ROLES.loanApplications), deleteLoanApplication);
export default router;
