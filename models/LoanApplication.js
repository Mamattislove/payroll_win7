import mongoose from "mongoose";
import {
    LOAN_RECORD_STATUS,
    LOAN_STATUS,
} from "../utils/constants.js";

const loanApplicationSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        loanType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LoanType",
            required: true,
        },
        loanName: { type: String },
        checkNumber: String,
        // Written by seeders/importCuratedYnlOldLoans.js through the raw driver
        // because they were not on the schema. Declared now because strict mode
        // silently drops undeclared paths when a document is hydrated -- the
        // loans report groups by sourceAgency, and would have seen undefined on
        // any read that was not .lean(). Declaring them changes no stored data.
        legacyAppNumber: { type: String },
        sourceSheet: { type: String },
        sourceAgency: { type: String },
        dateGranted: Date,
        loanAmount: Number,
        loanPayable: { type: Number },
        loanTermFrom: Date,
        loanTermTo: Date,
        monthlyAmortization: { type: Number, default: 0 },
        firstMonthAmortization: { type: Date },
        loanStatus: {
            type: String,
            enum: Object.values(LOAN_STATUS),
            default: LOAN_STATUS.ONGOING,
        },
        isDeleted: {
            type: String,
            enum: Object.values(LOAN_RECORD_STATUS),
            default: LOAN_RECORD_STATUS.ACTIVE,
        },
        remarks: { type: String },
    },
    { timestamps: true },
);

loanApplicationSchema.index({
    employee: 1,
    loanType: 1,
    loanStatus: 1,
    isDeleted: 1,
});

loanApplicationSchema.pre("save", function () {
    if (this.isNew && this.loanPayable == null) {
        this.loanPayable = this.loanAmount;
    }
    if (this.loanPayable != null && this.loanPayable <= 0) {
        this.loanPayable = 0;
        this.loanStatus = LOAN_STATUS.FULLY_PAID;
    }
});

loanApplicationSchema.pre("findOneAndUpdate", function () {
    const update = this.getUpdate();
    const loanPayable = update.$set?.loanPayable ?? update.loanPayable;
    if (loanPayable != null && loanPayable <= 0) {
        if (update.$set) {
            update.$set.loanPayable = 0;
            update.$set.loanStatus = LOAN_STATUS.FULLY_PAID;
        } else {
            update.loanPayable = 0;
            update.loanStatus = LOAN_STATUS.FULLY_PAID;
        }
    }
});

loanApplicationSchema.pre("updateOne", function () {
    const update = this.getUpdate();
    const loanPayable = update.$set?.loanPayable ?? update.loanPayable;
    if (loanPayable != null && loanPayable <= 0) {
        if (update.$set) {
            update.$set.loanPayable = 0;
            update.$set.loanStatus = LOAN_STATUS.FULLY_PAID;
        } else {
            update.loanPayable = 0;
            update.loanStatus = LOAN_STATUS.FULLY_PAID;
        }
    }
});

export default mongoose.model("LoanApplication", loanApplicationSchema);
