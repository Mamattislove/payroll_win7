import { Router } from "express";
import {
    getAllPayrolls,
    getPayroll,
    getPayrollPeriods,
    getDashboardSummary,
    getBatchPreview,
    batchCreatePayrolls,
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

// Per-client batch generation. The preview only reads, so it is open to any
// signed-in user; actually generating needs the same roles as creating one
// payroll by hand.
router.get("/batch-preview", getBatchPreview);
router.post(
    "/batch",
    authorizePermission(...WRITE_ROLES.payrolls),
    batchCreatePayrolls,
);

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
