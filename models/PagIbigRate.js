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
        // The HDMF schedule caps the contribution, not the salary. The salary
        // threshold is the same rule expressed the other way round -- at 2%, a
        // ₱200 maximum is reached at ₱10,000 -- and is kept because the
        // computation needs a figure to apply the percentage to.
        percentageRateSalaryThreshold: { type: Number }, // ₱10,000 — salary cap for % computation
        // The table gives the employee and employer their own Max column. They
        // hold the same ₱200 today, but they are separate columns and a single
        // shared cap could not express it if they ever diverge.
        flatRateMaxDeduction: { type: Number },   // ₱200 — employee maximum
        employerMaxContribution: { type: Number }, // ₱200 — employer maximum
        isBaseline: { type: Boolean, default: false },
    },
    { timestamps: true },
);

export default mongoose.model("PagIbigRate", pagIbigRateSchema);
