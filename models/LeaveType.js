import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
    {
        leaveTypeName: { type: String, required: true, unique: true },
        leaveTypeDesc: String,
    },
    { timestamps: true },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
