import { Router } from "express";
import {
    getCurrentUser,
    getAllUsers,
    updateUser,
    resetUserPassword,
    deleteUser,
} from "../controllers/userController.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";
import {
    validateUserUpdateInput,
    validatePasswordResetInput,
} from "../middlewares/validationMiddleware.js";

const router = Router();

// Any signed-in user needs this to render the dashboard.
router.route("/current-user").get(getCurrentUser);

// Everything below manages other people's accounts — admin only.
// Account creation deliberately lives at POST /auth/register, which is already
// admin-gated and validated; there is no public sign-up route anywhere.
router.route("/").get(authorizePermission(USER_ROLES.ADMIN), getAllUsers);

router
    .route("/:userId")
    .patch(
        authorizePermission(USER_ROLES.ADMIN),
        validateUserUpdateInput,
        updateUser,
    )
    .delete(authorizePermission(USER_ROLES.ADMIN), deleteUser);

router
    .route("/:userId/password")
    .patch(
        authorizePermission(USER_ROLES.ADMIN),
        validatePasswordResetInput,
        resetUserPassword,
    );

export default router;
