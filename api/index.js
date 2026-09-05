import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import "express-async-errors";
import cookieParser from "cookie-parser";

import errorHandlerMiddleware from "../middlewares/errorHandlerMiddlewares.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

import authRouter from "../routers/authRouter.js";
import userRouter from "../routers/userRouter.js";
import employeeRouter from "../routers/employeeRouter.js";
import attendanceRouter from "../routers/attendanceRouter.js";
import compensationRouter from "../routers/compensationRouter.js";
import departmentRouter from "../routers/departmentRouter.js";
import positionRouter from "../routers/positionRouter.js";
import bankRouter from "../routers/bankRouter.js";
import bankHolderRouter from "../routers/bankHolderRouter.js";
import clientRouter from "../routers/clientRouter.js";
import holidayRouter from "../routers/holidayRouter.js";
import leaveTypeRouter from "../routers/leaveTypeRouter.js";
import leaveApplicationRouter from "../routers/leaveApplicationRouter.js";
import loanApplicationRouter from "../routers/loanApplicationRouter.js";
import loanPaymentRouter from "../routers/loanPaymentRouter.js";
import loanTypeRouter from "../routers/loanTypeRouter.js";
import earningTypeRouter from "../routers/earningTypeRouter.js";
import allowanceTypeRouter from "../routers/allowanceTypeRouter.js";
import deductionTypeRouter from "../routers/deductionTypeRouter.js";
import chargeTypeRouter from "../routers/chargeTypeRouter.js";
import savingsRouter from "../routers/savingsRouter.js";
import savingsRecordRouter from "../routers/savingsRecordRouter.js";
import sssRateRouter from "../routers/sssRateRouter.js";
import philHealthRateRouter from "../routers/philHealthRateRouter.js";
import pagIbigRateRouter from "../routers/pagIbigRateRouter.js";
import settingsRouter from "../routers/settingsRouter.js";
import employeeAllowanceRouter from "../routers/employeeAllowanceRouter.js";
import payslipRouter from "../routers/payslipRouter.js";
import earningRecordRouter from "../routers/earningRecordRouter.js";
import allowanceRecordRouter from "../routers/allowanceRecordRouter.js";
import deductionRecordRouter from "../routers/deductionRecordRouter.js";
import deductionPaymentRouter from "../routers/deductionPaymentRouter.js";
import chargeRecordRouter from "../routers/chargeRecordRouter.js";
import employeeDesignationRouter from "../routers/employeeDesignationRouter.js";
import payrollRouter from "../routers/payrollRouter.js";
import Compensation from "../models/Compensation.js";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/api/v1/test", (req, res) => {
    res.json({ msg: "test routes" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", authenticateUser, userRouter);
app.use("/api/v1/employees", authenticateUser, employeeRouter);
app.use("/api/v1/attendances", authenticateUser, attendanceRouter);
app.use("/api/v1/compensations", authenticateUser, compensationRouter);
app.use("/api/v1/departments", authenticateUser, departmentRouter);
app.use("/api/v1/positions", authenticateUser, positionRouter);
app.use("/api/v1/banks", authenticateUser, bankRouter);
app.use("/api/v1/bank-holders", authenticateUser, bankHolderRouter);
app.use("/api/v1/clients", authenticateUser, clientRouter);
app.use("/api/v1/holidays", authenticateUser, holidayRouter);
app.use("/api/v1/leave-types", authenticateUser, leaveTypeRouter);
app.use("/api/v1/leave-applications", authenticateUser, leaveApplicationRouter);
app.use("/api/v1/loan-applications", authenticateUser, loanApplicationRouter);
app.use("/api/v1/loan-payments", authenticateUser, loanPaymentRouter);
app.use("/api/v1/loan-types", authenticateUser, loanTypeRouter);
app.use("/api/v1/earning-types", authenticateUser, earningTypeRouter);
app.use("/api/v1/allowance-types", authenticateUser, allowanceTypeRouter);
app.use("/api/v1/deduction-types", authenticateUser, deductionTypeRouter);
app.use("/api/v1/charge-types", authenticateUser, chargeTypeRouter);
app.use("/api/v1/savings", authenticateUser, savingsRouter);
app.use("/api/v1/savings-records", authenticateUser, savingsRecordRouter);
app.use("/api/v1/sss-rates", authenticateUser, sssRateRouter);
app.use("/api/v1/philhealth-rates", authenticateUser, philHealthRateRouter);
app.use("/api/v1/pagibig-rates", authenticateUser, pagIbigRateRouter);
app.use("/api/v1/settings", authenticateUser, settingsRouter);
app.use("/api/v1/employee-allowances", authenticateUser, employeeAllowanceRouter);
app.use("/api/v1/payslips", authenticateUser, payslipRouter);
app.use("/api/v1/earning-records", authenticateUser, earningRecordRouter);
app.use("/api/v1/allowance-records", authenticateUser, allowanceRecordRouter);
app.use("/api/v1/deduction-records", authenticateUser, deductionRecordRouter);
app.use("/api/v1/deduction-payments", authenticateUser, deductionPaymentRouter);
app.use("/api/v1/charge-records", authenticateUser, chargeRecordRouter);
app.use("/api/v1/employee-designations", authenticateUser, employeeDesignationRouter);
app.use("/api/v1/payrolls", authenticateUser, payrollRouter);

app.use(errorHandlerMiddleware);

// Cache the connection across warm serverless invocations
let isConnected = false;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) return;
    await mongoose.connect(process.env.MONGO_URL);
    await Compensation.syncIndexes();
    isConnected = true;
};

export default async (req, res) => {
    try {
        await connectDB();
    } catch (err) {
        return res.status(500).json({ msg: "Database connection failed" });
    }
    return app(req, res);
};
