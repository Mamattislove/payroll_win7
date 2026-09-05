import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const allowanceRecordSchema = new mongoose.Schema(
    {
        payroll: { type: ObjectId, ref: "Payroll", default: null },
        employee: { type: ObjectId, ref: "Employee", required: true },
        allowanceType: { type: ObjectId, ref: "AllowanceType", required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true },
    },
    { timestamps: true },
);

allowanceRecordSchema.index({ payroll: 1, allowanceType: 1 });
allowanceRecordSchema.index({ employee: 1 });

export default mongoose.model("AllowanceRecord", allowanceRecordSchema);
