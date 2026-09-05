import mongoose from "mongoose";

const earningTypeSchema = new mongoose.Schema(
    {
        earningName: { type: String, required: true, unique: true },
        earningDesc: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model("EarningType", earningTypeSchema);
