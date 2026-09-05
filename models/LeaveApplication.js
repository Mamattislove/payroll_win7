import mongoose from "mongoose";
import {
    LEAVE_HALFDAY,
    LEAVE_STATUS,
    LEAVE_WITH_PAY,
} from "../utils/constants.js";

const leaveApplicationSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        leaveType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LeaveType",
            required: true,
        },
        dateFrom: { type: Date, required: true },
        dateTo: { type: Date, required: true },
        notes: { type: String },
        withPay: {
            type: String,
            enum: Object.values(LEAVE_WITH_PAY),
            default: LEAVE_WITH_PAY.WITHOUT_PAY,
        },
        halfday: {
            type: String,
            enum: Object.values(LEAVE_HALFDAY),
            default: LEAVE_HALFDAY.FULL_DAY,
        },
        status: {
            type: String,
            enum: Object.values(LEAVE_STATUS),
            default: LEAVE_STATUS.PENDING,
        },
    },
    { timestamps: true },
);

leaveApplicationSchema.index({ employee: 1, status: 1 });

export default mongoose.model("LeaveApplication", leaveApplicationSchema);
