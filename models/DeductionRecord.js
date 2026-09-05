import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const deductionRecordSchema = new mongoose.Schema(
    {
        employee: { type: ObjectId, ref: "Employee", required: true },
        deductionType: { type: ObjectId, ref: "DeductionType", required: true },
        name: { type: String, required: true },
        initialAmount: { type: Number, required: true },
        currentAmount: { type: Number },
        monthlyDeduction: { type: Number },
        applicationDate: { type: Date },
        firstDeductionDate: {
            type: Date,
        },
    },
    { timestamps: true },
);

deductionRecordSchema.pre("save", async function () {
    if (this.isNew && this.currentAmount == null) {
        this.currentAmount = this.initialAmount;
    }
});

deductionRecordSchema.index({ employee: 1 });

export default mongoose.model("DeductionRecord", deductionRecordSchema);
