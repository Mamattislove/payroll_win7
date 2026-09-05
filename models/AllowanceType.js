import mongoose from "mongoose";

const allowanceTypeSchema = new mongoose.Schema(
    {
        allowanceName: { type: String, required: true, unique: true },
        allowanceDesc: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model("AllowanceType", allowanceTypeSchema);
