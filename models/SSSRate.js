import mongoose from "mongoose";

const SSSRateSchema = new mongoose.Schema(
    {
        year: { type: Number, required: true },
        effectiveDate: { type: Date },

        // Salary range for this bracket
        compensationFrom: { type: Number }, // null = no lower bound (first row)
        compensationTo: { type: Number }, // null = no upper bound (last row)

        // Monthly Salary Credit
        msc: { type: Number, required: true },

        // Employee contributions
        employeeShare: { type: Number, required: true }, // 5% of MSC (SS only)
        employeeMPF: { type: Number, default: 0 }, // 5% of MSC above ₱20,000

        // Employer contributions
        employerShare: { type: Number, required: true }, // 9.5% of MSC (SS only)
        employerEC: { type: Number, required: true }, // ₱10 (MSC < ₱15,000) or ₱30 (MSC ≥ ₱15,000)
        employerMPF: { type: Number, default: 0 }, // 10% of MSC above ₱20,000

        // Pre-computed totals
        totalEmployeeContribution: { type: Number, required: true }, // employeeShare + employeeMPF
        totalEmployerContribution: { type: Number, required: true }, // employerShare + employerEC + employerMPF
        totalContribution: { type: Number, required: true }, // total of all

        isBaseline: { type: Boolean, default: false },
    },
    { timestamps: true },
);

SSSRateSchema.index({ year: 1, msc: 1 }, { unique: true });

export default mongoose.model("SSSRate", SSSRateSchema);
