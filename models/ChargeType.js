import mongoose from "mongoose";

const chargeTypeSchema = new mongoose.Schema(
    {
        chargeName: { type: String, required: true, unique: true },
        chargeDesc: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model("ChargeType", chargeTypeSchema);
