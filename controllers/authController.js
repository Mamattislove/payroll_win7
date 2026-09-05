import { StatusCodes } from "http-status-codes";
import { hashedPassword, comparePassword } from "../utils/passwordUtils.js";
import { createJWT } from "../utils/tokenUtils.js";
import { UnathenticatedError } from "../errors/customErrors.js";
import User from "../models/User.js";
import { USER_ROLES } from "../utils/constants.js";

export const login = async (req, res) => {
    const user = await User.findOne({ username: req.body.username });
    const isValidUser =
        user && (await comparePassword(req.body.password, user.password));
    if (!isValidUser) throw new UnathenticatedError("invalid credentials");
    const token = createJWT({ userId: user._id, role: user.role });

    const oneDay = 1000 * 60 * 60 * 24;

    const cookieSecure = process.env.COOKIE_SECURE === "true";

    res.cookie("token", token, {
        httpOnly: true,
        expires: new Date(Date.now() + oneDay),
        secure: cookieSecure,
        sameSite: cookieSecure ? "strict" : "lax",
    });

    res.status(StatusCodes.OK).json({
        msg: "user logged in",
        user: user.toJSON(),
    });

    // res.status(StatusCodes.OK).json({ msg: "login routes" });
};

export const register = async (req, res) => {
    const { userId } = req.user;
    const hashedPw = await hashedPassword(req.body.password);
    req.body.password = hashedPw;
    req.body.addedBy = userId;

    const user = await User.create(req.body);
    await user.populate("addedBy", "username email role");
    res.status(StatusCodes.CREATED).json({ user });
    // res.status(StatusCodes.OK).json({ msg: "register routes" });
};

export const logout = (req, res) => {
    const cookieSecure = process.env.COOKIE_SECURE === "true";
    res.cookie("token", "logout", {
        httpOnly: true,
        expires: new Date(Date.now()),
        secure: cookieSecure,
        sameSite: cookieSecure ? "strict" : "lax",
    });
    res.status(StatusCodes.OK).json({ msg: "user logged out!" });
};
