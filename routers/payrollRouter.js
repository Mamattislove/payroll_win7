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
import { WRITE_ROLES } from "../utils/permissions.js";

const router = Router();

// Static paths must precede /:payrollId or they are read as an id.
router.get("/periods", getPayrollPeriods);
router.get("/dashboard-summary", getDashboardSummary);

router
    .route("/")
    .get(getAllPayrolls)
    .post(
        authorizePermission(...WRITE_ROLES.payrolls),
        validatePayrollInput,
        createPayroll,
    );

router
    .route("/:payrollId")
    .all(validatePayrollParamId)
    .get(getPayroll)
    .patch(
        authorizePermission(...WRITE_ROLES.payrolls),
        validatePayrollUpdateInput,
        updatePayroll,
    )
    .delete(
        authorizePermission(...WRITE_ROLES.payrolls),
        deletePayroll,
    );

export default router;
