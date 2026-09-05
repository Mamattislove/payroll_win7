import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const earningRecordSchema = new mongoose.Schema(
    {
        payroll: { type: ObjectId, ref: "Payroll", default: null },
        employee: { type: ObjectId, ref: "Employee", required: true },
        earningType: { type: ObjectId, ref: "EarningType", required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true },
    },
    { timestamps: true },
);

earningRecordSchema.index({ payroll: 1, earningType: 1 });
earningRecordSchema.index({ employee: 1 });

export default mongoose.model("EarningRecord", earningRecordSchema);
