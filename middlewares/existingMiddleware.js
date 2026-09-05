import mongoose from "mongoose";
import { BadRequestError } from "../errors/customErrors.js";
import Department from "../models/Department.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Compensation from "../models/Compensation.js";
import Client from "../models/Client.js";
import Position from "../models/Position.js";
import Bank from "../models/Bank.js";
import BankHolder from "../models/BankHolder.js";
import Holiday from "../models/Holiday.js";
import LeaveType from "../models/LeaveType.js";
import LeaveApplication from "../models/LeaveApplication.js";
import LoanApplication from "../models/LoanApplication.js";
import LoanPayment from "../models/LoanPayment.js";
import LoanType from "../models/LoanType.js";
import EarningType from "../models/EarningType.js";
import AllowanceType from "../models/AllowanceType.js";
import DeductionType from "../models/DeductionType.js";
import ChargeType from "../models/ChargeType.js";
import Savings from "../models/Savings.js";
import SavingsRecord from "../models/SavingsPayment.js";
import PhilHealthRate from "../models/PhilHealthRate.js";
import PagIbigRate from "../models/PagIbigRate.js";
import SSSRate from "../models/SSSRate.js";
import EmployeeAllowance from "../models/EmployeeAllowance.js";
import Payslip from "../models/Payslip.js";
import Payroll from "../models/Payroll.js";
import EarningRecord from "../models/EarningRecord.js";
import AllowanceRecord from "../models/AllowanceRecord.js";
import DeductionRecord from "../models/DeductionRecord.js";
import DeductionPayment from "../models/DeductionPayment.js";
import ChargeRecord from "../models/ChargeRecord.js";
import EmployeeDesignation from "../models/EmployeeDesignation.js";

// ############### ID VALIDATORS #####################
export const isValidMongoId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

export const existingUser = async (userid) => {
    if (!isValidMongoId(userid)) throw new BadRequestError("invalid user id");
    const user = await User.findById(userid);
    if (!user) throw new BadRequestError("user does not exist");
    return user;
};

export const existingDepartment = async (departmentId) => {
    if (!isValidMongoId(departmentId)) throw new BadRequestError("invalid department id");
    const department = await Department.findById(departmentId);
    if (!department) throw new BadRequestError("department does not exist");
    return department;
};

export const existingEmployee = async (employeeId) => {
    if (!isValidMongoId(employeeId)) throw new BadRequestError("invalid employee id");
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new BadRequestError("employee does not exist");
    return employee;
};

export const existingAttendance = async (attendanceId) => {
    if (!isValidMongoId(attendanceId)) throw new BadRequestError("invalid attendance id");
    const attendance = await Attendance.findById(attendanceId).populate({
        path: "compensation",
        populate: {
            path: "employeeDesignation",
            populate: { path: "employee", select: "firstName lastName employeeCode" },
        },
    });
    if (!attendance) throw new BadRequestError("attendance does not exist");
    return attendance;
};

export const existingClient = async (clientId) => {
    if (!isValidMongoId(clientId)) throw new BadRequestError("invalid client id");
    const client = await Client.findById(clientId);
    if (!client) throw new BadRequestError("client does not exist");
    return client;
};

export const existingPosition = async (positionId) => {
    if (!isValidMongoId(positionId)) throw new BadRequestError("invalid position id");
    const position = await Position.findById(positionId);
    if (!position) throw new BadRequestError("position does not exist");
    return position;
};

export const existingBank = async (bankId) => {
    if (!isValidMongoId(bankId)) throw new BadRequestError("invalid bank id");
    const bank = await Bank.findById(bankId);
    if (!bank) throw new BadRequestError("bank does not exist");
    return bank;
};

export const existingBankHolder = async (bankHolderId) => {
    if (!isValidMongoId(bankHolderId)) throw new BadRequestError("invalid bank holder id");
    const bankHolder = await BankHolder.findById(bankHolderId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("bank", "bankName");
    if (!bankHolder) throw new BadRequestError("bank holder does not exist");
    return bankHolder;
};

export const existingHoliday = async (holidayId) => {
    if (!isValidMongoId(holidayId)) throw new BadRequestError("invalid holiday id");
    const holiday = await Holiday.findById(holidayId);
    if (!holiday) throw new BadRequestError("holiday does not exist");
    return holiday;
};

export const existingLeaveType = async (leaveTypeId) => {
    if (!isValidMongoId(leaveTypeId)) throw new BadRequestError("invalid leave type id");
    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) throw new BadRequestError("leave type does not exist");
    return leaveType;
};

export const existingLeaveApplication = async (leaveApplicationId) => {
    if (!isValidMongoId(leaveApplicationId)) throw new BadRequestError("invalid leave application id");
    const leaveApplication = await LeaveApplication.findById(leaveApplicationId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("leaveType", "leaveTypeName");
    if (!leaveApplication) throw new BadRequestError("leave application does not exist");
    return leaveApplication;
};

export const existingLoanApplication = async (loanApplicationId) => {
    if (!isValidMongoId(loanApplicationId)) throw new BadRequestError("invalid loan application id");
    const loanApplication = await LoanApplication.findById(loanApplicationId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("loanType", "loanTypeName loanTypeDesc");
    if (!loanApplication) throw new BadRequestError("loan application does not exist");
    return loanApplication;
};

export const existingLoanType = async (loanTypeId) => {
    if (!isValidMongoId(loanTypeId)) throw new BadRequestError("invalid loan type id");
    const loanType = await LoanType.findById(loanTypeId);
    if (!loanType) throw new BadRequestError("loan type does not exist");
    return loanType;
};

export const existingLoanPayment = async (loanPaymentId) => {
    if (!isValidMongoId(loanPaymentId)) throw new BadRequestError("invalid loan payment id");
    const loanPayment = await LoanPayment.findById(loanPaymentId).populate("loan");
    if (!loanPayment) throw new BadRequestError("loan payment does not exist");
    return loanPayment;
};

export const existingEarningType = async (earningTypeId) => {
    if (!isValidMongoId(earningTypeId)) throw new BadRequestError("invalid earning type id");
    const earningType = await EarningType.findById(earningTypeId);
    if (!earningType) throw new BadRequestError("earning type does not exist");
    return earningType;
};

export const existingAllowanceType = async (allowanceTypeId) => {
    if (!isValidMongoId(allowanceTypeId)) throw new BadRequestError("invalid allowance type id");
    const allowanceType = await AllowanceType.findById(allowanceTypeId);
    if (!allowanceType) throw new BadRequestError("allowance type does not exist");
    return allowanceType;
};

export const existingDeductionType = async (deductionTypeId) => {
    if (!isValidMongoId(deductionTypeId)) throw new BadRequestError("invalid deduction type id");
    const deductionType = await DeductionType.findById(deductionTypeId);
    if (!deductionType) throw new BadRequestError("deduction type does not exist");
    return deductionType;
};

export const existingChargeType = async (chargeTypeId) => {
    if (!isValidMongoId(chargeTypeId)) throw new BadRequestError("invalid charge type id");
    const chargeType = await ChargeType.findById(chargeTypeId);
    if (!chargeType) throw new BadRequestError("charge type does not exist");
    return chargeType;
};

export const existingSavings = async (savingsId) => {
    if (!isValidMongoId(savingsId)) throw new BadRequestError("invalid savings id");
    const savings = await Savings.findById(savingsId)
        .populate("employee", "firstName lastName employeeCode");
    if (!savings) throw new BadRequestError("savings record does not exist");
    return savings;
};

export const existingSavingsRecord = async (savingsRecordId) => {
    if (!isValidMongoId(savingsRecordId)) throw new BadRequestError("invalid savings deduction record id");
    const savingsRecord = await SavingsRecord.findById(savingsRecordId).populate("savings");
    if (!savingsRecord) throw new BadRequestError("savings deduction record does not exist");
    return savingsRecord;
};

export const existingSSSRate = async (sssRateId) => {
    if (!isValidMongoId(sssRateId)) throw new BadRequestError("invalid SSS rate id");
    const sssRate = await SSSRate.findById(sssRateId);
    if (!sssRate) throw new BadRequestError("SSS rate does not exist");
    return sssRate;
};

export const existingPhilHealthRate = async (philHealthRateId) => {
    if (!isValidMongoId(philHealthRateId)) throw new BadRequestError("invalid PhilHealth rate id");
    const philHealthRate = await PhilHealthRate.findById(philHealthRateId);
    if (!philHealthRate) throw new BadRequestError("PhilHealth rate does not exist");
    return philHealthRate;
};

export const existingPagIbigRate = async (pagIbigRateId) => {
    if (!isValidMongoId(pagIbigRateId)) throw new BadRequestError("invalid Pag-IBIG rate id");
    const pagIbigRate = await PagIbigRate.findById(pagIbigRateId);
    if (!pagIbigRate) throw new BadRequestError("Pag-IBIG rate does not exist");
    return pagIbigRate;
};

export const existingEmployeeAllowance = async (employeeAllowanceId) => {
    if (!isValidMongoId(employeeAllowanceId)) throw new BadRequestError("invalid employee allowance id");
    const employeeAllowance = await EmployeeAllowance.findById(employeeAllowanceId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("allowanceType", "allowanceName");
    if (!employeeAllowance) throw new BadRequestError("employee allowance does not exist");
    return employeeAllowance;
};

export const existingPayslip = async (payslipId) => {
    if (!isValidMongoId(payslipId)) throw new BadRequestError("invalid payslip id");
    const payslip = await Payslip.findById(payslipId).populate({
        path: "compensation",
        populate: {
            path: "employeeDesignation",
            populate: [
                { path: "employee", select: "firstName lastName employeeCode" },
                { path: "client", select: "clientName" },
                { path: "department", select: "departmentName" },
                { path: "position", select: "positionName" },
            ],
        },
    });
    if (!payslip) throw new BadRequestError("payslip does not exist");
    return payslip;
};

export const existingCompensation = async (compensationId) => {
    if (!isValidMongoId(compensationId)) throw new BadRequestError("invalid compensation id");
    const compensation = await Compensation.findById(compensationId).populate({
        path: "employeeDesignation",
        populate: [
            { path: "employee", select: "firstName lastName employeeCode" },
            { path: "client", select: "clientName" },
            { path: "department", select: "departmentName" },
            { path: "position", select: "positionName" },
        ],
    });
    if (!compensation) throw new BadRequestError("compensation does not exist");
    return compensation;
};

export const existingEmployeeDesignation = async (employeeDesignationId) => {
    if (!isValidMongoId(employeeDesignationId))
        throw new BadRequestError("invalid employee designation id");
    const employeeDesignation = await EmployeeDesignation.findById(employeeDesignationId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("client", "clientName")
        .populate("department", "departmentName")
        .populate("position", "positionName");
    if (!employeeDesignation)
        throw new BadRequestError("employee designation does not exist");
    return employeeDesignation;
};

export const existingPayroll = async (payrollId) => {
    if (!isValidMongoId(payrollId)) throw new BadRequestError("invalid payroll id");
    const payroll = await Payroll.findById(payrollId)
        .populate({
            path: "compensation",
            populate: {
                path: "employeeDesignation",
                populate: { path: "employee", select: "firstName lastName employeeCode" },
            },
        })
        .populate("earning", "name amount earningType date")
        .populate("allowances", "name amount allowanceType date")
        .populate({
            path: "deductions",
            select: "deductionRecord amount deductionDate",
            populate: {
                path: "deductionRecord",
                select: "name employee deductionType initialAmount currentAmount monthlyDeduction",
                populate: [
                    { path: "employee", select: "firstName lastName employeeCode" },
                    { path: "deductionType", select: "deductionName" },
                ],
            },
        })
        .populate({
            path: "savings",
            select: "savings amount",
            populate: {
                path: "savings",
                select: "savingsTarget cutoffDeductionAmount status",
            },
        })
        .populate({
            path: "loans",
            select: "loan amount dateOfPayment",
            populate: {
                path: "loan",
                select: "loanName loanType loanPayable monthlyAmortization loanStatus",
                populate: { path: "loanType", select: "loanTypeName" },
            },
        })
        .populate("charges", "name amount chargeType date");
    if (!payroll) throw new BadRequestError("payroll does not exist");
    return payroll;
};

export const existingEarningRecord = async (earningRecordId) => {
    if (!isValidMongoId(earningRecordId)) throw new BadRequestError("invalid earning record id");
    const earningRecord = await EarningRecord.findById(earningRecordId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("earningType", "earningName");
    if (!earningRecord) throw new BadRequestError("earning record does not exist");
    return earningRecord;
};

export const existingAllowanceRecord = async (allowanceRecordId) => {
    if (!isValidMongoId(allowanceRecordId)) throw new BadRequestError("invalid allowance record id");
    const allowanceRecord = await AllowanceRecord.findById(allowanceRecordId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("allowanceType", "allowanceName");
    if (!allowanceRecord) throw new BadRequestError("allowance record does not exist");
    return allowanceRecord;
};

export const existingDeductionRecord = async (deductionRecordId) => {
    if (!isValidMongoId(deductionRecordId)) throw new BadRequestError("invalid deduction record id");
    const deductionRecord = await DeductionRecord.findById(deductionRecordId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("deductionType", "deductionName");
    if (!deductionRecord) throw new BadRequestError("deduction record does not exist");
    return deductionRecord;
};

export const existingChargeRecord = async (chargeRecordId) => {
    if (!isValidMongoId(chargeRecordId)) throw new BadRequestError("invalid charge record id");
    const chargeRecord = await ChargeRecord.findById(chargeRecordId)
        .populate("employee", "firstName lastName employeeCode")
        .populate("chargeType", "chargeName");
    if (!chargeRecord) throw new BadRequestError("charge record does not exist");
    return chargeRecord;
};

export const existingDeductionPayment = async (deductionPaymentId) => {
    if (!isValidMongoId(deductionPaymentId)) throw new BadRequestError("invalid deduction payment id");
    const deductionPayment = await DeductionPayment.findById(deductionPaymentId)
        .populate({
            path: "deductionRecord",
            select: "name employee deductionType initialAmount currentAmount monthlyDeduction",
            populate: [
                { path: "employee", select: "firstName lastName employeeCode" },
                { path: "deductionType", select: "deductionName" },
            ],
        });
    if (!deductionPayment) throw new BadRequestError("deduction payment does not exist");
    return deductionPayment;
};

