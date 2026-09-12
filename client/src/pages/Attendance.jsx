import { useState, useEffect } from "react";
import {
    redirect,
    useLoaderData,
    useSearchParams,
    useRevalidator,
} from "react-router-dom";
import { toast } from "react-toastify";
import {
    FiEdit2,
    FiTrash2,
    FiChevronUp,
    FiChevronDown,
    FiSun,
    FiMoon,
} from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { Overlay, InfoField, useConfirm, Pagination } from "../components";
import { DAY_TYPES, HOLIDAY_TYPES } from "../../../utils/constants";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || "1";
        const search = url.searchParams.get("search") || "";
        const dateFrom = url.searchParams.get("dateFrom") || "";
        const dateTo = url.searchParams.get("dateTo") || "";
        const client = url.searchParams.get("client") || "";
        const sort = url.searchParams.get("sort") || "desc";

        const params = new URLSearchParams({ page });
        params.set("limit", "20");
        if (search) params.set("search", search);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (client) params.set("client", client);
        params.set("sort", sort);

        // The employee combobox in the Add modal now searches compensations
        // server-side instead of the whole collection being preloaded here.
        const [{ data }, { data: holData }, { data: cliData }] =
            await Promise.all([
                customFetch.get(`/attendances?${params}`),
                customFetch.get(`/holidays?limit=500`),
                customFetch.get(`/clients?limit=500`),
            ]);

        return {
            ...data,
            holidays: holData.holidays || [],
            clients: cliData.clients || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// ─── shared UI ────────────────────────────────────────────────────────────────

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls =
    "text-[11px] font-semibold uppercase tracking-widest text-slate-400";

// Semi-monthly cutoff auto-fill: picking the 1st fills "To" with the 15th,
// picking the 16th fills "To" with the last day of the month. Any other
// day is left alone since it isn't the start of a standard cutoff.
const cutoffDateTo = (fromVal) => {
    if (!fromVal) return null;
    const d = new Date(`${fromVal}T00:00:00Z`);
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    if (day === 1)
        return new Date(Date.UTC(year, month, 15)).toISOString().slice(0, 10);
    if (day === 16)
        return new Date(Date.UTC(year, month + 1, 0))
            .toISOString()
            .slice(0, 10);
    return null;
};

const Field = ({ label, children }) => (
    <div className="flex flex-col gap-1.5">
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

const SHORTCUT_CONFIGS = [
    {
        label: "Day No OT",
        icon: FiSun,
        cls: "bg-amber-50 text-amber-700",
        values: {
            regularHours: 8,
            overtimeHours: 0,
            nightPremiumHours: 0,
            overtimeNightPremiumHours: 0,
        },
    },
    {
        label: "Day +OT",
        icon: FiSun,
        cls: "bg-amber-50 text-amber-700",
        values: {
            regularHours: 8,
            overtimeHours: 4,
            nightPremiumHours: 0,
            overtimeNightPremiumHours: 0,
        },
    },
    {
        label: "Night No OT",
        icon: FiMoon,
        cls: "bg-indigo-50 text-indigo-700",
        values: {
            regularHours: 4,
            overtimeHours: 0,
            nightPremiumHours: 4,
            overtimeNightPremiumHours: 0,
        },
    },
    {
        label: "Night +OT",
        icon: FiMoon,
        cls: "bg-indigo-50 text-indigo-700",
        values: {
            regularHours: 4,
            overtimeHours: 0,
            nightPremiumHours: 4,
            overtimeNightPremiumHours: 4,
        },
    },
];

// Searches compensations server-side (`/compensations?search=`) instead of
// filtering a preloaded list — with 2000+ compensations (each with a deep
const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const num = (val) => (val !== undefined && val !== null ? val : "—");

const totalPay = (att) =>
    (att.regularHoursPay || 0) +
    (att.overtimeHoursPay || 0) +
    (att.nightPremiumPay || 0) +
    (att.overtimeNightPremiumPay || 0) -
    (att.lateDeduction || 0) -
    (att.undertimeDeduction || 0);

const employeeName = (comp) => {
    const emp = comp?.employeeDesignation?.employee;
    if (!emp) return "—";
    return `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "—";
};

const toDate = (val) => (val ? new Date(val).toLocaleDateString("en-PH") : "—");
const toInputDate = (val) => (val ? val.slice(0, 10) : "");

// ─── add / edit modal ───────────────────────────────────────────────────────────

const HOLIDAY_DAY_TYPE = {
    [HOLIDAY_TYPES.LEGAL]: DAY_TYPES.LEGAL_HOLIDAY,
    [HOLIDAY_TYPES.SPECIAL]: DAY_TYPES.SPECIAL_HOLIDAY,
};

const AttendanceModal = ({ modal, holidayMap, onClose, onSaved }) => {
    const att = modal?.attendance;
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(() => ({
        compensation: att?.compensation?._id ?? att?.compensation ?? "",
        attendanceDate: toInputDate(att?.attendanceDate),
        dayType: att?.dayType ?? "",
        timeIn: att?.timeIn ?? "",
        timeOut: att?.timeOut ?? "",
        regularHours: att?.regularHours ?? "",
        overtimeHours: att?.overtimeHours ?? "",
        nightPremiumHours: att?.nightPremiumHours ?? "",
        overtimeNightPremiumHours: att?.overtimeNightPremiumHours ?? "",
        lateHr: att?.lateHr ?? "",
        undertimeHr: att?.undertimeHr ?? "",
        remarks: att?.remarks ?? "",
    }));

    if (!modal) return null;

    const numberFields = [
        "regularHours",
        "overtimeHours",
        "nightPremiumHours",
        "overtimeNightPremiumHours",
        "lateHr",
        "undertimeHr",
    ];
    const setField = (field, value) =>
        setForm((prev) => ({ ...prev, [field]: value }));
    const applyShortcut = (values) =>
        setForm((prev) => ({ ...prev, ...values }));

    const handleDateChange = (val) => {
        const holiday = holidayMap?.[val];
        setForm((prev) => ({
            ...prev,
            attendanceDate: val,
            dayType: holiday
                ? (HOLIDAY_DAY_TYPE[holiday.specialLegal] ?? prev.dayType)
                : prev.dayType,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = {};
            for (const [key, value] of Object.entries(form)) {
                if (value === "" || value === null || value === undefined)
                    continue;
                // Neither can be corrected on an existing record: the
                // pair is the unique key the attendance is stored under.
                if (key === "compensation" || key === "attendanceDate")
                    continue;
                body[key] = numberFields.includes(key) ? Number(value) : value;
            }

            await customFetch.patch(`/attendances/${att._id}`, body);
            toast.success("Attendance updated");
            onSaved();
        } catch (error) {
            toast.error(
                error?.response?.data?.msg ||
                    error?.response?.data?.message ||
                    error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Overlay isOpen={true} onClose={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                    Edit Attendance
                </h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field label="Employee / Compensation">
                        <input
                            type="text"
                            value={employeeName(att?.compensation)}
                            disabled
                            className={`${inputCls} bg-slate-100 text-slate-400`}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Attendance Date">
                            <input
                                type="date"
                                value={form.attendanceDate}
                                onChange={(e) =>
                                    handleDateChange(e.target.value)
                                }
                                disabled
                                required
                                className={`${inputCls} bg-slate-100 text-slate-400`}
                            />
                        </Field>
                        <Field label="Day Type">
                            <select
                                value={form.dayType}
                                onChange={(e) =>
                                    setField("dayType", e.target.value)
                                }
                                className={inputCls}
                            >
                                <option value="">— Select —</option>
                                {Object.values(DAY_TYPES).map((dt) => (
                                    <option key={dt} value={dt}>
                                        {dt}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Time In (optional)">
                            <input
                                type="text"
                                placeholder="e.g. 08:00"
                                maxLength={5}
                                value={form.timeIn}
                                onChange={(e) =>
                                    setField("timeIn", e.target.value)
                                }
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Time Out (optional)">
                            <input
                                type="text"
                                placeholder="e.g. 17:00"
                                maxLength={5}
                                value={form.timeOut}
                                onChange={(e) =>
                                    setField("timeOut", e.target.value)
                                }
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <div>
                        <p className={`${labelCls} mb-1.5`}>Quick Fill</p>
                        <div className="flex flex-wrap gap-1.5">
                            {SHORTCUT_CONFIGS.map(
                                ({ label, icon: Icon, cls, values }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => applyShortcut(values)}
                                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium ${cls} hover:opacity-80`}
                                    >
                                        <Icon size={11} /> {label}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Regular Hours">
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.regularHours}
                                onChange={(e) =>
                                    setField("regularHours", e.target.value)
                                }
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Overtime Hours">
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.overtimeHours}
                                onChange={(e) =>
                                    setField("overtimeHours", e.target.value)
                                }
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Night Premium Hours">
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.nightPremiumHours}
                                onChange={(e) =>
                                    setField(
                                        "nightPremiumHours",
                                        e.target.value,
                                    )
                                }
                                className={inputCls}
                            />
                        </Field>
                        <Field label="OT Night Premium Hours">
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.overtimeNightPremiumHours}
                                onChange={(e) =>
                                    setField(
                                        "overtimeNightPremiumHours",
                                        e.target.value,
                                    )
                                }
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Late (hrs)">
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.lateHr}
                                onChange={(e) =>
                                    setField("lateHr", e.target.value)
                                }
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Undertime (hrs)">
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.undertimeHr}
                                onChange={(e) =>
                                    setField("undertimeHr", e.target.value)
                                }
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <Field label="Remarks">
                        <input
                            type="text"
                            value={form.remarks}
                            onChange={(e) =>
                                setField("remarks", e.target.value)
                            }
                            className={inputCls}
                        />
                    </Field>

                    <div className="flex gap-3 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </Overlay>
    );
};

// ─── view detail modal ──────────────────────────────────────────────────────────

const AttendanceDetailModal = ({ attendance, onClose }) => {
    if (!attendance) return null;
    const fields = [
        { label: "Employee", value: employeeName(attendance.compensation) },
        { label: "Date", value: toDate(attendance.attendanceDate) },
        { label: "Day Type", value: attendance.dayType ?? "—" },
        { label: "Regular Hours", value: num(attendance.regularHours) },
        { label: "Regular Hours Pay", value: fmt(attendance.regularHoursPay) },
        { label: "Overtime Hours", value: num(attendance.overtimeHours) },
        {
            label: "Overtime Hours Pay",
            value: fmt(attendance.overtimeHoursPay),
        },
        {
            label: "Night Premium Hours",
            value: num(attendance.nightPremiumHours),
        },
        { label: "Night Premium Pay", value: fmt(attendance.nightPremiumPay) },
        {
            label: "OT Night Premium Hours",
            value: num(attendance.overtimeNightPremiumHours),
        },
        {
            label: "OT Night Premium Pay",
            value: fmt(attendance.overtimeNightPremiumPay),
        },
        { label: "Late (hrs)", value: num(attendance.lateHr) },
        { label: "Late Deduction", value: fmt(attendance.lateDeduction) },
        { label: "Undertime (hrs)", value: num(attendance.undertimeHr) },
        {
            label: "Undertime Deduction",
            value: fmt(attendance.undertimeDeduction),
        },
        { label: "Remarks", value: attendance.remarks || "—" },
    ];

    return (
        <Overlay isOpen={true} onClose={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                    Attendance Details
                </h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {fields.map(({ label, value }) => (
                        <InfoField key={label} label={label} value={value} />
                    ))}
                </div>
                <div className="mt-6">
                    <button
                        onClick={onClose}
                        className="w-full py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Overlay>
    );
};

// ─── main page ───────────────────────────────────────────────────────────────

const Attendance = () => {
    const {
        attendances,
        totalAttendances,
        totalPages,
        currentPage,
        holidays,
        clients,
    } = useLoaderData();

    const holidayMap = Object.fromEntries(
        holidays.map((h) => [new Date(h.date).toISOString().slice(0, 10), h]),
    );
    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();

    const [searchInput, setSearchInput] = useState(
        searchParams.get("search") || "",
    );
    const [filterFrom, setFilterFrom] = useState(
        searchParams.get("dateFrom") || "",
    );
    const [filterTo, setFilterTo] = useState(searchParams.get("dateTo") || "");
    const [filterClient, setFilterClient] = useState(
        searchParams.get("client") || "",
    );

    const [modal, setModal] = useState(null);
    const [viewItem, setViewItem] = useState(null);
    const { confirmModal, askConfirm } = useConfirm();

    useEffect(() => {
        const timer = setTimeout(() => {
            // Use the functional updater so this always merges into the
            // latest params, not a stale snapshot captured when this effect
            // last ran (e.g. on mount) — otherwise a pending debounce can
            // fire after applyFilters() and wipe out dateFrom/dateTo.
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                if (searchInput) params.set("search", searchInput);
                else params.delete("search");
                params.set("page", "1");
                return params;
            });
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Every key goes into a single setSearchParams call. Two calls in the same
    // handler would both read the same pre-update params, so the second
    // navigate() would drop whatever the first one set.
    const applyFilters = (updates) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            for (const [key, value] of Object.entries(updates)) {
                if (value) params.set(key, value);
                else params.delete(key);
            }
            params.set("page", "1");
            return params;
        });
    };

    const applyFilter = (key, value) => applyFilters({ [key]: value });

    const clearFilters = () => {
        setSearchInput("");
        setFilterFrom("");
        setFilterTo("");
        setFilterClient("");
        setSearchParams({});
    };

    const setPage = (page) => {
        const params = Object.fromEntries(searchParams);
        setSearchParams({ ...params, page });
    };

    const sort = searchParams.get("sort") || "desc";
    const toggleSort = () => {
        const params = new URLSearchParams(searchParams);
        params.set("sort", sort === "asc" ? "desc" : "asc");
        params.set("page", "1");
        setSearchParams(params);
    };

    const handleDelete = (attendance) => {
        askConfirm("Delete this attendance record?", async () => {
            try {
                await customFetch.delete(`/attendances/${attendance._id}`);
                toast.success("Attendance deleted");
                revalidator.revalidate();
            } catch (error) {
                toast.error(
                    error?.response?.data?.msg ||
                        error?.response?.data?.message ||
                        error.message,
                );
            }
        });
    };

    const closeModal = () => setModal(null);
    const handleSaved = () => {
        closeModal();
        revalidator.revalidate();
    };

    const hasFilters = searchInput || filterFrom || filterTo || filterClient;

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Attendance
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Total records: {totalAttendances}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Search Employee</label>
                    <input
                        type="text"
                        placeholder="Name or employee code..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className={`${inputCls} w-full sm:w-56`}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Client</label>
                    <select
                        value={filterClient}
                        onChange={(e) => {
                            setFilterClient(e.target.value);
                            applyFilter("client", e.target.value);
                        }}
                        className={`${inputCls} w-full sm:w-auto`}
                    >
                        <option value="">All Clients</option>
                        {clients.map((c) => (
                            <option key={c._id} value={c._id}>
                                {c.clientName}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>From</label>
                    <input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => {
                            const val = e.target.value;
                            const autoTo = cutoffDateTo(val);
                            setFilterFrom(val);
                            if (autoTo) setFilterTo(autoTo);
                            applyFilters(
                                autoTo
                                    ? { dateFrom: val, dateTo: autoTo }
                                    : { dateFrom: val },
                            );
                        }}
                        className={`${inputCls} w-full sm:w-auto`}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>To</label>
                    <input
                        type="date"
                        value={filterTo}
                        onChange={(e) => {
                            setFilterTo(e.target.value);
                            applyFilter("dateTo", e.target.value);
                        }}
                        className={`${inputCls} w-full sm:w-auto`}
                    />
                </div>
                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-slate-500 hover:text-slate-800 underline pb-2.5"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200">
                {/* Mobile card view */}
                <div className="sm:hidden divide-y divide-slate-100">
                    {attendances.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">
                            No attendance records found.
                        </p>
                    )}
                    {attendances.map((att) => (
                        <div key={att._id} className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {employeeName(att.compensation)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {toDate(att.attendanceDate)} ·{" "}
                                        {att.dayType ?? "—"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => setViewItem(att)}
                                        className="text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    >
                                        View
                                    </button>
                                    <button
                                        onClick={() =>
                                            setModal({ attendance: att })
                                        }
                                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                    >
                                        <FiEdit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(att)}
                                        className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-xs">
                                <div className="bg-slate-50 rounded p-2">
                                    <p className="text-slate-400">Reg</p>
                                    <p className="font-medium text-slate-700">
                                        {num(att.regularHours)}h
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded p-2">
                                    <p className="text-slate-400">OT</p>
                                    <p className="font-medium text-slate-700">
                                        {num(att.overtimeHours)}h
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded p-2">
                                    <p className="text-slate-400">ND</p>
                                    <p className="font-medium text-slate-700">
                                        {num(att.nightPremiumHours)}h
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded p-2">
                                    <p className="text-slate-400">Pay</p>
                                    <p className="font-medium text-slate-700">
                                        {fmt(totalPay(att))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">#</th>
                                <th className="px-4 py-3 text-left">
                                    Employee
                                </th>
                                <th className="px-4 py-3 text-left">
                                    <button
                                        onClick={toggleSort}
                                        className="flex items-center gap-1 hover:text-slate-200"
                                    >
                                        Date
                                        {sort === "asc" ? (
                                            <FiChevronUp size={13} />
                                        ) : (
                                            <FiChevronDown size={13} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                    Day Type
                                </th>
                                <th className="px-4 py-3 text-right">
                                    Reg Hrs
                                </th>
                                <th className="px-4 py-3 text-right">OT Hrs</th>
                                <th className="px-4 py-3 text-right">ND Hrs</th>
                                <th className="px-4 py-3 text-right">
                                    Total Pay
                                </th>
                                <th className="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {attendances.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-8 text-center text-slate-400"
                                    >
                                        No attendance records found.
                                    </td>
                                </tr>
                            )}
                            {attendances.map((att, idx) => (
                                <tr
                                    key={att._id}
                                    className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}
                                >
                                    <td className="px-4 py-3 text-slate-500">
                                        {(currentPage - 1) * 20 + idx + 1}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">
                                        {employeeName(att.compensation)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {toDate(att.attendanceDate)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {att.dayType ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">
                                        {num(att.regularHours)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">
                                        {num(att.overtimeHours)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">
                                        {num(att.nightPremiumHours)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                        {fmt(totalPay(att))}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setViewItem(att)}
                                                className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setModal({ attendance: att })
                                                }
                                                className="text-slate-400 hover:text-slate-700"
                                                title="Edit"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(att)
                                                }
                                                className="text-red-400 hover:text-red-600"
                                                title="Delete"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
            />

            <AttendanceModal
                key={modal?.attendance?._id ?? "closed"}
                modal={modal}
                holidayMap={holidayMap}
                onClose={closeModal}
                onSaved={handleSaved}
            />
            <AttendanceDetailModal
                attendance={viewItem}
                onClose={() => setViewItem(null)}
            />
            {confirmModal}
        </div>
    );
};
export default Attendance;
