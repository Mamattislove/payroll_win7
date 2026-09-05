import mongoose from "mongoose";

const philHealthRateSchema = new mongoose.Schema(
    {
        year: { type: Number, required: true, unique: true },
        premiumRate: { type: Number, required: true },
        employeeShare: { type: Number, required: true },
        minimumSalaryThreshold: { type: Number, required: true },
        deductionCeiling: { type: Number },
        
    },
    { timestamps: true },
);

export default mongoose.model("PhilHealthRate", philHealthRateSchema);
