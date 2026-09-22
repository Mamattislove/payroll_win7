// The one list of places you can navigate to.
//
// Sidebar, command palette and the header's page title all read this. It used
// to live inside Sidebar.jsx, which was fine while the sidebar was the only
// thing that navigated; the moment a second reader appeared, a private copy
// would have drifted the way attendanceRates and computeAttendance did — add a
// page, see it in the sidebar, and wonder why the palette cannot find it.
//
// A group may declare `roles`; groups without one are visible to any signed-in
// user. `end` marks a route that should only match exactly (index routes),
// mirroring NavLink's own prop.
import {
    MdDashboard,
    MdPeople,
    MdAccessTime,
    MdPayments,
    MdBeachAccess,
    MdSettings,
    MdList,
    MdReceipt,
    MdHistory,
    MdManageAccounts,
} from "react-icons/md";
import {
    FaBuilding,
    FaBriefcase,
    FaMoneyBillWave,
    FaCalendarAlt,
    FaUserTie,
    FaPiggyBank,
    FaMinusCircle,
} from "react-icons/fa";

export const navGroups = [
    {
        label: "Overview",
        links: [
            {
                to: "/dashboard",
                icon: MdDashboard,
                label: "Dashboard",
                end: true,
            },
        ],
    },
    {
        label: "Payroll",
        links: [
            {
                to: "/dashboard/attendance",
                icon: MdAccessTime,
                label: "Attendance",
            },
            {
                to: "/dashboard/attendance/bulk",
                icon: MdAccessTime,
                label: "Bulk Add Attendance",
            },
            { to: "/dashboard/payroll", icon: MdPayments, label: "Payroll" },
            { to: "/dashboard/payslips", icon: MdPayments, label: "Payslips" },
            {
                to: "/dashboard/billing-report",
                icon: MdReceipt,
                label: "Billing Report",
            },
            {
                to: "/dashboard/payroll-journal",
                icon: MdReceipt,
                label: "Payroll Journal",
            },
            {
                to: "/dashboard/net-pay-report",
                icon: MdReceipt,
                label: "Net Pay Report",
            },
            {
                to: "/dashboard/savings-report",
                icon: MdReceipt,
                label: "Savings Report",
            },
            {
                to: "/dashboard/loans-report",
                icon: MdReceipt,
                label: "Loans Report",
            },
            {
                to: "/dashboard/leaves-report",
                icon: MdReceipt,
                label: "Leaves Report",
            },
        ],
    },
    {
        label: "Employees",
        links: [
            { to: "/dashboard/employees", icon: MdPeople, label: "Employees" },
            {
                to: "/dashboard/employee-designations",
                icon: FaUserTie,
                label: "Designations",
            },
            {
                to: "/dashboard/compensation",
                icon: FaMoneyBillWave,
                label: "Compensation",
            },
            { to: "/dashboard/leave", icon: MdBeachAccess, label: "Leave" },
            { to: "/dashboard/loans", icon: FaBriefcase, label: "Loans" },
            { to: "/dashboard/savings", icon: FaPiggyBank, label: "Savings" },
            {
                to: "/dashboard/deductions",
                icon: FaMinusCircle,
                label: "Deductions",
            },
            {
                to: "/dashboard/earnings",
                icon: FaMoneyBillWave,
                label: "Earnings",
            },
            {
                to: "/dashboard/allowances",
                icon: FaPiggyBank,
                label: "Allowances",
            },
            { to: "/dashboard/charges", icon: FaMinusCircle, label: "Charges" },
        ],
    },
    {
        label: "Settings",
        links: [
            {
                to: "/dashboard/departments",
                icon: FaBuilding,
                label: "Departments",
            },
            { to: "/dashboard/positions", icon: FaUserTie, label: "Positions" },
            { to: "/dashboard/clients", icon: MdPeople, label: "Clients" },
            {
                to: "/dashboard/holidays",
                icon: FaCalendarAlt,
                label: "Holidays",
            },
            {
                to: "/dashboard/earning-types",
                icon: MdList,
                label: "Earning Types",
            },
            {
                to: "/dashboard/allowance-types",
                icon: MdList,
                label: "Allowance Types",
            },
            {
                to: "/dashboard/deduction-types",
                icon: MdList,
                label: "Deduction Types",
            },
            {
                to: "/dashboard/charge-types",
                icon: MdList,
                label: "Charge Types",
            },
            { to: "/dashboard/loan-types", icon: MdList, label: "Loan Types" },
            { to: "/dashboard/settings", icon: MdSettings, label: "Settings" },
        ],
    },
    {
        label: "Administration",
        // Only rendered for admins — the API rejects everyone else anyway,
        // so showing the link would just produce a dead end.
        roles: ["admin"],
        links: [
            {
                to: "/dashboard/users",
                icon: MdManageAccounts,
                label: "Users",
            },
            {
                to: "/dashboard/audit-logs",
                icon: MdHistory,
                label: "Audit Log",
            },
        ],
    },
];

/** Groups this role is allowed to see. Apply it in every reader, not just the
 *  sidebar — otherwise the palette happily jumps an encoder to /users. */
export const visibleNavGroups = (role) =>
    navGroups.filter((g) => !g.roles || g.roles.includes(role));

/** The same links flattened, each tagged with the group it came from, which is
 *  what the palette lists and what the header reads the page title off. */
export const visibleNavLinks = (role) =>
    visibleNavGroups(role).flatMap((g) =>
        g.links.map((link) => ({ ...link, group: g.label })),
    );

/**
 * The nav link that best describes a pathname: the longest `to` the path
 * starts with, so /dashboard/attendance/bulk resolves to Bulk Add Attendance
 * rather than Attendance, and an unlisted child like /dashboard/payroll/123
 * still reports Payroll. `end` links must match exactly, which is what stops
 * /dashboard from claiming every route beneath it.
 */
export const matchNavLink = (pathname, role) => {
    const candidates = visibleNavLinks(role).filter((link) =>
        link.end
            ? pathname === link.to
            : pathname === link.to || pathname.startsWith(link.to + "/"),
    );
    return candidates.sort((a, b) => b.to.length - a.to.length)[0] ?? null;
};
