import mongoose from "mongoose";
import { DAY_TYPES } from "../utils/constants.js";

const attendanceSchema = new mongoose.Schema(
    {
        compensation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Compensation",
            required: true,
        },
        attendanceDate: { type: Date, required: true },
        dayType: {
            type: String,
            enum: Object.values(DAY_TYPES),
        },
        timeIn: { type: String },
        timeOut: { type: String },
        lateHr: Number,
        lateDeduction: Number,
        undertimeHr: Number,
        undertimeDeduction: Number,
        // breakTime: { type: Number, default: 1 },
        regularHours: { type: Number, default: 0 },
        regularHoursPay: { type: Number, default: 0 },
        overtimeHours: { type: Number, default: 0 },
        overtimeHoursPay: { type: Number, default: 0 },
        nightPremiumHours: { type: Number, default: 0 },
        nightPremiumPay: { type: Number, default: 0 },
        overtimeNightPremiumHours: { type: Number, default: 0 },
        overtimeNightPremiumPay: { type: Number, default: 0 },
        remarks: { type: String }, // leave type name when dayType is Leave With Pay
    },
    { timestamps: true },
);

attendanceSchema.index({ compensation: 1, attendanceDate: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
