import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const payrollSchema = new mongoose.Schema(
    {
        compensation: { type: ObjectId, ref: "Compensation", required: true },
        payrollDate: { type: Date },
        attendance: [{ type: ObjectId, ref: "Attendance" }],
        payrollFrom: { type: Date, required: true },
        payrollTo: { type: Date, required: true },

        // Attendance-based pay (computed from attendance records)
        regularPay: { type: Number, default: 0 },
        regularOTPay: { type: Number, default: 0 },
        holidayRestDayPay: { type: Number, default: 0 },
        holidayRestDayOTPay: { type: Number, default: 0 },
        nightDifferentialPay: { type: Number, default: 0 },
        // Paid leave priced at the daily rate. Held apart from regularPay so
        // the journal can show days paid but not worked in its own column.
        leavePay: { type: Number, default: 0 },

        // Day counts, straight from the attendance hours rather than inferred
        // by dividing pay by the daily rate — that inference broke whenever the
        // rate changed mid-period or the shift ran past 10pm.
        daysWorked: { type: Number, default: 0 },
        leaveDays: { type: Number, default: 0 },

        // Attendance adjustments
        absences: { type: Number, default: 0 },
        late: { type: Number, default: 0 },
        undertime: { type: Number, default: 0 },

        // Government contributions — employee side (deducted from paycheck)
        sssContribution: { type: Number, default: 0 },
        philhealthContribution: { type: Number, default: 0 },
        pagibigContribution: { type: Number, default: 0 },
        withholdingTax: { type: Number, default: 0 },

        // Government contributions — employer side (paid by company, not deducted from employee)
        sssEmployerContribution: { type: Number, default: 0 },
        philhealthEmployerContribution: { type: Number, default: 0 },
        pagibigEmployerContribution: { type: Number, default: 0 },

        allowances: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "AllowanceRecord",
            },
        ],
        earning: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "EarningRecord",
            },
        ],
        deductions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "DeductionPayment",
            },
        ],
        savings: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "SavingsRecord",
            },
        ],
        loans: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "LoanPayment",
            },
        ],
        charges: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ChargeRecord",
            },
        ],

        // Totals (computed from record collections)
        grossPay: { type: Number, default: 0 },
        totalDeductions: { type: Number, default: 0 },
        netSalary: { type: Number, default: 0 },
        finalPay: { type: Number, default: 0 },

        // Set once a period has been paid out. A locked payroll is never
        // re-derived from attendance, so an issued payroll journal stays
        // reproducible: correcting timekeeping months later can no longer
        // silently restate money that has already been disbursed.
        locked: { type: Boolean, default: false },

        createdBy: { type: ObjectId, ref: "User" },
    },
    { timestamps: true },
);

export default mongoose.model("Payroll", payrollSchema);
