# Payroll System — Models Reference

**Project:** MERN Payroll 3 | **Stack:** MongoDB / Mongoose / Node.js
**Generated:** 2026-06-22

---

## Table of Contents

1. [User](#1-user)
2. [Department](#2-department)
3. [Position](#3-position)
4. [DeptPosition](#4-deptposition)
5. [Client](#5-client)
6. [Employee](#6-employee)
7. [Bank](#7-bank)
8. [BankHolder](#8-bankholder)
9. [Compensation](#9-compensation)
10. [Attendance](#10-attendance)
11. [Payslip](#11-payslip)
12. [LeaveType](#12-leavetype)
13. [LeaveApplication](#13-leaveapplication)
14. [LoanApplication](#14-loanapplication)
15. [LoanPayment](#15-loanpayment)
16. [EmpSavings](#16-empsavings)
17. [EmpSavingsRecord](#17-empsavingsrecord)
18. [AllowanceType](#18-allowancetype)
19. [EmployeeAllowance](#19-employeeallowance)
20. [EarningType](#20-earningtype)
21. [DeductionType](#21-deductiontype)
22. [ChargeType](#22-chargetype)
23. [Holiday](#23-holiday)
24. [PhilHealthRate](#24-philhealthrate)
25. [PagIbigRate](#25-pagibigrate)
26. [Settings](#26-settings)
27. [Constants Reference](#27-constants-reference)
28. [Relationships Diagram](#28-relationships-diagram)

---

## 1. User

**Collection:** `users` | **Purpose:** System login accounts (HR, Admin, Viewer)

| Field        | Type            | Required | Notes                                                  |
| ------------ | --------------- | -------- | ------------------------------------------------------ |
| `username`   | String          | No       | Display name                                           |
| `email`      | String          | **Yes**  | Unique — used for login                                |
| `password`   | String          | **Yes**  | bcrypt hash, stripped from JSON responses              |
| `department` | String          | No       | Department name string (not a ref)                     |
| `role`       | String          | No       | Enum: `admin`, `hr`, `viewer`, `user` — default `user` |
| `addedBy`    | ObjectId → User | No       | Who created this account                               |
| `createdAt`  | Date            | Auto     | Mongoose timestamp                                     |
| `updatedAt`  | Date            | Auto     | Mongoose timestamp                                     |

**Indexes:** `email` (unique)
**Special:** `toJSON()` removes `password` field automatically

---

## 2. Department

**Collection:** `departments` | **Purpose:** Organizational departments

| Field            | Type   | Required | Notes       |
| ---------------- | ------ | -------- | ----------- |
| `departmentName` | String | **Yes**  | Unique      |
| `departmentDesc` | String | No       | Description |
| `createdAt`      | Date   | Auto     |             |
| `updatedAt`      | Date   | Auto     |             |

**Indexes:** `departmentName` (unique)

---

## 3. Position

**Collection:** `positions` | **Purpose:** Job positions/titles

| Field          | Type   | Required | Notes       |
| -------------- | ------ | -------- | ----------- |
| `positionName` | String | **Yes**  | Unique      |
| `positionDesc` | String | No       | Description |
| `createdAt`    | Date   | Auto     |             |
| `updatedAt`    | Date   | Auto     |             |

**Indexes:** `positionName` (unique)

---

## 4. DeptPosition

**Collection:** `deptpositions` | **Purpose:** Links a client + department + position into one deployable slot

| Field        | Type                  | Required | Notes                             |
| ------------ | --------------------- | -------- | --------------------------------- |
| `client`     | ObjectId → Client     | **Yes**  | Which client this slot belongs to |
| `department` | ObjectId → Department | **Yes**  | Department of the slot            |
| `position`   | ObjectId → Position   | **Yes**  | Job title of the slot             |
| `createdAt`  | Date                  | Auto     |                                   |
| `updatedAt`  | Date                  | Auto     |                                   |

**Purpose:** Used in `Compensation` to assign an employee to a specific client+department+position combo.

---

## 5. Client

**Collection:** `clients` | **Purpose:** Companies that employ the workers (outsourcing clients)

| Field                 | Type   | Required | Notes                   |
| --------------------- | ------ | -------- | ----------------------- |
| `clientName`          | String | **Yes**  | Company name            |
| `clientAddress`       | String | No       |                         |
| `clientEmail`         | String | No       |                         |
| `clientTelephone`     | String | No       |                         |
| `clientLogo`          | String | No       | Image URL               |
| `contactPerson`       | String | No       | Name of primary contact |
| `contactPersonNumber` | String | No       |                         |
| `contactPersonEmail`  | String | No       |                         |
| `contactPersonImage`  | String | No       | Image URL               |
| `clientSince`         | Date   | No       | Engagement start date   |
| `createdAt`           | Date   | Auto     |                         |
| `updatedAt`           | Date   | Auto     |                         |

---

## 6. Employee

**Collection:** `employees` | **Purpose:** Employee personal and employment records

| Field              | Type                  | Required | Notes                                         |
| ------------------ | --------------------- | -------- | --------------------------------------------- |
| `employeeCode`     | String                | No       | e.g. `EMP-001`                                |
| `firstName`        | String                | **Yes**  |                                               |
| `lastName`         | String                | **Yes**  |                                               |
| `middleName`       | String                | No       |                                               |
| `department`       | ObjectId → Department | No       | Home department                               |
| `gender`           | String                | No       | Enum: `male`, `female`                        |
| `profilePicture`   | String                | No       | Image URL                                     |
| `sssNumber`        | String                | No       | SSS ID                                        |
| `philhealthNumber` | String                | No       | PhilHealth ID                                 |
| `pagibigNumber`    | String                | No       | Pag-IBIG ID                                   |
| `employedSince`    | Date                  | No       | Date hired                                    |
| `employmentStatus` | String                | No       | Enum: `active`, `inactive` — default `active` |
| `createdAt`        | Date                  | Auto     |                                               |
| `updatedAt`        | Date                  | Auto     |                                               |

> **Bank info is NOT stored here.** Use `BankHolder` for employee bank accounts.

---

## 7. Bank

**Collection:** `banks` | **Purpose:** Master list of banks

| Field       | Type   | Required | Notes                       |
| ----------- | ------ | -------- | --------------------------- |
| `bankName`  | String | **Yes**  | Unique — e.g. `BDO Unibank` |
| `createdAt` | Date   | Auto     |                             |
| `updatedAt` | Date   | Auto     |                             |

**Indexes:** `bankName` (unique)

---

## 8. BankHolder

**Collection:** `bankholders` | **Purpose:** Employee bank accounts (supports multiple accounts and history)

| Field           | Type                | Required | Notes                                               |
| --------------- | ------------------- | -------- | --------------------------------------------------- |
| `employee`      | ObjectId → Employee | **Yes**  | Account owner                                       |
| `bank`          | ObjectId → Bank     | **Yes**  | Which bank                                          |
| `accountNumber` | String              | **Yes**  |                                                     |
| `charges`       | Number              | No       | Monthly bank charges — default `0`                  |
| `status`        | Number              | No       | `1` = active, `0` = replaced/inactive — default `1` |
| `createdAt`     | Date                | Auto     |                                                     |
| `updatedAt`     | Date                | Auto     |                                                     |

**Indexes:** `{ employee, status }`
**Business Rule:** One active account per bank per employee (status = 1 duplicate blocked in validation)

---

## 9. Compensation

**Collection:** `compensations` | **Purpose:** Employee contract terms for a specific deployment slot

| Field                         | Type                    | Required | Notes                                                             |
| ----------------------------- | ----------------------- | -------- | ----------------------------------------------------------------- |
| `employee`                    | ObjectId → Employee     | **Yes**  |                                                                   |
| `deptPosition`                | ObjectId → DeptPosition | No       | Client + department + position combo                              |
| `contractType`                | String                  | No       | Enum: `regular`, `contractual`                                    |
| `monthlyRate`                 | Number                  | No       | Gross monthly salary — default `0`                                |
| `dailyRate`                   | Number                  | No       | **Auto-computed:** `monthlyRate / 22`                             |
| `weeklySchedule`              | String                  | No       | e.g. `Monday-Friday`                                              |
| `timeIn`                      | String                  | No       | e.g. `08:00`                                                      |
| `timeOut`                     | String                  | No       | e.g. `17:00`                                                      |
| `nightShiftTimeIn`            | String                  | No       |                                                                   |
| `nightShiftTimeOut`           | String                  | No       |                                                                   |
| `restDay`                     | String                  | No       | e.g. `Saturday, Sunday`                                           |
| `payrollPeriod`               | String                  | No       | Enum: `weekly`, `semi-monthly`                                    |
| `activeStatus`                | String                  | No       | Enum: `active`, `inactive` — default `active`                     |
| `startContract`               | Date                    | No       |                                                                   |
| `endContract`                 | Date                    | No       |                                                                   |
| `dateOfRegularization`        | Date                    | No       |                                                                   |
| `insuranceName`               | String                  | No       |                                                                   |
| `dateInsured`                 | Date                    | No       |                                                                   |
| `insuredUntil`                | Date                    | No       |                                                                   |
| `sssContributionBasis`        | String                  | No       | Enum: see Constants — default `basic pay`                         |
| `philhealthContributionBasis` | String                  | No       | Enum: see Constants — default `gross pay`                         |
| `pagibigContributionBasis`    | String                  | No       | Enum: `with deduction`, `no deduction` — default `with deduction` |
| `sssOverwriteAmount`          | Number                  | No       | Manual override for SSS — default `0`                             |
| `philhealthOverwriteAmount`   | Number                  | No       | Manual override for PhilHealth — default `0`                      |
| `pagibigOverwriteAmount`      | Number                  | No       | Manual override for Pag-IBIG — default `0`                        |
| `createdAt`                   | Date                    | Auto     |                                                                   |
| `updatedAt`                   | Date                    | Auto     |                                                                   |

**Indexes:** `{ employee, deptPosition }` (unique)
**Auto-hooks:**

- `pre("save")` → sets `dailyRate = round(monthlyRate / 22, 2)`
- `pre("findOneAndUpdate")` → same when `monthlyRate` is patched
- `pre("updateOne")` → same

---

## 10. Attendance

**Collection:** `attendances` | **Purpose:** Daily time record per employee

| Field                       | Type                | Required | Notes                                          |
| --------------------------- | ------------------- | -------- | ---------------------------------------------- |
| `employee`                  | ObjectId → Employee | **Yes**  |                                                |
| `attendanceDate`            | Date                | **Yes**  |                                                |
| `dayType`                   | String              | No       | Enum: see Day Types in Constants               |
| `regularHours`              | Number              | No       | default `0`                                    |
| `regularHoursPay`           | Number              | No       | default `0`                                    |
| `overtimeHours`             | Number              | No       | default `0`                                    |
| `overtimeHoursPay`          | Number              | No       | default `0`                                    |
| `nightPremiumHours`         | Number              | No       | default `0`                                    |
| `nightPremiumPay`           | Number              | No       | default `0`                                    |
| `overtimeNightPremiumHours` | Number              | No       | default `0`                                    |
| `overtimeNightPremiumPay`   | Number              | No       | default `0`                                    |
| `remarks`                   | String              | No       | Leave type name when dayType is Leave With Pay |
| `createdAt`                 | Date                | Auto     |                                                |
| `updatedAt`                 | Date                | Auto     |                                                |

**Indexes:** `{ employee, attendanceDate }` (unique) — one record per employee per day

---

## 11. Payslip

**Collection:** `payslips` | **Purpose:** Computed pay record for a pay period

| Field                          | Type                  | Required | Notes                                                   |
| ------------------------------ | --------------------- | -------- | ------------------------------------------------------- |
| `employee`                     | ObjectId → Employee   | **Yes**  |                                                         |
| `client`                       | ObjectId → Client     | No       | Snapshot of client at time of payroll                   |
| `department`                   | ObjectId → Department | No       | Snapshot                                                |
| `position`                     | ObjectId → Position   | No       | Snapshot                                                |
| `payPeriodFrom`                | Date                  | **Yes**  | Start of pay period                                     |
| `payPeriodTo`                  | Date                  | **Yes**  | End of pay period                                       |
| `payrollPeriod`                | String                | No       | Enum: `weekly`, `semi-monthly`                          |
| `contractType`                 | String                | No       | Enum: `regular`, `contractual`                          |
| `regularPay`                   | Number                | No       | default `0`                                             |
| `holidayRestdayPay`            | Number                | No       | default `0`                                             |
| `regularOvertimePay`           | Number                | No       | default `0`                                             |
| `holidayRestdayOvertimePay`    | Number                | No       | default `0`                                             |
| `nightDifferentialPay`         | Number                | No       | default `0`                                             |
| `overtimeNightDifferentialPay` | Number                | No       | default `0`                                             |
| `totalEarnings`                | Number                | No       | Sum of all earnings — default `0`                       |
| `grossPay`                     | Number                | No       | Before deductions — default `0`                         |
| `totalDeductions`              | Number                | No       | SSS + PhilHealth + Pag-IBIG + loans + etc — default `0` |
| `netSalary`                    | Number                | No       | `grossPay - totalDeductions` — default `0`              |
| `finalPay`                     | Number                | No       | After all adjustments — default `0`                     |
| `totalPayrollPeriodPay`        | Number                | No       | default `0`                                             |
| `earnings`                     | String                | No       | Serialized: `"Name:amount,Name:amount"`                 |
| `allowances`                   | String                | No       | Serialized                                              |
| `deductions`                   | String                | No       | Serialized                                              |
| `otherCharges`                 | String                | No       | Serialized                                              |
| `leaveWithPayDetail`           | String                | No       | Serialized                                              |
| `billingReport`                | String                | No       | Serialized                                              |
| `createdBy`                    | ObjectId → Employee   | No       | HR staff who generated this payslip                     |
| `createdAt`                    | Date                  | Auto     |                                                         |
| `updatedAt`                    | Date                  | Auto     |                                                         |

**Indexes:** `{ employee, payPeriodFrom }`

---

## 12. LeaveType

**Collection:** `leavetypes` | **Purpose:** Types of leave (Vacation, Sick, Maternity, etc.)

| Field           | Type   | Required | Notes  |
| --------------- | ------ | -------- | ------ |
| `leaveTypeName` | String | **Yes**  | Unique |
| `createdAt`     | Date   | Auto     |        |
| `updatedAt`     | Date   | Auto     |        |

---

## 13. LeaveApplication

**Collection:** `leaveapplications` | **Purpose:** Employee leave requests

| Field       | Type                 | Required | Notes                                                       |
| ----------- | -------------------- | -------- | ----------------------------------------------------------- |
| `employee`  | ObjectId → Employee  | **Yes**  | Applicant                                                   |
| `leaveType` | ObjectId → LeaveType | **Yes**  |                                                             |
| `dateFrom`  | Date                 | **Yes**  | Leave start                                                 |
| `dateTo`    | Date                 | **Yes**  | Leave end                                                   |
| `notes`     | String               | No       | Reason/remarks                                              |
| `withPay`   | String               | No       | Enum: `with pay`, `without pay` — default `without pay`     |
| `halfday`   | String               | No       | Enum: `full day`, `half day` — default `full day`           |
| `status`    | String               | No       | Enum: `pending`, `approved`, `rejected` — default `pending` |
| `createdAt` | Date                 | Auto     |                                                             |
| `updatedAt` | Date                 | Auto     |                                                             |

**Indexes:** `{ employee, status }`

---

## 14. LoanApplication

**Collection:** `loanapplications` | **Purpose:** Employee government/personal loan records

| Field                    | Type                | Required | Notes                                             |
| ------------------------ | ------------------- | -------- | ------------------------------------------------- |
| `employee`               | ObjectId → Employee | **Yes**  |                                                   |
| `loanCategory`           | String              | **Yes**  | Enum: `sss`, `hdmf / pag-ibig`, `personal`        |
| `loanType`               | String              | No       | Sub-type description                              |
| `loanPayable`            | Number              | No       | Remaining balance — default `0`                   |
| `monthlyAmortization`    | Number              | No       | Monthly deduction amount — default `0`            |
| `firstMonthAmortization` | Date                | No       | When deductions start                             |
| `loanStatus`             | String              | No       | Enum: `active`, `fully paid` — default `active`   |
| `isDeleted`              | String              | No       | Enum: `active`, `soft-deleted` — default `active` |
| `remarks`                | String              | No       |                                                   |
| `createdAt`              | Date                | Auto     |                                                   |
| `updatedAt`              | Date                | Auto     |                                                   |

**Indexes:** `{ employee, loanCategory, loanStatus, isDeleted }`
**Auto-hooks:**

- `pre("save")` → if `loanPayable ≤ 0`: sets `loanPayable = 0`, `loanStatus = "fully paid"`
- `pre("findOneAndUpdate")` → same
- `pre("updateOne")` → same
  **Delete behavior:** Soft-delete — sets `isDeleted = "soft-deleted"` instead of removing document

---

## 15. LoanPayment

**Collection:** `loanpayments` | **Purpose:** Individual payment transactions against a loan

| Field       | Type                       | Required | Notes                                |
| ----------- | -------------------------- | -------- | ------------------------------------ |
| `loan`      | ObjectId → LoanApplication | **Yes**  | Which loan this payment applies to   |
| `amount`    | Number                     | **Yes**  | Amount paid                          |
| `payslip`   | ObjectId → Payslip         | No       | Which payslip triggered this payment |
| `createdAt` | Date                       | Auto     |                                      |
| `updatedAt` | Date                       | Auto     |                                      |

**Indexes:** `{ loan }`

---

## 16. EmpSavings

**Collection:** `empsavings` | **Purpose:** Employee savings deduction plan

| Field                   | Type                | Required | Notes                                               |
| ----------------------- | ------------------- | -------- | --------------------------------------------------- |
| `employee`              | ObjectId → Employee | **Yes**  |                                                     |
| `savingsTarget`         | Number              | **Yes**  | Total savings goal                                  |
| `cutoffDeductionAmount` | Number              | **Yes**  | Amount deducted per cutoff                          |
| `effectiveDate`         | Date                | No       | When deductions start                               |
| `addedBy`               | ObjectId → Employee | No       | HR staff who set this up                            |
| `status`                | Number              | No       | `0` = active, `1` = completed/stopped — default `0` |
| `createdAt`             | Date                | Auto     |                                                     |
| `updatedAt`             | Date                | Auto     |                                                     |

**Indexes:** `{ employee, status }`
**Business Rule:** Only one active savings plan per employee (`status = 0`) at a time

---

## 17. EmpSavingsRecord

**Collection:** `empsavingsrecords` | **Purpose:** Individual deduction entries for a savings plan

| Field            | Type                  | Required | Notes                                      |
| ---------------- | --------------------- | -------- | ------------------------------------------ |
| `savings`        | ObjectId → EmpSavings | **Yes**  | The savings plan this deduction belongs to |
| `payslip`        | ObjectId → Payslip    | No       | Which payslip made this deduction          |
| `amountDeducted` | Number                | **Yes**  | Actual amount deducted                     |
| `createdAt`      | Date                  | Auto     |                                            |
| `updatedAt`      | Date                  | Auto     |                                            |

**Indexes:** `{ savings }`

---

## 18. AllowanceType

**Collection:** `allowancetypes` | **Purpose:** Types of allowances (Transportation, Meal, Communication, etc.)

| Field           | Type   | Required | Notes  |
| --------------- | ------ | -------- | ------ |
| `allowanceName` | String | **Yes**  | Unique |
| `allowanceDesc` | String | No       |        |
| `createdAt`     | Date   | Auto     |        |
| `updatedAt`     | Date   | Auto     |        |

---

## 19. EmployeeAllowance

**Collection:** `employeeallowances` | **Purpose:** Assigns a recurring allowance amount to an employee

| Field           | Type                     | Required | Notes                                         |
| --------------- | ------------------------ | -------- | --------------------------------------------- |
| `employee`      | ObjectId → Employee      | **Yes**  |                                               |
| `allowanceType` | ObjectId → AllowanceType | **Yes**  |                                               |
| `amount`        | Number                   | **Yes**  | Allowance amount — default `0`                |
| `payrollPeriod` | String                   | No       | Enum: `weekly`, `semi-monthly`                |
| `activeStatus`  | String                   | No       | Enum: `active`, `inactive` — default `active` |
| `createdAt`     | Date                     | Auto     |                                               |
| `updatedAt`     | Date                     | Auto     |                                               |

**Indexes:** `{ employee, allowanceType }` (unique), `{ employee, activeStatus }`
**Business Rule:** One allowance type per employee (no duplicates)

---

## 20. EarningType

**Collection:** `earningtypes` | **Purpose:** Types of earnings (Overtime, Holiday Pay, Night Diff, etc.)

| Field         | Type   | Required | Notes  |
| ------------- | ------ | -------- | ------ |
| `earningName` | String | **Yes**  | Unique |
| `earningDesc` | String | No       |        |
| `createdAt`   | Date   | Auto     |        |
| `updatedAt`   | Date   | Auto     |        |

---

## 21. DeductionType

**Collection:** `deductiontypes` | **Purpose:** Types of deductions (Cash Advance, Uniform, etc.)

| Field           | Type   | Required | Notes  |
| --------------- | ------ | -------- | ------ |
| `deductionName` | String | **Yes**  | Unique |
| `deductionDesc` | String | No       |        |
| `createdAt`     | Date   | Auto     |        |
| `updatedAt`     | Date   | Auto     |        |

---

## 22. ChargeType

**Collection:** `chargetypes` | **Purpose:** Types of client billing charges

| Field        | Type   | Required | Notes  |
| ------------ | ------ | -------- | ------ |
| `chargeName` | String | **Yes**  | Unique |
| `chargeDesc` | String | No       |        |
| `createdAt`  | Date   | Auto     |        |
| `updatedAt`  | Date   | Auto     |        |

---

## 23. Holiday

**Collection:** `holidays` | **Purpose:** Philippine public holidays

| Field          | Type   | Required | Notes                         |
| -------------- | ------ | -------- | ----------------------------- |
| `date`         | Date   | **Yes**  | Unique — one holiday per date |
| `eventName`    | String | **Yes**  | e.g. `Rizal Day`              |
| `specialLegal` | String | **Yes**  | Enum: `special`, `legal`      |
| `createdAt`    | Date   | Auto     |                               |
| `updatedAt`    | Date   | Auto     |                               |

**Indexes:** `date` (unique)

---

## 24. PhilHealthRate

**Collection:** `philhealthrates` | **Purpose:** Annual PhilHealth contribution rates

| Field                    | Type   | Required | Notes                            |
| ------------------------ | ------ | -------- | -------------------------------- |
| `year`                   | Number | **Yes**  | Unique — one rate table per year |
| `premiumRate`            | Number | **Yes**  | e.g. `0.05` for 5%               |
| `employeeShare`          | Number | **Yes**  | e.g. `0.5` for 50% of premium    |
| `minimumSalaryThreshold` | Number | **Yes**  | Minimum salary for computation   |
| `deductionCeiling`       | Number | No       | Maximum deductible amount        |
| `createdAt`              | Date   | Auto     |                                  |
| `updatedAt`              | Date   | Auto     |                                  |

**Indexes:** `year` (unique)

---

## 25. PagIbigRate

**Collection:** `pagibigrates` | **Purpose:** Pag-IBIG (HDMF) contribution rate configuration

| Field                           | Type    | Required | Notes                                             |
| ------------------------------- | ------- | -------- | ------------------------------------------------- |
| `year`                          | Number  | No       | Reference year                                    |
| `effectiveDate`                 | Date    | No       | When this rate became effective                   |
| `incomeCeiling`                 | Number  | No       | Max salary subject to contribution                |
| `basicEmployeeShare`            | Number  | No       | Employee rate for salary ≤ threshold              |
| `basicEmployerShare`            | Number  | No       | Employer rate for salary ≤ threshold              |
| `overThresholdEmployeeShare`    | Number  | No       | Employee rate for salary > threshold              |
| `overThresholdEmployerShare`    | Number  | No       | Employer rate for salary > threshold              |
| `flatRateMaxDeduction`          | Number  | No       | Maximum flat rate deduction                       |
| `percentageRateSalaryThreshold` | Number  | No       | Salary threshold between basic/over rates         |
| `isBaseline`                    | Boolean | No       | default `false` — marks the default fallback rate |
| `createdAt`                     | Date    | Auto     |                                                   |
| `updatedAt`                     | Date    | Auto     |                                                   |

---

## 26. Settings

**Collection:** `settings` | **Purpose:** Global system overrides (singleton — only 1 document)

| Field                       | Type   | Required | Notes                                             |
| --------------------------- | ------ | -------- | ------------------------------------------------- |
| `philhealthOverwriteAmount` | Number | No       | Fixed PhilHealth deduction override — default `0` |
| `pagibigOverwriteAmount`    | Number | No       | Fixed Pag-IBIG deduction override — default `0`   |
| `createdAt`                 | Date   | Auto     |                                                   |
| `updatedAt`                 | Date   | Auto     |                                                   |

> **Usage:** Always read with `Settings.findOne()`. Update with `findOneAndUpdate({}, data, { upsert: true })`.

---

## 27. Constants Reference

### USER_ROLES

| Key    | Value      |
| ------ | ---------- |
| ADMIN  | `"admin"`  |
| HR     | `"hr"`     |
| VIEWER | `"viewer"` |
| USER   | `"user"`   |

### GENDER

| Key    | Value      |
| ------ | ---------- |
| MALE   | `"male"`   |
| FEMALE | `"female"` |

### EMPLOYMENT_STATUS

| Key      | Value        |
| -------- | ------------ |
| ACTIVE   | `"active"`   |
| INACTIVE | `"inactive"` |

### CONTRACT_TYPES

| Key         | Value           |
| ----------- | --------------- |
| CONTRACTUAL | `"contractual"` |
| REGULAR     | `"regular"`     |

### PAYROLL_PERIODS

| Key          | Value            |
| ------------ | ---------------- |
| WEEKLY       | `"weekly"`       |
| SEMI_MONTHLY | `"semi-monthly"` |

### COMPENSATION_STATUS

| Key      | Value        |
| -------- | ------------ |
| ACTIVE   | `"active"`   |
| INACTIVE | `"inactive"` |

### HOLIDAY_TYPES

| Key     | Value       |
| ------- | ----------- |
| SPECIAL | `"special"` |
| LEGAL   | `"legal"`   |

### LEAVE_STATUS

| Key      | Value        |
| -------- | ------------ |
| PENDING  | `"pending"`  |
| APPROVED | `"approved"` |
| REJECTED | `"rejected"` |

### LEAVE_WITH_PAY

| Key         | Value           |
| ----------- | --------------- |
| WITH_PAY    | `"with pay"`    |
| WITHOUT_PAY | `"without pay"` |

### LEAVE_HALFDAY

| Key      | Value        |
| -------- | ------------ |
| FULL_DAY | `"full day"` |
| HALF_DAY | `"half day"` |

### LOAN_CATEGORIES

| Key          | Value               |
| ------------ | ------------------- |
| SSS          | `"sss"`             |
| HDMF_PAGIBIG | `"hdmf / pag-ibig"` |
| PERSONAL     | `"personal"`        |

### LOAN_STATUS

| Key        | Value          |
| ---------- | -------------- |
| ACTIVE     | `"active"`     |
| FULLY_PAID | `"fully paid"` |

### LOAN_RECORD_STATUS

| Key          | Value            |
| ------------ | ---------------- |
| ACTIVE       | `"active"`       |
| SOFT_DELETED | `"soft-deleted"` |

### SSS_CONTRIBUTION_BASIS / PHILHEALTH_CONTRIBUTION_BASIS

| Key            | Value                |
| -------------- | -------------------- |
| BASIC_PAY      | `"basic pay"`        |
| GROSS_PAY      | `"gross pay"`        |
| NO_DEDUCTION   | `"no deduction"`     |
| BASIC_WITH_SIL | `"basic pay w/ SIL"` |

### PAGIBIG_CONTRIBUTION_BASIS

| Key            | Value              |
| -------------- | ------------------ |
| WITH_DEDUCTION | `"with deduction"` |
| NO_DEDUCTION   | `"no deduction"`   |

### DAY_TYPES (Attendance)

| Value                              |
| ---------------------------------- |
| `"Regular"`                        |
| `"Special / Rest Day"`             |
| `"Legal Holiday"`                  |
| `"Double Holiday (Legal + Legal)"` |
| `"Rest Day (OFF / Absent)"`        |
| `"Absent"`                         |
| `"Leave"`                          |
| `"Leave With Pay"`                 |
| `"Special + Rest Day"`             |
| `"Legal Regular Pay"`              |
| `"Legal 3x Pay"`                   |
| `"Legal + RD 2x Pay"`              |
| `"Legal + RD Regular Pay"`         |
| `"Legal + RD 3x Pay"`              |
| `"Leave Half Day"`                 |

---

## 28. Relationships Diagram

```
User
 └─ addedBy → User

Employee
 └─ department → Department

BankHolder
 ├─ employee → Employee
 └─ bank → Bank

DeptPosition
 ├─ client → Client
 ├─ department → Department
 └─ position → Position

Compensation
 ├─ employee → Employee
 └─ deptPosition → DeptPosition
       ├─ client → Client
       ├─ department → Department
       └─ position → Position

Attendance
 └─ employee → Employee

Payslip
 ├─ employee → Employee
 ├─ client → Client
 ├─ department → Department
 ├─ position → Position
 └─ createdBy → Employee

LeaveApplication
 ├─ employee → Employee
 └─ leaveType → LeaveType

LoanApplication
 └─ employee → Employee

LoanPayment
 ├─ loan → LoanApplication
 └─ payslip → Payslip (optional)

EmpSavings
 ├─ employee → Employee
 └─ addedBy → Employee (optional)

EmpSavingsRecord
 ├─ savings → EmpSavings
 └─ payslip → Payslip (optional)

EmployeeAllowance
 ├─ employee → Employee
 └─ allowanceType → AllowanceType

Holiday         (standalone)
PhilHealthRate  (standalone)
PagIbigRate     (standalone)
Settings        (singleton)
EarningType     (standalone lookup)
DeductionType   (standalone lookup)
ChargeType      (standalone lookup)
```

---

## API Routes Summary

| Model             | Base Route                    |
| ----------------- | ----------------------------- |
| Auth              | `/api/v1/auth`                |
| User              | `/api/v1/users`               |
| Employee          | `/api/v1/employees`           |
| Department        | `/api/v1/departments`         |
| Position          | `/api/v1/positions`           |
| DeptPosition      | `/api/v1/dept-positions`      |
| Client            | `/api/v1/clients`             |
| Bank              | `/api/v1/banks`               |
| BankHolder        | `/api/v1/bank-holders`        |
| Compensation      | `/api/v1/compensations`       |
| Attendance        | `/api/v1/attendances`         |
| Payslip           | `/api/v1/payslips`            |
| LeaveType         | `/api/v1/leave-types`         |
| LeaveApplication  | `/api/v1/leave-applications`  |
| LoanApplication   | `/api/v1/loan-applications`   |
| LoanPayment       | `/api/v1/loan-payments`       |
| EmpSavings        | `/api/v1/emp-savings`         |
| EmpSavingsRecord  | `/api/v1/emp-savings-records` |
| AllowanceType     | `/api/v1/allowance-types`     |
| EmployeeAllowance | `/api/v1/employee-allowances` |
| EarningType       | `/api/v1/earning-types`       |
| DeductionType     | `/api/v1/deduction-types`     |
| ChargeType        | `/api/v1/charge-types`        |
| Holiday           | `/api/v1/holidays`            |
| PhilHealthRate    | `/api/v1/philhealth-rates`    |
| PagIbigRate       | `/api/v1/pagibig-rates`       |
| Settings          | `/api/v1/settings`            |

---

_End of Reference — 26 models, 27 API routes_
