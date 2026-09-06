import { USER_ROLES } from "./constants.js";

/**
 * Who may change what, in one table, imported by both the routers that enforce
 * it and the pages that render against it.
 *
 * The frontend needs to know these rules to avoid offering an Add button that
 * only ever produces "unauthorized to access this route". Keeping a second copy
 * of the rules in the client is how that goes stale: the router is tightened,
 * the UI keeps offering the button, and nobody notices until a user complains.
 * So the router reads its roles from here too -- change a line and both sides
 * move together.
 *
 * Reading is deliberately not modelled. Every one of these endpoints allows GET
 * to any signed-in user, so a role that cannot write still sees the list; it
 * just gets no controls to change it.
 */
export const WRITE_ROLES = {
    // Master data.
    earningTypes: [USER_ROLES.HR, USER_ROLES.ENCODER],
    allowanceTypes: [USER_ROLES.HR, USER_ROLES.ENCODER],
    deductionTypes: [USER_ROLES.HR, USER_ROLES.ENCODER],
    chargeTypes: [USER_ROLES.HR, USER_ROLES.ENCODER],
    holidays: [USER_ROLES.HR, USER_ROLES.ENCODER],

    // Timekeeping and the payroll itself.
    attendances: [USER_ROLES.HR, USER_ROLES.ENCODER],
    payrolls: [USER_ROLES.HR, USER_ROLES.ENCODER],

    // The pay adjustments an encoder maintains: the standalone Earnings,
    // Allowances and Charges pages, and the matching sections that link those
    // records onto a payroll.
    earningRecords: [USER_ROLES.HR, USER_ROLES.ENCODER],
    allowanceRecords: [USER_ROLES.HR, USER_ROLES.ENCODER],
    chargeRecords: [USER_ROLES.HR, USER_ROLES.ENCODER],

    // Deductions, loans and savings stay with HR: they move money the employee
    // already owes, so they are kept away from the role that does the daily
    // encoding. The payroll edit screen therefore still gates every section on
    // its own resource rather than on one flag for the page.
    deductionRecords: [USER_ROLES.HR],
    deductionPayments: [USER_ROLES.ADMIN, USER_ROLES.HR],
    loanPayments: [USER_ROLES.HR],
    savingsRecords: [USER_ROLES.HR],
};

/**
 * @param {string} resource - a key of WRITE_ROLES
 * @param {string} role - User.role of the signed-in user
 * @returns {boolean} whether that role may create, update or delete it
 */
export function canWrite(resource, role) {
    const allowed = WRITE_ROLES[resource];
    // An unknown resource means the caller mistyped a key. Deny rather than
    // allow, so the mistake shows up as a missing button and not as a user
    // being handed controls the API will reject.
    if (!allowed) return false;
    return allowed.includes(role);
}
