import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
    {
        departmentName: { type: String, required: true, unique: true },
        departmentDesc: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model("Department", departmentSchema);
