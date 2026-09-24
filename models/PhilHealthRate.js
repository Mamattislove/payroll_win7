import mongoose from "mongoose";

// One row of PhilHealth's premium schedule (Circular 2019-0009), for direct
// contributors. For 2024-2025 it reads:
//
//   monthly basic salary      premium
//   10,000 and below          10,000 x 5%  =   500  (floor)
//   10,000.01 - 99,999.99     salary x 5%
//   100,000 and above        100,000 x 5%  = 5,000  (ceiling)
//
// The premium is shared by employee and employer, so the employee's deduction
// is half of it: 250 to 2,500 a month. The 500 and 5,000 need no fields of
// their own: they are the floor and ceiling times the rate.
const philHealthRateSchema = new mongoose.Schema(
    {
        year: { type: Number, required: true, unique: true },
        // Total premium as a fraction of the salary, e.g. 0.05 for 5%.
        premiumRate: { type: Number, required: true },
        // The employee's part of the premium; 0.5 is an even split.
        employeeShare: { type: Number, required: true },
        // Salary floor: anything below is charged as if it were this much.
        minimumSalaryThreshold: { type: Number, required: true },
        // Salary ceiling: anything above is charged as if it were this much.
        // Every year of the schedule has one, and without it the premium runs
        // on the whole salary with no cap.
        deductionCeiling: { type: Number, required: true },
    },
    { timestamps: true },
);

export default mongoose.model("PhilHealthRate", philHealthRateSchema);
