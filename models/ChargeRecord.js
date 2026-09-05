import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const chargeRecordSchema = new mongoose.Schema(
    {
        payroll: { type: ObjectId, ref: "Payroll", default: null },
        employee: { type: ObjectId, ref: "Employee", required: true },
        chargeType: { type: ObjectId, ref: "ChargeType", required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true },
    },
    { timestamps: true },
);

chargeRecordSchema.index({ payroll: 1, chargeType: 1 });
chargeRecordSchema.index({ employee: 1 });

export default mongoose.model("ChargeRecord", chargeRecordSchema);
