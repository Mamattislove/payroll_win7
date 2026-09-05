import { NavLink } from "react-router-dom";
import { IoCloseOutline, IoLogOutOutline } from "react-icons/io5";
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
import customFetch from "../../../utils/customFetch";

const navGroups = [
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

const Sidebar = ({ user, isOpen, onClose }) => {
    // A group may declare the roles allowed to see it; the rest are public
    // to any signed-in user.
    const visibleGroups = navGroups.filter(
        (g) => !g.roles || g.roles.includes(user?.role),
    );

    const handleLogout = async () => {
        await customFetch.get("/auth/logout");
        window.location.href = "/login";
    };

    return (
        <aside
            className={`fixed lg:static inset-y-0 left-0 z-30 w-60 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 lg:translate-x-0 ${
                isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
                <h1 className="font-bold text-base">
                    Yaman ng Lahi Labor Service Cooperative
                </h1>
                <button
                    className="lg:hidden text-slate-400 hover:text-white"
                    onClick={onClose}
                >
                    <IoCloseOutline className="text-xl" />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
                {visibleGroups.map((group) => (
                    <div key={group.label}>
                        <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                            {group.label}
                        </p>
                        <ul className="space-y-0.5">
                            {group.links.map(
                                ({ to, icon: Icon, label, end }) => (
                                    <li key={to}>
                                        <NavLink
                                            to={to}
                                            end={end}
                                            onClick={onClose}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                                    isActive
                                                        ? "bg-slate-700 text-white"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                                                }`
                                            }
                                        >
                                            <Icon className="text-base shrink-0" />
                                            {label}
                                        </NavLink>
                                    </li>
                                ),
                            )}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="px-4 py-4 border-t border-slate-700 shrink-0">
                <div className="mb-2 px-2">
                    <p className="text-sm font-medium truncate">
                        {user?.username}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">
                        {user?.role}
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    <IoLogOutOutline className="text-base" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
