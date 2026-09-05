import { Router } from "express";
import { getAllPayslips, getPayslip, createPayslip, updatePayslip, deletePayslip } from "../controllers/payslipController.js";
import { validatePayslipInput, validatePayslipUpdateInput, validatePayslipParamId } from "../middlewares/modelMiddlewares/payslipValidations.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();
router.route("/").get(getAllPayslips).post(authorizePermission(USER_ROLES.HR), validatePayslipInput, createPayslip);
router.route("/:payslipId").all(validatePayslipParamId).get(getPayslip).patch(authorizePermission(USER_ROLES.HR), validatePayslipUpdateInput, updatePayslip).delete(authorizePermission(USER_ROLES.HR), deletePayslip);
export default router;
