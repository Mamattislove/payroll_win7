import mongoose from "mongoose";
import { BANKHOLDER_STATUS } from "../utils/constants.js";

const bankHolderSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        bank: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bank",
            required: true,
        },
        accountNumber: { type: String, required: true },
        charges: { type: Number, default: 0 },
        status: {
            type: String,
            enum: Object.values(BANKHOLDER_STATUS),
            default: BANKHOLDER_STATUS.ACTIVE,
        }, // 1 = active, 0 = replaced/inactive
    },
    { timestamps: true },
);

bankHolderSchema.index({ employee: 1, status: 1 });

export default mongoose.model("BankHolder", bankHolderSchema);
