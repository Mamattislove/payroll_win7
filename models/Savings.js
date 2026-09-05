import mongoose from "mongoose";
import { SAVINS_STATUS } from "../utils/constants.js";

const savingsSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        savingsTarget: { type: Number, required: true },
        cutoffDeductionAmount: { type: Number, required: true },
        effectiveDate: { type: Date },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        status: {
            type: String,
            enum: Object.values(SAVINS_STATUS),
            default: SAVINS_STATUS.ACTIVE,
        },
    },
    { timestamps: true },
);

savingsSchema.index({ employee: 1, status: 1 });

export default mongoose.model("Savings", savingsSchema);
