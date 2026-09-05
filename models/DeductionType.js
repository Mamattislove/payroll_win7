import mongoose from "mongoose";

const deductionTypeSchema = new mongoose.Schema(
    {
        deductionName: { type: String, required: true, unique: true },
        deductionDesc: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model("DeductionType", deductionTypeSchema);
