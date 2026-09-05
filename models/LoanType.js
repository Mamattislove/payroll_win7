import mongoose from "mongoose";

const loanTypeSchema = new mongoose.Schema(
    {
        loanTypeName: { type: String, required: true, unique: true },
        loanTypeDesc: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model("LoanType", loanTypeSchema);
