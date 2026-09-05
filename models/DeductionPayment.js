import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const deductionPaymentSchema = new mongoose.Schema(
    {
        deductionRecord: {
            type: ObjectId,
            ref: "DeductionRecord",
            required: true,
        },
        payroll: { type: ObjectId, ref: "Payroll", default: null },
        amount: { type: Number, required: true },
    },
    { timestamps: true },
);

deductionPaymentSchema.index({ payroll: 1 });
deductionPaymentSchema.index({ deductionRecord: 1 });

export default mongoose.model("DeductionPayment", deductionPaymentSchema);
