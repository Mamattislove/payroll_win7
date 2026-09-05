import { Link, redirect, useLoaderData, useRouteLoaderData } from "react-router-dom";
import customFetch from "../../utils/customFetch";
import { HOLIDAY_TYPES } from "../../../utils/constants";
import { MdAccessTime, MdPayments, MdPeople, MdBeachAccess } from "react-icons/md";
import {
    FaBriefcase, FaCalendarAlt, FaBuilding, FaMoneyBillWave, FaPiggyBank, FaUserTie,
} from "react-icons/fa";

// ─── loader ──────────────────────────────────────────────────────────────────

export const loader = async () => {
    try {
        const [empRes, leaveRes, holidayRes, summaryRes] = await Promise.all([
            customFetch.get("/employees?limit=1"),
            customFetch.get("/leave-applications?status=pending&limit=6"),
            customFetch.get("/holidays?limit=500"),
            customFetch.get("/payrolls/dashboard-summary"),
        ]);
        return {
            totalEmployees: empRes.data.totalEmployees ?? 0,
            pendingLeaves: leaveRes.data.leaveApplications ?? [],
            totalPendingLeaves: leaveRes.data.totalLeaveApplications ?? 0,
            holidays: holidayRes.data.holidays ?? [],
            cutoff: summaryRes.data.cutoff ?? null,
            latestPayroll: summaryRes.data.latestPayroll ?? null,
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        return {
            totalEmployees: 0,
            pendingLeaves: [],
            totalPendingLeaves: 0,
            holidays: [],
            cutoff: null,
            latestPayroll: null,
        };
    }
};

// ─── Formatting ──────────────────────────────────────────────────────────────

// Payroll dates are stored at UTC midnight, so render them in UTC — local time
// would show the 31st as the 1st for anyone east of Greenwich.
const fmtDay = (v) =>
    v
        ? new Date(v).toLocaleDateString("en-PH", {
              timeZone: "UTC",
              month: "short",
              day: "numeric",
          })
        : "—";

const fmtPeso = (n) =>
    `₱${(+n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

// ─── Current cutoff ──────────────────────────────────────────────────────────

const CutoffCard = ({ cutoff }) => {
    if (!cutoff) {
        return (
            <div className="bg-slate-900 text-white rounded-xl p-5 sm:p-6 flex items-center justify-center h-full">
                <p className="text-sm text-slate-400">Cycle data unavailable.</p>
            </div>
        );
    }

    const { from, to, daysRemaining, activeEmployees, processed, awaitingPayroll } =
        cutoff;
    const pct = activeEmployees
        ? Math.min(100, Math.round((processed / activeEmployees) * 100))
        : 0;

    return (
        <Link
            to="/dashboard/payroll"
            className="bg-slate-900 text-white rounded-xl p-5 sm:p-6 flex flex-col justify-between h-full hover:bg-slate-800 transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Current Cutoff
                </p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                    {daysRemaining === 0
                        ? "Ends today"
                        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`}
                </span>
            </div>

            <div className="mt-3">
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">
                    {fmtDay(from)} – {fmtDay(to)}
                </p>

                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${pct}%` }}
                    />
                </div>

                <p className="text-slate-300 text-xs mt-2 tabular-nums">
                    {processed.toLocaleString()} of{" "}
                    {activeEmployees.toLocaleString()} processed
                    {awaitingPayroll > 0 && (
                        <span className="text-amber-300">
                            {" · "}
                            {awaitingPayroll} awaiting
                        </span>
                    )}
                </p>
            </div>
        </Link>
    );
};

// ─── Awaiting payroll ────────────────────────────────────────────────────────

const AwaitingPayroll = ({ cutoff }) => {
    const withAttendance = cutoff?.withAttendance ?? 0;
    const awaiting = cutoff?.awaitingPayroll ?? 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <MdAccessTime className="text-slate-400" size={16} />
                    Awaiting Payroll
                </h3>
                <Link
                    to="/dashboard/payroll"
                    className="text-[11px] text-slate-400 hover:text-slate-700"
                >
                    Process →
                </Link>
            </div>

            {awaiting === 0 ? (
                <p className="text-sm text-slate-400">
                    {withAttendance === 0
                        ? "No timekeeping recorded for this cutoff yet."
                        : "Every employee with timekeeping has been processed."}
                </p>
            ) : (
                <>
                    <p className="text-3xl font-bold text-amber-600 tabular-nums">
                        {awaiting.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        employees have timekeeping this cutoff but no payroll
                        record yet
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2 tabular-nums">
                        {withAttendance.toLocaleString()} with attendance in
                        total
                    </p>
                </>
            )}
        </div>
    );
};

// ─── Latest payroll run ──────────────────────────────────────────────────────

const LatestPayroll = ({ latest }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <MdPayments className="text-slate-400" size={16} />
                Latest Payroll Run
            </h3>
            <Link
                to="/dashboard/payroll"
                className="text-[11px] text-slate-400 hover:text-slate-700"
            >
                View all →
            </Link>
        </div>

        {!latest ? (
            <p className="text-sm text-slate-400">No payroll has been run yet.</p>
        ) : (
            <>
                <p className="text-sm font-medium text-slate-800">
                    {fmtDay(latest.from)} – {fmtDay(latest.to)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                    {latest.count.toLocaleString()} employee
                    {latest.count === 1 ? "" : "s"} paid
                </p>

                <div className="mt-4 space-y-1.5">
                    {[
                        ["Gross", latest.gross, "text-slate-700"],
                        ["Deductions", latest.deductions, "text-slate-500"],
                        ["Net", latest.net, "text-slate-900 font-bold"],
                    ].map(([label, value, cls]) => (
                        <div
                            key={label}
                            className="flex items-baseline justify-between gap-3"
                        >
                            <span className="text-[11px] uppercase tracking-widest text-slate-400">
                                {label}
                            </span>
                            <span className={`text-sm tabular-nums ${cls}`}>
                                {fmtPeso(value)}
                            </span>
                        </div>
                    ))}
                </div>
            </>
        )}
    </div>
);

// ─── Stat card ───────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color, sub, to }) => {
    const inner = (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:shadow-sm transition-shadow h-full">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-slate-400 leading-tight">
                        {label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1.5">{value}</p>
                    {sub && <p className="text-[11px] text-slate-400 mt-1 truncate">{sub}</p>}
                </div>
                <div className={`w-9 h-9 sm:w-10 sm:h-10 ${color} rounded-lg flex items-center justify-center shrink-0`}>
                    <Icon className="text-white text-base sm:text-lg" />
                </div>
            </div>
        </div>
    );
    return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
};

// ─── Mini calendar ───────────────────────────────────────────────────────────

const MiniCalendar = ({ holidays }) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const holidayMap = {};
    for (const h of holidays) {
        const key = new Date(h.date).toISOString().slice(0, 10);
        holidayMap[key] = h;
    }

    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = today.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

    const cells = Array(firstDow)
        .fill(null)
        .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

    const DAY_HDRS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const todayD = today.getDate();

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-4">{monthLabel}</h3>
            <div className="grid grid-cols-7 gap-y-1">
                {DAY_HDRS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-slate-400 pb-1">
                        {d}
                    </div>
                ))}
                {cells.map((d, i) => {
                    if (!d) return <div key={`e${i}`} />;
                    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const hol = holidayMap[ds];
                    const isToday = d === todayD;
                    let cls =
                        "mx-auto w-7 h-7 flex items-center justify-center rounded-full text-xs select-none ";
                    if (isToday)
                        cls += "bg-slate-900 text-white font-bold";
                    else if (hol?.specialLegal === HOLIDAY_TYPES.LEGAL)
                        cls += "bg-red-100 text-red-700 font-semibold";
                    else if (hol?.specialLegal === HOLIDAY_TYPES.SPECIAL)
                        cls += "bg-amber-100 text-amber-700 font-semibold";
                    else
                        cls += "text-slate-700";
                    return (
                        <div key={d} title={hol?.eventName ?? ""}>
                            <div className={cls}>{d}</div>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-200" />
                    Legal Holiday
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-200" />
                    Special Holiday
                </span>
            </div>
        </div>
    );
};

// ─── Upcoming holidays ───────────────────────────────────────────────────────

const UpcomingHolidays = ({ holidays }) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = holidays
        .map((h) => ({ ...h, ds: new Date(h.date).toISOString().slice(0, 10) }))
        .filter((h) => h.ds >= todayStr)
        .sort((a, b) => a.ds.localeCompare(b.ds))
        .slice(0, 7);

    const dayDiff = (ds) =>
        Math.round(
            (new Date(`${ds}T00:00:00Z`) - new Date(`${todayStr}T00:00:00Z`)) / 86400000,
        );

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FaCalendarAlt className="text-slate-400" size={13} />
                    Upcoming Holidays
                </h3>
                <Link
                    to="/dashboard/holidays"
                    className="text-[11px] text-slate-400 hover:text-slate-700"
                >
                    View all →
                </Link>
            </div>
            {upcoming.length === 0 ? (
                <p className="text-sm text-slate-400">No upcoming holidays.</p>
            ) : (
                <div className="space-y-3">
                    {upcoming.map((h) => {
                        const isLegal = h.specialLegal === HOLIDAY_TYPES.LEGAL;
                        const d = new Date(`${h.ds}T00:00:00Z`);
                        const diff = dayDiff(h.ds);
                        const diffLabel =
                            diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `In ${diff} days`;
                        return (
                            <div key={h._id} className="flex items-center gap-3">
                                <div
                                    className={`w-10 h-10 rounded-lg shrink-0 flex flex-col items-center justify-center leading-tight text-center ${isLegal ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                                >
                                    <span className="text-[9px] font-bold uppercase">
                                        {d.toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" })}
                                    </span>
                                    <span className="text-base font-bold leading-none">
                                        {d.toLocaleDateString("en-PH", { day: "numeric", timeZone: "UTC" })}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                        {h.eventName}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {diffLabel} ·{" "}
                                        <span className={isLegal ? "text-red-600" : "text-amber-600"}>
                                            {isLegal ? "Legal" : "Special"}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Pending leave applications ──────────────────────────────────────────────

const PendingLeaves = ({ leaves, total }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <MdBeachAccess className="text-slate-400" size={16} />
                Pending Leaves
                {total > 0 && (
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full">
                        {total}
                    </span>
                )}
            </h3>
            <Link
                to="/dashboard/leave"
                className="text-[11px] text-slate-400 hover:text-slate-700"
            >
                View all →
            </Link>
        </div>
        {leaves.length === 0 ? (
            <p className="text-sm text-slate-400">No pending leave applications.</p>
        ) : (
            <div className="space-y-3">
                {leaves.map((leave) => {
                    const emp = leave.employee;
                    const name = emp
                        ? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim()
                        : "—";
                    const initials = name
                        .split(" ")
                        .map((n) => n[0] ?? "")
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                    return (
                        <div key={leave._id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                {initials || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                                <p className="text-[11px] text-slate-400 truncate">
                                    {leave.leaveType?.leaveTypeName ?? "—"} ·{" "}
                                    {leave.dateFrom?.slice(0, 10) ?? "—"} –{" "}
                                    {leave.dateTo?.slice(0, 10) ?? "—"}
                                </p>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 shrink-0">
                                Pending
                            </span>
                        </div>
                    );
                })}
            </div>
        )}
    </div>
);

// ─── Quick nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
    { title: "Attendance", icon: MdAccessTime, color: "bg-blue-500", to: "/dashboard/attendance" },
    { title: "Payslips", icon: MdPayments, color: "bg-green-500", to: "/dashboard/payslips" },
    { title: "Employees", icon: MdPeople, color: "bg-violet-500", to: "/dashboard/employees" },
    { title: "Compensation", icon: FaMoneyBillWave, color: "bg-yellow-500", to: "/dashboard/compensation" },
    { title: "Leave", icon: MdBeachAccess, color: "bg-orange-500", to: "/dashboard/leave" },
    { title: "Loans", icon: FaBriefcase, color: "bg-red-500", to: "/dashboard/loans" },
    { title: "Savings", icon: FaPiggyBank, color: "bg-teal-500", to: "/dashboard/savings" },
    { title: "Departments", icon: FaBuilding, color: "bg-slate-500", to: "/dashboard/departments" },
    { title: "Positions", icon: FaUserTie, color: "bg-indigo-500", to: "/dashboard/positions" },
    { title: "Clients", icon: MdPeople, color: "bg-pink-500", to: "/dashboard/clients" },
    { title: "Holidays", icon: FaCalendarAlt, color: "bg-cyan-500", to: "/dashboard/holidays" },
];

// ─── Main ────────────────────────────────────────────────────────────────────

const Dashboard = () => {
    const { user } = useRouteLoaderData("dashboard");
    const {
        totalEmployees,
        pendingLeaves,
        totalPendingLeaves,
        holidays,
        cutoff,
        latestPayroll,
    } = useLoaderData();

    const today = new Date();
    const holidaysThisMonth = holidays.filter((h) => {
        const d = new Date(h.date);
        return d.getUTCMonth() === today.getMonth() && d.getUTCFullYear() === today.getFullYear();
    }).length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                <p className="text-slate-500 mt-1">
                    Welcome back,{" "}
                    <span className="font-medium text-slate-700">{user?.username}</span>.
                </p>
            </div>

            {/* Cutoff + Stats */}
            {/* Mobile: 2-col grid. Cutoff spans 2 (full row). Stats fill 2 per row.
                lg+: 6-col grid. Cutoff spans 2. 4 stats span 1 each = 6 total. */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="col-span-2 min-h-36 sm:min-h-40">
                    <CutoffCard cutoff={cutoff} />
                </div>
                <StatCard
                    label="Total Employees"
                    value={totalEmployees}
                    icon={MdPeople}
                    color="bg-violet-500"
                    to="/dashboard/employees"
                />
                <StatCard
                    label="Active Employees"
                    value={cutoff?.activeEmployees ?? 0}
                    icon={FaMoneyBillWave}
                    color="bg-yellow-500"
                    to="/dashboard/compensation"
                    sub="With active compensation"
                />
                <StatCard
                    label="Pending Leaves"
                    value={totalPendingLeaves}
                    icon={MdBeachAccess}
                    color="bg-orange-500"
                    to="/dashboard/leave"
                    sub={totalPendingLeaves === 0 ? "All clear" : "Need approval"}
                />
                <StatCard
                    label="Holidays This Month"
                    value={holidaysThisMonth}
                    icon={FaCalendarAlt}
                    color="bg-cyan-500"
                    to="/dashboard/holidays"
                    sub={holidaysThisMonth === 0 ? "No holidays" : "This month"}
                />
            </div>

            {/* Payroll cycle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AwaitingPayroll cutoff={cutoff} />
                <LatestPayroll latest={latestPayroll} />
            </div>

            {/* Calendar + Holidays + Pending Leaves */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MiniCalendar holidays={holidays} />
                <UpcomingHolidays holidays={holidays} />
                <PendingLeaves leaves={pendingLeaves} total={totalPendingLeaves} />
            </div>

            {/* Quick Navigation */}
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                    Quick Navigation
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {NAV_ITEMS.map(({ title, icon: Icon, color, to }) => (
                        <Link
                            key={title}
                            to={to}
                            className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-sm transition-shadow flex flex-col items-center gap-2 text-center group"
                        >
                            <div
                                className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center`}
                            >
                                <Icon className="text-white" size={16} />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900 leading-tight">
                                {title}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
