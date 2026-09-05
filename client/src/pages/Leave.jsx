import { useState, useEffect, useRef } from "react";
import { redirect, useLoaderData, useRevalidator, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FiCheck, FiChevronDown, FiChevronUp, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { useConfirm, Pagination } from "../components";
import { LEAVE_STATUS, LEAVE_WITH_PAY, LEAVE_HALFDAY } from "../../../utils/constants";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const employee = url.searchParams.get("employee") || "";
        const status = url.searchParams.get("status") || "";
        const sort = url.searchParams.get("sort") || "-dateFrom";

        const params = new URLSearchParams({ page, limit: 20 });
        if (employee) params.set("employee", employee);
        if (status) params.set("status", status);
        params.set("sort", sort);

        // The employee combobox below now searches employees server-side
        // instead of the whole collection being preloaded here.
        const [{ data }, { data: leaveTypeData }] = await Promise.all([
            customFetch.get(`/leave-applications?${params}`),
            customFetch.get("/leave-types"),
        ]);
        return {
            leaveApplications: data.leaveApplications || [],
            totalLeaveApplications: data.totalLeaveApplications || 0,
            totalPages: data.totalPages || 1,
            currentPage: data.currentPage || 1,
            leaveTypes: leaveTypeData.leaveTypes || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// kept for compatibility — action is no longer used but Router still references it
export const action = async () => ({ success: true });

// ─── helpers ──────────────────────────────────────────────────────────────────

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls = "text-[11px] font-semibold uppercase tracking-widest text-slate-400";

const statusBadge = (status) => {
    const map = {
        [LEAVE_STATUS.PENDING]: "bg-yellow-100 text-yellow-700",
        [LEAVE_STATUS.APPROVED]: "bg-green-100 text-green-700",
        [LEAVE_STATUS.REJECTED]: "bg-red-100 text-red-700",
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] || "bg-slate-100 text-slate-600"}`}>
            {status}
        </span>
    );
};

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

// Searches employees server-side (`/employees?search=`) instead of filtering
// a preloaded list — with 2000+ employees, loading them all up front made
// this page slow to load.
const EmployeeCombobox = ({ value, onChange }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const containerRef = useRef(null);
    const empName = (e) => `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "—";

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const { data } = await customFetch.get("/employees", {
                    params: { search: query, limit: 20 },
                });
                if (!cancelled) setResults(data.employees || []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [query, open]);

    const handleSelect = (emp) => { setSelected(emp); onChange(emp._id); setQuery(""); setOpen(false); };
    const handleClear = () => { setSelected(null); onChange(""); setQuery(""); };
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setQuery(""); }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const displayValue = open ? query : (selected ? empName(selected) : "");
    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input type="text" value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search employee…" className={`${inputCls} pr-8`} autoComplete="off" />
                {selected && !open && (
                    <button type="button" onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="Clear">
                        <FiX size={14} />
                    </button>
                )}
            </div>
            {open && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loading ? <p className="px-3 py-2.5 text-sm text-slate-400">Searching…</p>
                    : results.length === 0 ? <p className="px-3 py-2.5 text-sm text-slate-400">No employees found.</p>
                    : results.map((e) => (
                        <button key={e._id} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => handleSelect(e)}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 ${value === e._id ? "bg-slate-50 font-semibold" : ""}`}>
                            <span className="text-slate-800 truncate">{empName(e)}</span>
                            {e.employeeCode && <span className="text-slate-400 text-xs shrink-0">{e.employeeCode}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── add / edit modal ─────────────────────────────────────────────────────────

const LeaveModal = ({ initial, leaveTypes, onClose, onSaved }) => {
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        employee: initial?.employee?._id ?? initial?.employee ?? "",
        leaveType: initial?.leaveType?._id ?? initial?.leaveType ?? "",
        dateFrom: initial?.dateFrom ? initial.dateFrom.slice(0, 10) : "",
        dateTo: initial?.dateTo ? initial.dateTo.slice(0, 10) : "",
        withPay: initial?.withPay ?? LEAVE_WITH_PAY.WITHOUT_PAY,
        halfday: initial?.halfday ?? LEAVE_HALFDAY.FULL_DAY,
        notes: initial?.notes ?? "",
        status: initial?.status ?? LEAVE_STATUS.PENDING,
    });

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = {
                leaveType: form.leaveType,
                dateFrom: form.dateFrom,
                dateTo: form.dateTo,
                withPay: form.withPay,
                halfday: form.halfday,
                notes: form.notes || undefined,
                status: form.status,
            };
            if (!isEdit) body.employee = form.employee;

            if (isEdit) {
                await customFetch.patch(`/leave-applications/${initial._id}`, body);
                toast.success("Leave application updated");
            } else {
                await customFetch.post("/leave-applications", body);
                toast.success("Leave application submitted");
            }
            onSaved();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-800">
                        {isEdit ? "Edit Leave Application" : "Apply for Leave"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <FiX size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
                    {/* Employee — only on create */}
                    {!isEdit && (
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Employee</label>
                            <EmployeeCombobox
                                value={form.employee}
                                onChange={(val) => setForm((p) => ({ ...p, employee: val }))}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Leave Type</label>
                        <select value={form.leaveType} onChange={set("leaveType")} required className={inputCls}>
                            <option value="">— Select type —</option>
                            {leaveTypes.map((lt) => (
                                <option key={lt._id} value={lt._id}>{lt.leaveTypeName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Date From</label>
                            <input type="date" value={form.dateFrom} onChange={set("dateFrom")} required className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Date To</label>
                            <input type="date" value={form.dateTo} onChange={set("dateTo")} required className={inputCls} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>With Pay</label>
                            <select value={form.withPay} onChange={set("withPay")} className={inputCls}>
                                {Object.values(LEAVE_WITH_PAY).map((v) => (
                                    <option key={v} value={v} className="capitalize">{v}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Half Day</label>
                            <select value={form.halfday} onChange={set("halfday")} className={inputCls}>
                                {Object.values(LEAVE_HALFDAY).map((v) => (
                                    <option key={v} value={v} className="capitalize">{v}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {isEdit && (
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Status</label>
                            <select value={form.status} onChange={set("status")} className={inputCls}>
                                {Object.values(LEAVE_STATUS).map((v) => (
                                    <option key={v} value={v} className="capitalize">{v}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Notes</label>
                        <textarea
                            value={form.notes}
                            onChange={set("notes")}
                            rows={2}
                            placeholder="Optional notes…"
                            className={inputCls + " resize-none"}
                        />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
                        >
                            {saving ? "Saving..." : isEdit ? "Update" : "Submit"}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── quick status action button ───────────────────────────────────────────────

const QuickStatus = ({ leave, onDone }) => {
    const [busy, setBusy] = useState(false);

    const update = async (status) => {
        setBusy(true);
        try {
            await customFetch.patch(`/leave-applications/${leave._id}`, { status });
            toast.success(`Leave ${status}`);
            onDone();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err.message);
        } finally {
            setBusy(false);
        }
    };

    if (leave.status !== LEAVE_STATUS.PENDING) return null;

    return (
        <div className="flex gap-1">
            <button
                onClick={() => update(LEAVE_STATUS.APPROVED)}
                disabled={busy}
                title="Approve"
                className="p-1 rounded text-green-500 hover:bg-green-50 disabled:opacity-40"
            >
                <FiCheck size={14} />
            </button>
            <button
                onClick={() => update(LEAVE_STATUS.REJECTED)}
                disabled={busy}
                title="Reject"
                className="p-1 rounded text-red-400 hover:bg-red-50 disabled:opacity-40"
            >
                <FiX size={14} />
            </button>
        </div>
    );
};

// ─── page ─────────────────────────────────────────────────────────────────────

const Leave = () => {
    const {
        leaveApplications,
        totalLeaveApplications,
        totalPages,
        currentPage,
        leaveTypes,
    } = useLoaderData();

    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirmModal, askConfirm } = useConfirm();

    const [modal, setModal] = useState(null); // null | "add" | leave-object (edit)

    const [filterEmployee, setFilterEmployee] = useState(searchParams.get("employee") || "");
    const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "");

    const applyFilter = (key, value) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (value) p.set(key, value); else p.delete(key);
            p.set("page", "1");
            return p;
        });
    };

    const clearFilters = () => {
        setFilterEmployee("");
        setFilterStatus("");
        setSearchParams({});
    };

    const setPage = (page) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("page", page);
            return p;
        });
    };

    const sort = searchParams.get("sort") || "-dateFrom";
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const toggleSort = (field) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            // Clicking the already-active column flips its direction;
            // clicking the other column switches to it, starting descending.
            const next = sortField === field
                ? (sortDir === "desc" ? field : `-${field}`)
                : `-${field}`;
            p.set("sort", next);
            p.set("page", "1");
            return p;
        });
    };

    const handleDelete = (id) => {
        askConfirm("Delete this leave application?", async () => {
            try {
                await customFetch.delete(`/leave-applications/${id}`);
                toast.success("Leave application deleted");
                revalidator.revalidate();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err.message);
            }
        });
    };

    const afterSave = () => {
        setModal(null);
        revalidator.revalidate();
    };

    return (
        <div>
            {modal && (
                <LeaveModal
                    initial={modal === "add" ? null : modal}
                    leaveTypes={leaveTypes}
                    onClose={() => setModal(null)}
                    onSaved={afterSave}
                />
            )}

            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Leave Applications</h1>
                    <p className="text-slate-500 mt-1">Total: {totalLeaveApplications}</p>
                </div>
                <button
                    onClick={() => setModal("add")}
                    className="flex items-center gap-2 py-2.5 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <FiPlus size={14} />
                    Apply Leave
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Employee</label>
                    <div className="w-full sm:w-56">
                        <EmployeeCombobox
                            value={filterEmployee}
                            onChange={(val) => { setFilterEmployee(val); applyFilter("employee", val); }}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            applyFilter("status", e.target.value);
                        }}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                    >
                        <option value="">All Statuses</option>
                        {Object.values(LEAVE_STATUS).map((s) => (
                            <option key={s} value={s} className="capitalize">{s}</option>
                        ))}
                    </select>
                </div>

                {(filterEmployee || filterStatus) && (
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
                    {leaveApplications.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">No leave applications found.</p>
                    )}
                    {leaveApplications.map((leave) => (
                        <div key={leave._id} className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {leave.employee?.firstName} {leave.employee?.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">{leave.leaveType?.leaveTypeName ?? "—"}</p>
                                    <p className="text-xs text-slate-500">{fmtDate(leave.dateFrom)} → {fmtDate(leave.dateTo)}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <QuickStatus leave={leave} onDone={revalidator.revalidate} />
                                    <button onClick={() => setModal(leave)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><FiEdit2 size={14} /></button>
                                    <button onClick={() => handleDelete(leave._id)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"><FiTrash2 size={14} /></button>
                                </div>
                            </div>
                            <div className="mt-1">{statusBadge(leave.status)}</div>
                        </div>
                    ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Employee</th>
                            <th className="px-4 py-3 text-left">Leave Type</th>
                            <th className="px-4 py-3 text-left">
                                <button
                                    onClick={() => toggleSort("dateFrom")}
                                    className="flex items-center gap-1 hover:text-slate-200"
                                >
                                    From
                                    {sortField === "dateFrom" && (
                                        sortDir === "asc" ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />
                                    )}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left">
                                <button
                                    onClick={() => toggleSort("dateTo")}
                                    className="flex items-center gap-1 hover:text-slate-200"
                                >
                                    To
                                    {sortField === "dateTo" && (
                                        sortDir === "asc" ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />
                                    )}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left">Half Day</th>
                            <th className="px-4 py-3 text-left">With Pay</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leaveApplications.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                                    No leave applications found.
                                </td>
                            </tr>
                        )}
                        {leaveApplications.map((leave, idx) => (
                            <tr key={leave._id} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}>
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {leave.employee?.firstName} {leave.employee?.lastName}
                                    {leave.employee?.employeeCode && (
                                        <span className="ml-1 text-xs text-slate-400">({leave.employee.employeeCode})</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {leave.leaveType?.leaveTypeName ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{fmtDate(leave.dateFrom)}</td>
                                <td className="px-4 py-3 text-slate-600">{fmtDate(leave.dateTo)}</td>
                                <td className="px-4 py-3 text-slate-600 capitalize">{leave.halfday ?? "—"}</td>
                                <td className="px-4 py-3 text-slate-600 capitalize">{leave.withPay ?? "—"}</td>
                                <td className="px-4 py-3">{statusBadge(leave.status)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <QuickStatus leave={leave} onDone={revalidator.revalidate} />
                                        <button
                                            onClick={() => setModal(leave)}
                                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(leave._id)}
                                            className="p-1 rounded text-red-400 hover:text-red-600"
                                            title="Delete"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            {confirmModal}
        </div>
    );
};
export default Leave;
