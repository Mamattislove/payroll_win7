import mongoose from "mongoose";
import {
    CONTRACT_TYPES,
    DAYS,
    PAYROLL_PERIODS,
    COMPENSATION_STATUS,
    SSS_CONTRIBUTION_BASIS,
    PHILHEALTH_CONTRIBUTION_BASIS,
    PAGIBIG_CONTRIBUTION_BASIS,
    PAYROLL_EMPLOYMENT_TYPE,
} from "../utils/constants.js";

const { ObjectId } = mongoose.Schema.Types;

const compensationSchema = new mongoose.Schema(
    {
        employeeDesignation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EmployeeDesignation",
        },
        employmentType: {
            type: String,
            enum: Object.values(PAYROLL_EMPLOYMENT_TYPE),
        },
        contractType: { type: String, enum: Object.values(CONTRACT_TYPES) },
        startContract: { type: Date },
        endContract: { type: Date },
        payrollPeriod: { type: String, enum: Object.values(PAYROLL_PERIODS) },
        monthlyRate: { type: Number, default: 0 },
        dailyRate: { type: Number, default: 0 },
        weeklySchedule: [{ type: String, enum: Object.values(DAYS) }],
        timeIn: { type: String },
        timeOut: { type: String },
        nightShiftTimeIn: { type: String },
        nightShiftTimeOut: { type: String },
        restDay: { type: String, enum: Object.values(DAYS) },
        activeStatus: {
            type: String,
            enum: Object.values(COMPENSATION_STATUS),
            default: COMPENSATION_STATUS.ACTIVE,
            index: true,
        },
        sssContributionBasis: {
            type: String,
            enum: Object.values(SSS_CONTRIBUTION_BASIS),
            default: SSS_CONTRIBUTION_BASIS.GROSS_PAY,
        },
        philhealthContributionBasis: {
            type: String,
            enum: Object.values(PHILHEALTH_CONTRIBUTION_BASIS),
            default: PHILHEALTH_CONTRIBUTION_BASIS.GROSS_PAY,
        },
        pagibigContributionBasis: {
            type: String,
            enum: Object.values(PAGIBIG_CONTRIBUTION_BASIS),
            default: PAGIBIG_CONTRIBUTION_BASIS.GROSS_PAY,
        },
        sssOverwriteAmount: { type: Number, default: 0 },
        philhealthOverwriteAmount: { type: Number, default: 0 },
        pagibigOverwriteAmount: { type: Number, default: 0 },
        dateOfRegularization: { type: Date },
        insuranceName: { type: String },
        dateInsured: { type: Date },
        insuredUntil: { type: Date },
        terminateReason: String,
        terminateDate: Date,
        terminateNotes: String,
    },
    { timestamps: true },
);

const daiLyRateDivider = 26;

compensationSchema.pre("save", function () {
    if (this.monthlyRate) {
        this.dailyRate =
            Math.round((this.monthlyRate / daiLyRateDivider) * 100) / 100;
    }
});

compensationSchema.pre("findOneAndUpdate", function () {
    const update = this.getUpdate();
    const monthlyRate = update.$set?.monthlyRate ?? update.monthlyRate;
    if (monthlyRate != null) {
        const dailyRate =
            Math.round((monthlyRate / daiLyRateDivider) * 100) / 100;
        if (update.$set) {
            update.$set.dailyRate = dailyRate;
        } else {
            update.dailyRate = dailyRate;
        }
    }
});

compensationSchema.pre("updateOne", function () {
    const update = this.getUpdate();
    const monthlyRate = update.$set?.monthlyRate ?? update.monthlyRate;
    if (monthlyRate != null) {
        const dailyRate =
            Math.round((monthlyRate / daiLyRateDivider) * 100) / 100;
        if (update.$set) {
            update.$set.dailyRate = dailyRate;
        } else {
            update.dailyRate = dailyRate;
        }
    }
});

compensationSchema.index({ employeeDesignation: 1 }, { unique: true });

export default mongoose.model("Compensation", compensationSchema);
