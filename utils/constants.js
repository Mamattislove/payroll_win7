// User.role
export const USER_ROLES = {
    ADMIN: "admin",
    HR: "hr",
    VIEWER: "viewer",
    USER: "user",
};

// Attendance.day_type
export const DAY_TYPES = {
    REGULAR: "Regular",
    SPECIAL_HOLIDAY: "Special / Rest Day",
    LEGAL_HOLIDAY: "Legal Holiday",
    DOUBLE_HOLIDAY: "Double Holiday (Legal + Legal)",
    REST_DAY: "Rest Day (OFF / Absent)",
    ABSENT: "Absent",
    LEAVE: "Leave",
    LEAVE_WITH_PAY: "Leave With Pay",
    SPECIAL_AND_REST_DAY: "Special + Rest Day",
    LEGAL_REGULAR_PAY: "Legal Regular Pay",
    LEGAL_3X_PAY: "Legal 3x Pay",
    LEGAL_RD_2X_PAY: "Legal + RD 2x Pay",
    LEGAL_RD_REGULAR_PAY: "Legal + RD Regular Pay",
    LEGAL_RD_3X_PAY: "Legal + RD 3x Pay",
    LEAVE_HALFDAY: "Leave Half Day",
};

// Holiday.special_legal
export const HOLIDAY_TYPES = {
    SPECIAL: "special",
    LEGAL: "legal",
};

// Payroll.EmploymenyType
export const PAYROLL_EMPLOYMENT_TYPE = {
    REGULAR: "regular",
    CONTRACTUAL: "contractual",
};

// probationary, project based, regular, seasonal, train
export const EMPLOYMENT_TYPE = {
    PROBATIONARY: "probationary employee",
    PROJECT_BASED: "project based employee",
    REGULAR: "regular employee",
    SEASONAL: "seasonal employee",
    TRAIN: "train employee",
};

// Compensation.contract_type / Payslip.contract_type
export const CONTRACT_TYPES = {
    REGULAR: "regular",
    CONTRACTUAL: "contractual",
};

// Compensation.payroll_period / Payslip.payroll_period
export const PAYROLL_PERIODS = {
    DAILY: "daily",
    WEEKLY: "weekly",
    SEMI_MONTHLY: "semi-monthly",
    MONTHLY: "monthly",
};

// Compensation.active_status
export const COMPENSATION_STATUS = {
    INACTIVE: "inactive",
    ACTIVE: "active",
};

// Compensation.sss_contribution_basis
export const SSS_CONTRIBUTION_BASIS = {
    BASIC_PAY: "basic pay",
    GROSS_PAY: "gross pay",
    NO_DEDUCTION: "no deduction",
    BASIC_WITH_SIL: "basic pay w/ SIL",
};

// Compensation.philhealth_contribution_basis
export const PHILHEALTH_CONTRIBUTION_BASIS = {
    BASIC_PAY: "basic pay",
    GROSS_PAY: "gross pay",
    NO_DEDUCTION: "no deduction",
    BASIC_WITH_SIL: "basic pay w/ SIL",
};

// Compensation.pagibig_contribution_basis
export const PAGIBIG_CONTRIBUTION_BASIS = {
    BASIC_PAY: "basic pay",
    GROSS_PAY: "gross pay",
    NO_DEDUCTION: "no deduction",
};

// Employee.employment_status
export const EMPLOYMENT_STATUS = {
    INACTIVE: "inactive",
    ACTIVE: "active",
};

// Employee.gender
export const GENDER = {
    MALE: "male",
    FEMALE: "female",
};

// Employee.CivilStatus
// Single, Married, Widowed, Legally Separated, Annulled, and Divorced
export const CIVIL_STATUS = {
    SINGLE: "single",
    MARRIED: "married",
    WIDOWED: "widowed",
    LEGALLY_SEPARATED: "legally separated",
    ANNULLED: "annulled",
    DIVORCED: "divorced",
};

// College Placementt Office, Letter, Personal Visit, Employment Agency, Advertisement
export const WHERE_DID_YOU_HEAR_ABOUT_US = {
    COLLEGE_PLACEMENT_OFFICE: "college placement office",
    LETTER: "letter",
    PERSONAL_VISIT: "personal visit",
    EMPLOYMENT_AGENCY: "employment agency",
    ADVERTISEMENT: "advertisement",
};

// LeaveApplication.status
export const LEAVE_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
};

// LeaveApplication.with_pay
export const LEAVE_WITH_PAY = {
    WITHOUT_PAY: "without pay",
    WITH_PAY: "with pay",
};

// LeaveApplication.halfday
export const LEAVE_HALFDAY = {
    FULL_DAY: "full day",
    HALF_DAY: "half day",
};

// LoanApplication.loan_category
export const LOAN_CATEGORIES = {
    SSS: "SSS",
    HDMF_PAGIBIG: "HDMF / PAG-IBIG",
    PERSONAL: "personal",
};

// LoanApplication.loan_status
export const LOAN_STATUS = {
    ONGOING: "on going",
    FULLY_PAID: "fully paid",
};

// LoanApplication.is_deleted
export const LOAN_RECORD_STATUS = {
    SOFT_DELETED: "soft-deleted",
    ACTIVE: "active",
};

export const SAVINS_STATUS = {
    ACTIVE: "active",
    COMPLETED: "completed",
};

// Payslip.status
export const PAYSLIP_STATUS = {
    DRAFT: "draft",
    FINALIZED: "finalized",
};

export const DAYS = {
    MONDAY: "Monday",
    TUESDAY: "Tuesday",
    WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday",
    FRIDAY: "Friday",
    SATURDAY: "Saturday",
    SUNDAY: "Sunday",
};

// BankHolder status
export const BANKHOLDER_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
};

// AuditLog.action — what a logged request did. Read requests are not logged.
export const AUDIT_ACTIONS = {
    CREATE: "create",
    UPDATE: "update",
    DELETE: "delete",
    LOGIN: "login",
    LOGIN_FAILED: "login_failed",
    LOGOUT: "logout",
};
