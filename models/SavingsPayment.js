import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const savingsPaymentSchema = new mongoose.Schema(
    {
        savings: { type: ObjectId, ref: "Savings", required: true },
        payroll: { type: ObjectId, ref: "Payroll" },
        payslip: { type: ObjectId, ref: "Payslip" },
        amount: { type: Number },
        amountDeducted: { type: Number },
    },
    { timestamps: true },
);

savingsPaymentSchema.index({ savings: 1 });
savingsPaymentSchema.index({ payroll: 1 });

export default mongoose.model("SavingsRecord", savingsPaymentSchema);
