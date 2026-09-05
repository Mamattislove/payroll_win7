import mongoose from "mongoose";
import { PAYSLIP_STATUS } from "../utils/constants.js";

const { ObjectId } = mongoose.Schema.Types;

const payslipSchema = new mongoose.Schema(
    {
        compensation: { type: ObjectId, ref: "Compensation", required: true },
        status: {
            type: String,
            enum: Object.values(PAYSLIP_STATUS),
            default: PAYSLIP_STATUS.DRAFT,
        },
        createdBy: { type: ObjectId, ref: "User" },

        payPeriodFrom: { type: Date },
        payPeriodTo: { type: Date },
        payrollPeriod: { type: String },
        contractType: { type: String },

        regularPay: { type: Number, default: 0 },
        regularOvertimePay: { type: Number, default: 0 },
        holidayRestdayPay: { type: Number, default: 0 },
        holidayRestdayOvertimePay: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        grossPay: { type: Number, default: 0 },
        netSalary: { type: Number, default: 0 },
        finalPay: { type: Number, default: 0 },
        totalPayrollPeriodPay: { type: Number, default: 0 },

        overtimeHours: { type: Number, default: 0 },
        nightDifferentialHours: { type: Number, default: 0 },
        absences: { type: Number, default: 0 },
        lateHours: { type: Number, default: 0 },
        undertimeHours: { type: Number, default: 0 },

        // Serialized "Name:amount,Name:amount" strings, same shape as the
        // legacy system used — kept as-is rather than normalized into
        // sub-documents since nothing currently parses them structurally.
        earnings: { type: String },
        allowances: { type: String },
        deductions: { type: String },
        otherCharges: { type: String },
        leaveWithPayDetail: { type: String },
        billingReport: { type: String },
    },
    { timestamps: true },
);

payslipSchema.index({ compensation: 1 });

export default mongoose.model("Payslip", payslipSchema);
