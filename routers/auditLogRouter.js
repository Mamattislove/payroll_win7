import { Router } from "express";
import {
    getAllAuditLogs,
    getAuditLogFilters,
} from "../controllers/auditLogController.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

// Read-only and admin-only throughout. There is deliberately no create, update
// or delete route: entries are written by the audit middleware, and a trail
// anyone can edit is worth nothing.
router.use(authorizePermission(USER_ROLES.ADMIN));

router.route("/filters").get(getAuditLogFilters);
router.route("/").get(getAllAuditLogs);

export default router;
