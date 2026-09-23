import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const allowanceRecordSchema = new mongoose.Schema(
    {
        payroll: { type: ObjectId, ref: "Payroll", default: null },
        employee: { type: ObjectId, ref: "Employee", required: true },
        // Set when the record is taken off a payroll by hand. Without it the
        // record simply goes back to payroll: null, which is indistinguishable
        // from one that was never attached -- and the next payroll generated
        // for this employee sweeps up everything unattached, putting the
        // removed record straight back.
        excludedFromPayroll: { type: Boolean, default: false },
        // The cutoff this record is meant for. Optional: without one it is
        // collected by the next payroll run for the employee, which is how
        // every record created before this field existed behaves. With one
        // set, it waits for a run whose period reaches that date, so it can be
        // keyed in early for a later cutoff without landing on this one.
        allowanceDate: { type: Date },
        allowanceType: { type: ObjectId, ref: "AllowanceType", required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true },
    },
    { timestamps: true },
);

allowanceRecordSchema.index({ payroll: 1, allowanceType: 1 });
allowanceRecordSchema.index({ employee: 1 });

export default mongoose.model("AllowanceRecord", allowanceRecordSchema);
