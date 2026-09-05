import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, logout } from "../controllers/authController.js";
import {
    validateAuthLoginInput,
    valitdateAuthRegisterinput,
} from "../middlewares/validationMiddleware.js";
import {
    authenticateUser,
    authorizePermission,
} from "../middlewares/authMiddleware.js";
import { USER_ROLES } from "../utils/constants.js";

const router = Router();

// Login is the only unauthenticated write endpoint, so it is the brute-force
// surface. Successful logins are not counted, so a legitimate user working
// through a shared IP is never locked out by their own sign-ins.
// NOTE: if this ever runs behind a reverse proxy, set `app.set("trust proxy", n)`
// in server.js or every client will share the proxy's IP and one limit.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { msg: "too many login attempts, try again in 15 minutes" },
});

router
    .route("/register")
    .post(
        authenticateUser,
        authorizePermission(USER_ROLES.ADMIN),
        valitdateAuthRegisterinput,
        register,
    );
router.route("/login").post(loginLimiter, validateAuthLoginInput, login);
router.route("/logout").get(logout);

export default router;
