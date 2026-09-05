import mongoose from "mongoose";
import { USER_ROLES } from "../utils/constants.js";

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true }, // bcrypt hash — never use MD5
        department: {
            type: String,
        },
        role: {
            type: String,
            enum: Object.values(USER_ROLES),
            default: USER_ROLES.USER,
        },
        addedBy: {
            type: mongoose.Types.ObjectId,
            ref: "User",
        },
        // ui_settings: { type: [Number], default: [1] }, // UI prefs: 1=sidebar, 2=right menu, 3=footer
    },
    { timestamps: true },
);

userSchema.methods.toJSON = function () {
    let obj = this.toObject();
    delete obj.password;
    return obj;
};

export default mongoose.model("User", userSchema);
