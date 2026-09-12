import { useState, useEffect, useRef } from "react";
import { redirect, useLoaderData } from "react-router-dom";
import { toast } from "react-toastify";
import { FiTrash2, FiSun, FiMoon, FiRotateCcw, FiX, FiBriefcase } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { computeAttendance } from "@shared/computeAttendance";
import { DAY_TYPES, HOLIDAY_TYPES, LEAVE_WITH_PAY, LEAVE_HALFDAY, EMPLOYMENT_STATUS } from "../../../utils/constants";
import { formatDays, formatRestDays } from "@shared/weeklySchedule";

export const loader = async () => {
    try {
        // The employee combobox below now searches compensations server-side
        // instead of the whole collection being preloaded here.
        const { data: holData } = await customFetch.get(`/holidays?limit=500`);
        return { holidays: holData.holidays || [] };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// ─── shared UI ────────────────────────────────────────────────────────────────

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const cellInputCls =
    "w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 bg-white";
const labelCls = "text-[11px] font-semibold uppercase tracking-widest text-slate-400";

const employeeName = (comp) => {
    const emp = comp?.employeeDesignation?.employee;
    if (!emp) return "—";
    return `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "—";
};

const toDateLabel = (val) =>
    new Date(`${val}T00:00:00Z`).toLocaleDateString("en-PH", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });

// Generates inclusive date strings between from/to, parsed as UTC to avoid
// local-timezone off-by-one shifts when working with plain date inputs.
const generateDateRange = (from, to) => {
    const dates = [];
    let current = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (current > end) return dates;
    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    return dates;
};

const HOLIDAY_DAY_TYPE = {
    [HOLIDAY_TYPES.LEGAL]: DAY_TYPES.LEGAL_HOLIDAY,
    [HOLIDAY_TYPES.SPECIAL]: DAY_TYPES.SPECIAL_HOLIDAY,
};

const leaveDayType = (leave) => {
    if (leave.halfday === LEAVE_HALFDAY.HALF_DAY) return DAY_TYPES.LEAVE_HALFDAY;
    if (leave.withPay === LEAVE_WITH_PAY.WITH_PAY) return DAY_TYPES.LEAVE_WITH_PAY;
    return DAY_TYPES.LEAVE;
};

const blankRow = (date, holidayMap = {}, leaveMap = {}) => {
    const holiday = holidayMap[date];
    const leave = leaveMap[date];
    let dayType = DAY_TYPES.REGULAR;
    let remarks = "";
    if (holiday) {
        dayType = HOLIDAY_DAY_TYPE[holiday.specialLegal] ?? DAY_TYPES.REGULAR;
    } else if (leave) {
        dayType = leaveDayType(leave);
        remarks = leave.leaveType?.leaveTypeName || "Leave";
    }
    return {
        attendanceDate: date,
        existingId: null,
        dayType,
        regularHours: "",
        overtimeHours: "",
        nightPremiumHours: "",
        overtimeNightPremiumHours: "",
        lateHr: "",
        undertimeHr: "",
        remarks,
    };
};

const numberOrUndefined = (val) => (val === "" || val === null || val === undefined ? undefined : Number(val));

// Quick-fill presets for common shift patterns — values are configurable
// from the top of the page and applied per-row via the Shortcut buttons.
// Night hours are the slice of the hours worked that fell after 10pm, not hours
// on top of them: a graveyard shift is 8 regular hours of which 8 were at
// night, not 4 plus 4. Keying it as 4 + 4 pays the employee half a day.
const DEFAULT_PRESETS = {
    day: { regularHours: 8, overtimeHours: 4, nightPremiumHours: 0, overtimeNightPremiumHours: 0 },
    night: { regularHours: 8, overtimeHours: 0, nightPremiumHours: 8, overtimeNightPremiumHours: 0 },
};

const SHORTCUT_PANEL = {
    day: { label: "Day", icon: FiSun, badgeCls: "bg-amber-50 text-amber-700" },
    night: { label: "Night", icon: FiMoon, badgeCls: "bg-indigo-50 text-indigo-700" },
};

const PRESET_FIELDS = [
    { key: "regularHours", label: "Reg" },
    { key: "overtimeHours", label: "OT" },
    { key: "nightPremiumHours", label: "ND" },
    { key: "overtimeNightPremiumHours", label: "OT-ND" },
];

const PRESET_QUICK_CONFIGS = {
    day: [
        { label: "No OT", values: { regularHours: 8, overtimeHours: 0, nightPremiumHours: 0, overtimeNightPremiumHours: 0 } },
        { label: "+OT",   values: { regularHours: 8, overtimeHours: 4, nightPremiumHours: 0, overtimeNightPremiumHours: 0 } },
    ],
    night: [
        { label: "No OT", values: { regularHours: 8, overtimeHours: 0, nightPremiumHours: 8, overtimeNightPremiumHours: 0 } },
        { label: "+OT",   values: { regularHours: 8, overtimeHours: 4, nightPremiumHours: 8, overtimeNightPremiumHours: 4 } },
    ],
};

// Net pay preview for a row — actual pay is always recomputed server-side on save.
const rowTotalPay = (row, dailyRate) => {
    if (!dailyRate) return 0;
    const computed = computeAttendance({
        dailyRate,
        dayType: row.dayType,
        regularHours: Number(row.regularHours) || 0,
        overtimeHours: Number(row.overtimeHours) || 0,
        nightPremiumHours: Number(row.nightPremiumHours) || 0,
        overtimeNightPremiumHours: Number(row.overtimeNightPremiumHours) || 0,
        lateHr: Number(row.lateHr) || 0,
        undertimeHr: Number(row.undertimeHr) || 0,
    });
    return (
        computed.regularHoursPay +
        computed.overtimeHoursPay +
        computed.nightPremiumPay +
        computed.overtimeNightPremiumPay -
        computed.lateDeduction -
        computed.undertimeDeduction
    );
};

// ─── compensation overlay ─────────────────────────────────────────────────────

const fmtMoney = (val) =>
    val != null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const fmtDate = (val) => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d) ? "—" : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const OverlayField = ({ label, value }) => (
    <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm text-slate-800 font-medium">{value || "—"}</p>
    </div>
);

const OverlaySection = ({ title, children }) => (
    <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-1 mb-3">{title}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">{children}</div>
    </div>
);

const CompensationOverlay = ({ comp, onClose }) => {
    const emp = comp?.employeeDesignation?.employee;
    const designation = comp?.employeeDesignation;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
                {/* header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-lg">
                            <FiBriefcase size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-base font-bold text-slate-900 leading-tight">
                                {emp ? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() : "—"}
                            </p>
                            {emp?.employeeCode && (
                                <p className="text-xs text-slate-400 mt-0.5">{emp.employeeCode}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* body */}
                <div className="px-6 py-5 flex flex-col gap-7">
                    <OverlaySection title="Organization">
                        <OverlayField label="Client" value={designation?.client?.clientName} />
                        <OverlayField label="Department" value={designation?.department?.departmentName} />
                        <OverlayField label="Position" value={designation?.position?.positionName} />
                    </OverlaySection>

                    <OverlaySection title="Employment">
                        <OverlayField label="Employment Type" value={comp.employmentType} />
                        <OverlayField label="Contract Type" value={comp.contractType} />
                        <OverlayField label="Payroll Period" value={comp.payrollPeriod} />
                        <OverlayField label="Active Status" value={comp.activeStatus} />
                        <OverlayField label="Start Contract" value={fmtDate(comp.startContract)} />
                        <OverlayField label="End Contract" value={fmtDate(comp.endContract)} />
                        <OverlayField label="Date of Regularization" value={fmtDate(comp.dateOfRegularization)} />
                    </OverlaySection>

                    <OverlaySection title="Rates">
                        <OverlayField label="Monthly Rate" value={fmtMoney(comp.monthlyRate)} />
                        <OverlayField label="Daily Rate" value={fmtMoney(comp.dailyRate)} />
                    </OverlaySection>

                    <OverlaySection title="Schedule">
                        <OverlayField label="Weekly Schedule" value={formatDays(comp.weeklySchedule)} />
                        <OverlayField label="Rest Days" value={formatRestDays(comp.weeklySchedule)} />
                        <OverlayField label="Time In" value={comp.timeIn} />
                        <OverlayField label="Time Out" value={comp.timeOut} />
                        <OverlayField label="Night Shift In" value={comp.nightShiftTimeIn} />
                        <OverlayField label="Night Shift Out" value={comp.nightShiftTimeOut} />
                    </OverlaySection>

                    <OverlaySection title="Government Contributions">
                        <OverlayField label="SSS Basis" value={comp.sssContributionBasis} />
                        <OverlayField label="SSS Overwrite" value={comp.sssOverwriteAmount != null ? fmtMoney(comp.sssOverwriteAmount) : "—"} />
                        <OverlayField label="PhilHealth Basis" value={comp.philhealthContributionBasis} />
                        <OverlayField label="PhilHealth Overwrite" value={comp.philhealthOverwriteAmount != null ? fmtMoney(comp.philhealthOverwriteAmount) : "—"} />
                        <OverlayField label="Pag-IBIG Basis" value={comp.pagibigContributionBasis} />
                        <OverlayField label="Pag-IBIG Overwrite" value={comp.pagibigOverwriteAmount != null ? fmtMoney(comp.pagibigOverwriteAmount) : "—"} />
                    </OverlaySection>

                    {(comp.insuranceName || comp.dateInsured || comp.insuredUntil) && (
                        <OverlaySection title="Insurance">
                            <OverlayField label="Insurance Name" value={comp.insuranceName} />
                            <OverlayField label="Date Insured" value={fmtDate(comp.dateInsured)} />
                            <OverlayField label="Insured Until" value={fmtDate(comp.insuredUntil)} />
                        </OverlaySection>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── employee searchable combobox ─────────────────────────────────────────────

// Searches compensations server-side (`/compensations?search=`) instead of
// filtering a preloaded list — with 2000+ compensations (each with a deep
// employee/client/department/position populate), loading them all up front
// made this page slow to load. Selecting a result hands back the full
// compensation object (the caller needs dailyRate, employeeDesignation, etc.,
// not just the id).
const EmployeeCombobox = ({ value, onChange }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const { data } = await customFetch.get("/compensations", {
                    params: {
                        search: query,
                        limit: 20,
                        employeeStatus: EMPLOYMENT_STATUS.ACTIVE,
                    },
                });
                if (!cancelled) setResults(data.compensations || []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, open]);

    const handleSelect = (comp) => {
        setSelected(comp);
        onChange(comp);
        setQuery("");
        setOpen(false);
    };

    const handleClear = () => {
        setSelected(null);
        onChange(null);
        setQuery("");
    };

    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const displayValue = open ? query : (selected ? employeeName(selected) : "");

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search employee…"
                    className={`${inputCls} pr-8`}
                    autoComplete="off"
                />
                {selected && !open && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Clear"
                    >
                        <FiX size={14} />
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loading ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">Searching…</p>
                    ) : results.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">No employees found.</p>
                    ) : (
                        results.map((c) => {
                            const code = c.employeeDesignation?.employee?.employeeCode;
                            return (
                                <button
                                    key={c._id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelect(c)}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 ${value === c._id ? "bg-slate-50 font-semibold" : ""}`}
                                >
                                    <span className="text-slate-800 truncate">{employeeName(c)}</span>
                                    {code && <span className="text-slate-400 text-xs shrink-0">{code}</span>}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

// ─── pre-submit summary confirmation ────────────────────────────────────────

const StatTile = ({ label, value }) => (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-semibold text-slate-800">{value}</p>
    </div>
);

const SummaryModal = ({ rows, dailyRate, dateFrom, dateTo, onCancel, onConfirm, saving }) => {
    const sum = (field) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
    const totals = {
        regularHours: sum("regularHours"),
        overtimeHours: sum("overtimeHours"),
        nightPremiumHours: sum("nightPremiumHours"),
        overtimeNightPremiumHours: sum("overtimeNightPremiumHours"),
        lateHr: sum("lateHr"),
        undertimeHr: sum("undertimeHr"),
    };
    const totalHours =
        totals.regularHours + totals.overtimeHours + totals.nightPremiumHours + totals.overtimeNightPremiumHours;
    const totalPay = rows.reduce((s, r) => s + rowTotalPay(r, dailyRate), 0);
    const newCount = rows.filter((r) => !r.existingId).length;
    const updateCount = rows.filter((r) => r.existingId).length;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
                    <div>
                        <p className="text-base font-bold text-slate-900">Confirm Attendance Submission</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {toDateLabel(dateFrom)} – {toDateLabel(dateTo)}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-5">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-600">
                            {rows.length} row{rows.length !== 1 ? "s" : ""} total
                        </span>
                        {newCount > 0 && (
                            <span className="text-green-600 font-medium">{newCount} new</span>
                        )}
                        {updateCount > 0 && (
                            <span className="text-amber-600 font-medium">
                                {updateCount} update{updateCount !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>

                    {/* Per-day breakdown */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="max-h-64 overflow-y-auto overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-900 text-white uppercase tracking-wider sticky top-0">
                                        <th className="px-3 py-2 text-left">Date</th>
                                        <th className="px-3 py-2 text-left">Day Type</th>
                                        <th className="px-3 py-2 text-right">Reg</th>
                                        <th className="px-3 py-2 text-right">OT</th>
                                        <th className="px-3 py-2 text-right">ND</th>
                                        <th className="px-3 py-2 text-right">OT-ND</th>
                                        <th className="px-3 py-2 text-right">Late</th>
                                        <th className="px-3 py-2 text-right">UT</th>
                                        <th className="px-3 py-2 text-right">Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row) => (
                                        <tr key={row.attendanceDate} className="hover:bg-slate-50">
                                            <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    {toDateLabel(row.attendanceDate)}
                                                    {row.existingId && (
                                                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-50 text-amber-700 leading-tight">
                                                            Upd
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{row.dayType}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{(Number(row.regularHours) || 0).toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{(Number(row.overtimeHours) || 0).toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{(Number(row.nightPremiumHours) || 0).toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{(Number(row.overtimeNightPremiumHours) || 0).toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{(Number(row.lateHr) || 0).toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{(Number(row.undertimeHr) || 0).toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right font-medium text-slate-800">
                                                ₱{rowTotalPay(row, dailyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        <StatTile label="Reg Hrs" value={totals.regularHours.toFixed(2)} />
                        <StatTile label="OT Hrs" value={totals.overtimeHours.toFixed(2)} />
                        <StatTile label="Night Prem" value={totals.nightPremiumHours.toFixed(2)} />
                        <StatTile label="OT Night" value={totals.overtimeNightPremiumHours.toFixed(2)} />
                        <StatTile label="Late" value={totals.lateHr.toFixed(2)} />
                        <StatTile label="Undertime" value={totals.undertimeHr.toFixed(2)} />
                        <StatTile label="Work Hours" value={(totals.regularHours / 8).toFixed(2)} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-900 text-white px-4 py-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-300">Total Hours</p>
                            <p className="text-lg font-semibold">{totalHours.toFixed(2)}h</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-slate-300">Total Pay</p>
                            <p className="text-lg font-semibold">
                                ₱{totalPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                    >
                        {saving ? "Submitting..." : "Confirm & Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── rows editor (keyed by date range so it remounts fresh on change) ──────────

const toRecord = (r) => ({
    attendanceDate: r.attendanceDate,
    dayType: r.dayType || undefined,
    regularHours: numberOrUndefined(r.regularHours),
    overtimeHours: numberOrUndefined(r.overtimeHours),
    nightPremiumHours: numberOrUndefined(r.nightPremiumHours),
    overtimeNightPremiumHours: numberOrUndefined(r.overtimeNightPremiumHours),
    lateHr: numberOrUndefined(r.lateHr),
    undertimeHr: numberOrUndefined(r.undertimeHr),
    remarks: r.remarks || undefined,
});

const RowsEditor = ({ dateFrom, dateTo, compensation, dailyRate, presets, holidayMap, leaveMap }) => {
    const [rows, setRows] = useState(() =>
        generateDateRange(dateFrom, dateTo).map((d) => blankRow(d, holidayMap, leaveMap)),
    );
    const [saving, setSaving] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // On mount, fetch existing attendance records for this range and pre-fill matching rows.
    useEffect(() => {
        if (!compensation) return;
        customFetch
            .get(`/attendances?compensation=${compensation}&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=500`)
            .then(({ data }) => {
                const map = {};
                for (const att of data.attendances || []) {
                    const key = new Date(att.attendanceDate).toISOString().slice(0, 10);
                    map[key] = att;
                }
                setRows((prev) =>
                    prev.map((row) => {
                        const existing = map[row.attendanceDate];
                        if (!existing) return row;
                        return {
                            ...row,
                            existingId: existing._id,
                            dayType: existing.dayType || row.dayType,
                            regularHours: existing.regularHours ?? "",
                            overtimeHours: existing.overtimeHours ?? "",
                            nightPremiumHours: existing.nightPremiumHours ?? "",
                            overtimeNightPremiumHours: existing.overtimeNightPremiumHours ?? "",
                            lateHr: existing.lateHr ?? "",
                            undertimeHr: existing.undertimeHr ?? "",
                            remarks: existing.remarks || row.remarks,
                        };
                    }),
                );
            })
            .catch(() => {});
    }, []);

    const updateRow = (index, field, value) => {
        setRows((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
        );
    };

    const removeRow = (index) => {
        setRows((prev) => prev.filter((_, i) => i !== index));
    };

    const applyShortcut = (index, key) => {
        setRows((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...presets[key] } : r)),
        );
    };

    const resetRow = (index) => {
        setRows((prev) =>
            prev.map((r, i) => {
                if (i !== index) return r;
                return { ...blankRow(r.attendanceDate, holidayMap, leaveMap), existingId: r.existingId };
            }),
        );
    };


    const handleSubmit = async () => {
        if (!compensation) { toast.error("Select an employee"); return; }
        if (rows.length === 0) { toast.error("No rows to submit"); return; }

        setSaving(true);
        setShowSummary(false);
        try {
            const newRows = rows.filter((r) => !r.existingId);
            const existingRows = rows.filter((r) => r.existingId);

            let createdCount = 0;
            let updatedCount = 0;

            if (newRows.length > 0) {
                const { data } = await customFetch.post("/attendances/bulk", {
                    compensation,
                    records: newRows.map(toRecord),
                });
                createdCount = data.createdCount;
            }

            if (existingRows.length > 0) {
                await Promise.all(
                    existingRows.map((r) =>
                        customFetch.patch(`/attendances/${r.existingId}`, toRecord(r)),
                    ),
                );
                updatedCount = existingRows.length;
            }

            const parts = [];
            if (createdCount > 0) parts.push(`Created ${createdCount}`);
            if (updatedCount > 0) parts.push(`Updated ${updatedCount}`);
            toast.success(parts.join(", ") + " record(s)");
            setRows([]);
        } catch (error) {
            toast.error(
                error?.response?.data?.msg || error?.response?.data?.message || error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    if (rows.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                All rows submitted or removed.
            </div>
        );
    }

    const hourFields = [
        { field: "regularHours", label: "Reg Hrs" },
        { field: "overtimeHours", label: "OT Reg" },
        { field: "nightPremiumHours", label: "Night Prem" },
        { field: "overtimeNightPremiumHours", label: "OT Night" },
        { field: "lateHr", label: "Late" },
        { field: "undertimeHr", label: "Undertime" },
    ];

    return (
        <>
            <div className="bg-white rounded-xl border border-slate-200">
                {/* Mobile card view */}
                <div className="sm:hidden divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                        <div key={row.attendanceDate} className="p-4">
                            {/* Date + delete */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-medium text-slate-800">{toDateLabel(row.attendanceDate)}</p>
                                        {row.existingId && (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 leading-tight">Existing</span>
                                        )}
                                    </div>
                                    {holidayMap[row.attendanceDate] && (
                                        <span className={`inline-block text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded leading-tight ${
                                            holidayMap[row.attendanceDate].specialLegal === HOLIDAY_TYPES.LEGAL
                                                ? "bg-red-100 text-red-700"
                                                : "bg-amber-100 text-amber-700"
                                        }`}>
                                            {holidayMap[row.attendanceDate].eventName}
                                        </span>
                                    )}
                                    {leaveMap[row.attendanceDate] && (
                                        <span className="inline-block text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded leading-tight bg-blue-100 text-blue-700">
                                            {leaveMap[row.attendanceDate].leaveType?.leaveTypeName || "Leave"}
                                            {leaveMap[row.attendanceDate].halfday === LEAVE_HALFDAY.HALF_DAY ? " (half)" : ""}
                                            {leaveMap[row.attendanceDate].withPay === LEAVE_WITH_PAY.WITH_PAY ? " · w/ pay" : ""}
                                        </span>
                                    )}
                                </div>
                                <button type="button" onClick={() => removeRow(idx)}
                                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0">
                                    <FiTrash2 size={14} />
                                </button>
                            </div>

                            {/* Shortcuts */}
                            <div className="flex items-center gap-2 mb-3">
                                {Object.entries(SHORTCUT_PANEL).map(([key, { label, icon: Icon, badgeCls }]) => (
                                    <button key={key} type="button" onClick={() => applyShortcut(idx, key)}
                                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium ${badgeCls} hover:opacity-80`}>
                                        <Icon size={12} /> {label}
                                    </button>
                                ))}
                                <button type="button" onClick={() => resetRow(idx)} title="Clear row"
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 ml-auto">
                                    <FiRotateCcw size={13} />
                                </button>
                            </div>

                            {/* Day Type */}
                            <div className="mb-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Day Type</p>
                                {/* A holiday only pre-fills the day type now; it stays
                                    editable so an employee who actually worked the
                                    holiday differently can be corrected here. Leave
                                    still comes from the approved application. */}
                                {leaveMap[row.attendanceDate] ? (
                                    <div className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                                        title="Change day type on the Leave Applications page">
                                        {row.dayType}
                                    </div>
                                ) : (
                                    <select value={row.dayType} onChange={(e) => updateRow(idx, "dayType", e.target.value)} className={cellInputCls}>
                                        {Object.values(DAY_TYPES).map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                                    </select>
                                )}
                            </div>

                            {/* Hours 3×2 grid */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {hourFields.map(({ field, label }) => (
                                    <div key={field}>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                                        <input type="number" min={0} step="any" value={row[field]}
                                            onChange={(e) => updateRow(idx, field, e.target.value)}
                                            className={`${cellInputCls} text-right`} />
                                    </div>
                                ))}
                            </div>

                            {/* Total pay */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <span className="text-xs text-slate-400">Total Pay</span>
                                <span className="font-semibold text-slate-800">
                                    ₱{rowTotalPay(row, dailyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                                <th className="px-3 py-3 text-left">Date</th>
                                <th className="px-3 py-3 text-left min-w-32">Shortcut</th>
                                <th className="px-3 py-3 text-left min-w-45">Day Type</th>
                                <th className="px-3 py-3 text-right min-w-22.5">Reg Hrs</th>
                                <th className="px-3 py-3 text-right min-w-22.5">OT Reg</th>
                                <th className="px-3 py-3 text-right min-w-22.5">Night Prem</th>
                                <th className="px-3 py-3 text-right min-w-22.5">OT Night Prem</th>
                                <th className="px-3 py-3 text-right min-w-20">Late</th>
                                <th className="px-3 py-3 text-right min-w-20">Undertime</th>
                                <th className="px-3 py-3 text-right min-w-22.5">Total Pay</th>
                                <th className="px-3 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row, idx) => (
                                <tr key={row.attendanceDate} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-700">{toDateLabel(row.attendanceDate)}</span>
                                            {row.existingId && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 leading-tight">Existing</span>
                                            )}
                                        </div>
                                        {holidayMap[row.attendanceDate] && (
                                            <span className={`block text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded leading-tight w-fit ${
                                                holidayMap[row.attendanceDate].specialLegal === HOLIDAY_TYPES.LEGAL
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-amber-100 text-amber-700"
                                            }`}>
                                                {holidayMap[row.attendanceDate].eventName}
                                            </span>
                                        )}
                                        {leaveMap[row.attendanceDate] && (
                                            <span className="block text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded leading-tight w-fit bg-blue-100 text-blue-700">
                                                {leaveMap[row.attendanceDate].leaveType?.leaveTypeName || "Leave"}
                                                {leaveMap[row.attendanceDate].halfday === LEAVE_HALFDAY.HALF_DAY ? " (half day)" : ""}
                                                {leaveMap[row.attendanceDate].withPay === LEAVE_WITH_PAY.WITH_PAY ? " · w/ pay" : ""}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            {Object.entries(SHORTCUT_PANEL).map(([key, { label, icon: Icon }]) => (
                                                <button key={key} type="button" onClick={() => applyShortcut(idx, key)}
                                                    title={`Apply ${label} shift preset`}
                                                    className="p-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                    <Icon size={14} />
                                                </button>
                                            ))}
                                            <button type="button" onClick={() => resetRow(idx)} title="Clear this row"
                                                className="p-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                <FiRotateCcw size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {leaveMap[row.attendanceDate] ? (
                                            <div className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                                                title="Change day type on the Leave Applications page">
                                                {row.dayType}
                                            </div>
                                        ) : (
                                            <select value={row.dayType} onChange={(e) => updateRow(idx, "dayType", e.target.value)} className={cellInputCls}>
                                                {Object.values(DAY_TYPES).map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                                            </select>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min={0} step="any" value={row.regularHours}
                                            onChange={(e) => updateRow(idx, "regularHours", e.target.value)}
                                            className={`${cellInputCls} text-right`} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min={0} step="any" value={row.overtimeHours}
                                            onChange={(e) => updateRow(idx, "overtimeHours", e.target.value)}
                                            className={`${cellInputCls} text-right`} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min={0} step="any" value={row.nightPremiumHours}
                                            onChange={(e) => updateRow(idx, "nightPremiumHours", e.target.value)}
                                            className={`${cellInputCls} text-right`} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min={0} step="any" value={row.overtimeNightPremiumHours}
                                            onChange={(e) => updateRow(idx, "overtimeNightPremiumHours", e.target.value)}
                                            className={`${cellInputCls} text-right`} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min={0} step="any" value={row.lateHr}
                                            onChange={(e) => updateRow(idx, "lateHr", e.target.value)}
                                            className={`${cellInputCls} text-right`} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min={0} step="any" value={row.undertimeHr}
                                            onChange={(e) => updateRow(idx, "undertimeHr", e.target.value)}
                                            className={`${cellInputCls} text-right`} />
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-slate-700">
                                        ₱{rowTotalPay(row, dailyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2">
                                        <button type="button" onClick={() => removeRow(idx)}
                                            className="text-red-400 hover:text-red-600" title="Remove this date">
                                            <FiTrash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-800 text-white text-xs font-semibold border-t-2 border-slate-600">
                                <td colSpan={3} className="px-3 py-2 uppercase tracking-wider text-slate-300">
                                    Totals
                                    <span className="block text-[9px] font-normal normal-case text-slate-400 mt-0.5">
                                        Work Hrs: {(rows.reduce((s, r) => s + (Number(r.regularHours) || 0), 0) / 8).toFixed(2)}
                                    </span>
                                </td>
                                {[
                                    ["Reg Hrs",      rows.reduce((s, r) => s + (Number(r.regularHours) || 0), 0).toFixed(4)],
                                    ["OT Reg",       rows.reduce((s, r) => s + (Number(r.overtimeHours) || 0), 0).toFixed(4)],
                                    ["Night Prem",   rows.reduce((s, r) => s + (Number(r.nightPremiumHours) || 0), 0).toFixed(4)],
                                    ["OT Night",     rows.reduce((s, r) => s + (Number(r.overtimeNightPremiumHours) || 0), 0).toFixed(4)],
                                    ["Late",         rows.reduce((s, r) => s + (Number(r.lateHr) || 0), 0).toFixed(4)],
                                    ["Undertime",    rows.reduce((s, r) => s + (Number(r.undertimeHr) || 0), 0).toFixed(4)],
                                    ["Total Pay",    `₱${rows.reduce((s, r) => s + rowTotalPay(r, dailyRate), 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
                                ].map(([label, value]) => (
                                    <td key={label} className="px-3 py-2 text-center tabular-nums">
                                        <span className="block text-[9px] font-normal text-slate-400 mb-0.5">{label}</span>
                                        {value}
                                    </td>
                                ))}
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <p className="text-sm text-slate-600">
                    Work Hours:{" "}
                    <span className="font-semibold text-slate-900">
                        {(rows.reduce((sum, row) => sum + (Number(row.regularHours) || 0), 0) / 8).toFixed(2)}
                    </span>
                </p>
                <p className="text-sm text-slate-600">
                    Total Pay:{" "}
                    <span className="font-semibold text-slate-900">
                        ₱{rows.reduce((sum, row) => sum + rowTotalPay(row, dailyRate), 0)
                            .toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                </p>
                <button
                    onClick={() => {
                        if (!compensation) { toast.error("Select an employee"); return; }
                        if (rows.length === 0) { toast.error("No rows to submit"); return; }
                        setShowSummary(true);
                    }}
                    disabled={saving}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                >
                    {saving ? "Saving..." : (() => {
                        const nc = rows.filter((r) => !r.existingId).length;
                        const uc = rows.filter((r) => r.existingId).length;
                        if (nc > 0 && uc > 0) return `Submit ${nc} New + ${uc} Update(s)`;
                        if (uc > 0) return `Update ${uc} Record(s)`;
                        return `Submit ${nc} Record(s)`;
                    })()}
                </button>
            </div>

            {showSummary && (
                <SummaryModal
                    rows={rows}
                    dailyRate={dailyRate}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onCancel={() => setShowSummary(false)}
                    onConfirm={handleSubmit}
                    saving={saving}
                />
            )}
        </>
    );
};

// ─── main page ───────────────────────────────────────────────────────────────

const BulkAttendance = () => {
    const { holidays } = useLoaderData();

    const holidayMap = Object.fromEntries(
        holidays.map((h) => [new Date(h.date).toISOString().slice(0, 10), h]),
    );

    const [selectedComp, setSelectedComp] = useState(null);
    const compensation = selectedComp?._id ?? "";
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [presets, setPresets] = useState(DEFAULT_PRESETS);
    const [leaveMap, setLeaveMap] = useState({});
    const [showCompOverlay, setShowCompOverlay] = useState(false);

    const selectEmployee = (comp) => setSelectedComp(comp);

    useEffect(() => {
        const empId = selectedComp?.employeeDesignation?.employee?._id;
        if (!empId) { setLeaveMap({}); return; }
        let cancelled = false;
        customFetch
            .get(`/leave-applications?employee=${empId}&status=approved&limit=500`)
            .then(({ data }) => {
                if (cancelled) return;
                const map = {};
                for (const leave of data.leaveApplications || []) {
                    let cur = new Date(`${leave.dateFrom.slice(0, 10)}T00:00:00Z`);
                    const end = new Date(`${leave.dateTo.slice(0, 10)}T00:00:00Z`);
                    while (cur <= end) {
                        const key = cur.toISOString().slice(0, 10);
                        map[key] = leave;
                        cur = new Date(cur.getTime() + 86400000);
                    }
                }
                setLeaveMap(map);
            })
            .catch(() => { if (!cancelled) setLeaveMap({}); });
        return () => { cancelled = true; };
    }, [selectedComp]);

    const updatePreset = (shift, field, value) => {
        setPresets((prev) => ({
            ...prev,
            [shift]: { ...prev[shift], [field]: value === "" ? 0 : Number(value) },
        }));
    };

    const applyPresetConfig = (shift, values) => {
        setPresets((prev) => ({ ...prev, [shift]: { ...prev[shift], ...values } }));
    };

    const handleDateFromChange = (e) => {
        const val = e.target.value;
        setDateFrom(val);
        if (!val) return;
        const d = new Date(`${val}T00:00:00Z`);
        const day = d.getUTCDate();
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        if (day === 1) {
            setDateTo(new Date(Date.UTC(year, month, 15)).toISOString().slice(0, 10));
        } else if (day === 16) {
            // last day of the month: day 0 of the next month
            setDateTo(new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10));
        }
    };

    const hasRange = Boolean(dateFrom && dateTo);
    const dailyRate = selectedComp?.dailyRate;

    return (
        <>
        {showCompOverlay && selectedComp && (
            <CompensationOverlay comp={selectedComp} onClose={() => setShowCompOverlay(false)} />
        )}
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Bulk Add Attendance</h1>
                <p className="text-slate-500 mt-1">
                    Select an employee and a date range to generate one row per date.
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                <div className="flex flex-col gap-1 w-full sm:min-w-55 sm:w-auto">
                    <label className={labelCls}>Employee</label>
                    <div className="flex items-center gap-2">
                        <EmployeeCombobox
                            value={compensation}
                            onChange={selectEmployee}
                        />
                        {selectedComp && (
                            <button
                                type="button"
                                onClick={() => setShowCompOverlay(true)}
                                title="View compensation details"
                                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm hover:bg-slate-100 hover:border-slate-300"
                            >
                                <FiBriefcase size={14} />
                                <span className="hidden sm:inline">Compensation</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:contents">
                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={handleDateFromChange}
                            className={inputCls}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>
            </div>

            {/* Shortcut presets */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-5 gap-y-3">
                {Object.entries(SHORTCUT_PANEL).map(([shift, { label, icon: Icon, badgeCls }], i) => (
                    <div key={shift} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                        {i > 0 && <span className="hidden sm:block w-px h-5 bg-slate-200 mr-3" />}
                        <div className="flex items-center gap-1.5">
                            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badgeCls}`}>
                                <Icon size={12} />
                                {label}
                            </span>
                            {PRESET_QUICK_CONFIGS[shift]?.map(({ label: qLabel, values }) => {
                                const active = Object.entries(values).every(([k, v]) => presets[shift][k] === v);
                                return (
                                    <button key={qLabel} type="button"
                                        onClick={() => applyPresetConfig(shift, values)}
                                        className={`text-[10px] px-1.5 py-0.5 rounded border leading-tight font-medium transition-colors ${
                                            active
                                                ? badgeCls + " border-transparent"
                                                : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        }`}>
                                        {qLabel}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="grid grid-cols-4 gap-2 sm:contents">
                            {PRESET_FIELDS.map(({ key, label: fieldLabel }) => (
                                <label key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 text-xs text-slate-500">
                                    <span>{fieldLabel}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={presets[shift][key]}
                                        onChange={(e) => updatePreset(shift, key, e.target.value)}
                                        className="w-full sm:w-12 border border-slate-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Generated rows */}
            {hasRange ? (
                <RowsEditor
                    key={`${compensation}_${dateFrom}_${dateTo}`}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    compensation={compensation}
                    dailyRate={dailyRate}
                    presets={presets}
                    holidayMap={holidayMap}
                    leaveMap={leaveMap}
                />
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                    Select both From and To dates to generate attendance rows.
                </div>
            )}
        </div>
        </>
    );
};
export default BulkAttendance;
