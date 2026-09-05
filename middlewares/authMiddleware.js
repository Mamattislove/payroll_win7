import {
    UnathenticatedError,
    UnauthorizedError,
} from "../errors/customErrors.js";
import User from "../models/User.js";
import { verifyJWT } from "../utils/tokenUtils.js";

export const authenticateUser = (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
        throw new UnathenticatedError("invalid credentials");
    }

    try {
        const { userId, role } = verifyJWT(token);
        req.user = { userId, role };

        next();
    } catch (error) {
        throw new UnathenticatedError("invalid credentials");
    }
};

export const authorizePermission = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            console.log(req.user);
            throw new UnauthorizedError("unauthorized to access this route");
        }
        next();
    };
};

export const authorizeVerification = (...verificationStatus) => {
    return async (req, res, next) => {
        const user = await User.findOne({ _id: req.user.userId });
        req.user = user;
        if (!verificationStatus.includes(user.status)) {
            throw new UnauthorizedError("unauthorized to access this route");
        }
        next();
    };
};
