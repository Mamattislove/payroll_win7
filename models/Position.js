import mongoose from "mongoose";

const positionSchema = new mongoose.Schema(
    {
        positionName: { type: String, required: true, unique: true },
        positionDesc: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model("Position", positionSchema);
