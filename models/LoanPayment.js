import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const loanPaymentSchema = new mongoose.Schema(
    {
        loan: { type: ObjectId, ref: "LoanApplication", required: true },
        payroll: { type: ObjectId, ref: "Payroll" },
        payslip: { type: ObjectId, ref: "Payslip" },
        dateOfPayment: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
    },
    { timestamps: true },
);

loanPaymentSchema.index({ loan: 1 });
loanPaymentSchema.index({ payroll: 1 });

export default mongoose.model("LoanPayment", loanPaymentSchema);
