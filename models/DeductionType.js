import mongoose from "mongoose";

const deductionTypeSchema = new mongoose.Schema(
    {
        deductionName: { type: String, required: true, unique: true },
        deductionDesc: { type: String },
        // Print this deduction in the acknowledgment receipt's PARTICULARS
        // block instead of the payslip's deduction column. The peso amount is
        // unchanged either way -- only where the employee reads it moves, and
        // the slip adds it back to NET PAY so NET PAY minus PARTICULARS still
        // comes to the same FINAL PAY.
        printOnAcknowledgement: { type: Boolean, default: false },
    },
    { timestamps: true },
);

export default mongoose.model("DeductionType", deductionTypeSchema);
