import { StatusCodes } from "http-status-codes";
import User from "../models/User.js";
import { hashedPassword, comparePassword } from "../utils/passwordUtils.js";
import { BadRequestError, NotFoundError } from "../errors/customErrors.js";
import { USER_ROLES } from "../utils/constants.js";

export const getCurrentUser = async (req, res) => {
    const user = await User.findOne({ _id: req.user.userId });
    const userWithoutPassword = user.toJSON();
    res.status(StatusCodes.OK).json({ user: userWithoutPassword });
};

export const getAllUsers = async (req, res) => {
    const { page = 1, limit = 25, search = "", role } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (role) query.role = role;
    if (search) {
        const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = { $regex: escaped, $options: "i" };
        query.$or = [{ username: rx }, { email: rx }, { department: rx }];
    }

    const [totalUsers, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query)
            // -password is belt to the model's toJSON braces: .lean() below
            // bypasses toJSON, so the hash must be excluded here explicitly.
            .select("-password")
            .populate("addedBy", "username")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
    ]);

    res.status(StatusCodes.OK).json({
        totalUsers,
        totalPages: Math.ceil(totalUsers / limitNum),
        currentPage: pageNum,
        users,
    });
};

/** Blocks changes that would leave the system with no admin at all. */
async function assertNotLastAdmin(userId, { becauseOf }) {
    const target = await User.findById(userId).select("role");
    if (!target) throw new NotFoundError(`No user with id ${userId}`);
    if (target.role !== USER_ROLES.ADMIN) return;

    const admins = await User.countDocuments({ role: USER_ROLES.ADMIN });
    if (admins <= 1) {
        throw new BadRequestError(
            `Cannot ${becauseOf} the only remaining admin account.`,
        );
    }
}

export const updateUser = async (req, res) => {
    const { userId } = req.params;
    const { username, email, department, role } = req.body;

    // Demoting the last admin would lock everyone out of user management.
    if (role && role !== USER_ROLES.ADMIN) {
        await assertNotLastAdmin(userId, { becauseOf: "change the role of" });
    }

    const updates = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (department !== undefined) updates.department = department;
    if (role !== undefined) updates.role = role;

    const user = await User.findByIdAndUpdate(userId, updates, {
        new: true,
        runValidators: true,
    }).select("-password");

    if (!user) throw new NotFoundError(`No user with id ${userId}`);
    res.status(StatusCodes.OK).json({ user });
};

/**
 * Lets the signed-in user change their own password.
 *
 * Works on req.user.userId from the token rather than anything in the body, so
 * there is no id to tamper with -- a user can only ever change their own.
 */
export const changeOwnPassword = async (req, res) => {
    const user = await User.findById(req.user.userId);
    if (!user) throw new NotFoundError("user not found");

    const isValid = await comparePassword(
        req.body.currentPassword,
        user.password,
    );
    // Deliberately a 400 and not a 401: the app treats 401 as "your session
    // ended" and bounces to the login page, so mistyping the current password
    // would throw the user out mid-form instead of showing the error.
    if (!isValid) throw new BadRequestError("current password is incorrect");

    user.password = await hashedPassword(req.body.newPassword);
    await user.save();

    res.status(StatusCodes.OK).json({ msg: "password changed" });
};

export const resetUserPassword = async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError(`No user with id ${userId}`);

    user.password = await hashedPassword(req.body.password);
    await user.save();

    res.status(StatusCodes.OK).json({ msg: "password reset" });
};

export const deleteUser = async (req, res) => {
    const { userId } = req.params;

    // An admin deleting their own account mid-session is never intentional.
    if (userId === String(req.user.userId)) {
        throw new BadRequestError("You cannot delete your own account.");
    }
    await assertNotLastAdmin(userId, { becauseOf: "delete" });

    const user = await User.findByIdAndDelete(userId);
    if (!user) throw new NotFoundError(`No user with id ${userId}`);

    res.status(StatusCodes.OK).json({ msg: "user deleted" });
};
