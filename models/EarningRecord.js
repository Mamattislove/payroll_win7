import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const earningRecordSchema = new mongoose.Schema(
    {
        payroll: { type: ObjectId, ref: "Payroll", default: null },
        employee: { type: ObjectId, ref: "Employee", required: true },
        // Set when the record is taken off a payroll by hand. Without it the
        // record simply goes back to payroll: null, which is indistinguishable
        // from one that was never attached -- and the next payroll generated
        // for this employee sweeps up everything unattached, putting the
        // removed record straight back.
        excludedFromPayroll: { type: Boolean, default: false },
        earningType: { type: ObjectId, ref: "EarningType", required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true },
    },
    { timestamps: true },
);

earningRecordSchema.index({ payroll: 1, earningType: 1 });
earningRecordSchema.index({ employee: 1 });

export default mongoose.model("EarningRecord", earningRecordSchema);
