import mongoose from "mongoose";

const pagIbigRateSchema = new mongoose.Schema(
    {
        year: { type: Number },
        effectiveDate: { type: Date },
        incomeCeiling: { type: Number },          // ₱1,500 threshold
        basicEmployeeShare: { type: Number },     // 1% (for salary ≤ incomeCeiling)
        basicEmployerShare: { type: Number },     // 2%
        overThresholdEmployeeShare: { type: Number }, // 2% (for salary > incomeCeiling)
        overThresholdEmployerShare: { type: Number }, // 2%
        percentageRateSalaryThreshold: { type: Number }, // ₱10,000 — salary cap for % computation
        flatRateMaxDeduction: { type: Number },   // ₱200 — fixed deduction when salary > threshold
        notUsePercentLF: { type: Number },        // flat amount used when NOT computing by %
        usePercentLF: { type: Number },           // flag/rate when computing by %
        isBaseline: { type: Boolean, default: false },
    },
    { timestamps: true },
);

export default mongoose.model("PagIbigRate", pagIbigRateSchema);
