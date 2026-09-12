import { Router } from "express";
import {
    getCurrentUser,
    getAllUsers,
    updateUser,
    changeOwnPassword,
    resetUserPassword,
    deleteUser,
} from "../controllers/userController.js";
import { authorizePermission } from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";
import {
    validateUserUpdateInput,
    validatePasswordChangeInput,
    validatePasswordResetInput,
} from "../middlewares/validationMiddleware.js";

const router = Router();

// Any signed-in user needs this to render the dashboard.
router.route("/current-user").get(getCurrentUser);

// Changing your own password needs no role: everyone may do it for themselves.
// This has to be registered before the "/:userId/password" route below, or
// Express matches that one with userId = "current-user" and the admin gate
// turns away the very people this route exists for.
router
    .route("/current-user/password")
    .patch(validatePasswordChangeInput, changeOwnPassword);

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
