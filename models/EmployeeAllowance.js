import mongoose from "mongoose";
import { PAYROLL_PERIODS, COMPENSATION_STATUS } from "../utils/constants.js";

const employeeAllowanceSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        allowanceType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AllowanceType",
            required: true,
        },
        amount:        { type: Number, required: true, default: 0 },
        payrollPeriod: { type: String, enum: Object.values(PAYROLL_PERIODS) },
        activeStatus: {
            type: String,
            enum: Object.values(COMPENSATION_STATUS),
            default: COMPENSATION_STATUS.ACTIVE,
        },
    },
    { timestamps: true },
);

employeeAllowanceSchema.index({ employee: 1, allowanceType: 1 }, { unique: true });
employeeAllowanceSchema.index({ employee: 1, activeStatus: 1 });

export default mongoose.model("EmployeeAllowance", employeeAllowanceSchema);
