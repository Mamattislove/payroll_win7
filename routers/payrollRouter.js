import { Router } from "express";
import {
    getAllPayrolls,
    getPayroll,
    getPayrollPeriods,
    getDashboardSummary,
    createPayroll,
    updatePayroll,
    deletePayroll,
} from "../controllers/payrollController.js";
import {
    validatePayrollInput,
    validatePayrollUpdateInput,
    validatePayrollParamId,
} from "../middlewares/modelMiddlewares/payrollValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

// Static paths must precede /:payrollId or they are read as an id.
router.get("/periods", getPayrollPeriods);
router.get("/dashboard-summary", getDashboardSummary);

router
    .route("/")
    .get(getAllPayrolls)
    .post(authorizePermission(USER_ROLES.HR), validatePayrollInput, createPayroll);

router
    .route("/:payrollId")
    .all(validatePayrollParamId)
    .get(getPayroll)
    .patch(authorizePermission(USER_ROLES.HR), validatePayrollUpdateInput, updatePayroll)
    .delete(authorizePermission(USER_ROLES.HR), deletePayroll);

export default router;
