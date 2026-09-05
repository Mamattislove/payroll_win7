import { useState, useEffect, useRef } from "react";
import { redirect, useLoaderData, useRevalidator, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiEye, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { useConfirm, Pagination } from "../components";
import { SAVINS_STATUS } from "../../../utils/constants";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const employee = url.searchParams.get("employee") || "";
        const status = url.searchParams.get("status") || "";

        const params = new URLSearchParams({ page, limit: 20 });
        if (employee) params.set("employee", employee);
        if (status) params.set("status", status);

        // The employee combobox below now searches employees server-side
        // instead of the whole collection being preloaded here.
        const { data } = await customFetch.get(`/savings?${params}`);
        return {
            savings: data.savings || [],
            totalSavings: data.totalSavings || 0,
            totalPages: data.totalPages || 1,
            currentPage: data.currentPage || 1,
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls = "text-[11px] font-semibold uppercase tracking-widest text-slate-400";

const statusBadge = (status) => {
    const map = {
        [SAVINS_STATUS.ACTIVE]: "bg-green-100 text-green-700",
        [SAVINS_STATUS.COMPLETED]: "bg-blue-100 text-blue-700",
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] || "bg-slate-100 text-slate-600"}`}>
            {status}
        </span>
    );
};

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

const SavingsModal = ({ initial, onClose, onSaved }) => {
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        employee: initial?.employee?._id ?? initial?.employee ?? "",
        savingsTarget: initial?.savingsTarget ?? "",
        cutoffDeductionAmount: initial?.cutoffDeductionAmount ?? "",
        effectiveDate: initial?.effectiveDate ? initial.effectiveDate.slice(0, 10) : "",
        status: initial?.status ?? SAVINS_STATUS.ACTIVE,
    });

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = {
                savingsTarget: Number(form.savingsTarget),
                cutoffDeductionAmount: Number(form.cutoffDeductionAmount),
                effectiveDate: form.effectiveDate || undefined,
            };
            if (isEdit) {
                body.status = form.status;
                await customFetch.patch(`/savings/${initial._id}`, body);
                toast.success("Savings plan updated");
            } else {
                body.employee = form.employee;
                await customFetch.post("/savings", body);
                toast.success("Savings plan created");
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
                        {isEdit ? "Edit Savings Plan" : "Add Savings Plan"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <FiX size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
                    {!isEdit && (
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Employee</label>
                            <EmployeeCombobox
                                value={form.employee}
                                onChange={(val) => setForm((p) => ({ ...p, employee: val }))}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Savings Target (₱)</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.savingsTarget}
                                onChange={set("savingsTarget")}
                                required
                                placeholder="0.00"
                                className={inputCls}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Cutoff Deduction (₱)</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.cutoffDeductionAmount}
                                onChange={set("cutoffDeductionAmount")}
                                required
                                placeholder="0.00"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Effective Date</label>
                        <input
                            type="date"
                            value={form.effectiveDate}
                            onChange={set("effectiveDate")}
                            className={inputCls}
                        />
                    </div>

                    {isEdit && (
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Status</label>
                            <select value={form.status} onChange={set("status")} className={inputCls}>
                                {Object.values(SAVINS_STATUS).map((v) => (
                                    <option key={v} value={v} className="capitalize">{v}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
                        >
                            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
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

// ─── savings records modal ────────────────────────────────────────────────────

const SavingsRecordsModal = ({ plan, onClose }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        customFetch
            .get(`/savings-records?savings=${plan._id}&limit=500`)
            .then(({ data }) => {
                if (!cancelled) setRecords(data.savingsRecords || []);
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [plan._id]);

    const totalDeducted = records.reduce((s, r) => s + Number(r.amountDeducted || 0), 0);
    const remaining = Math.max(0, (plan.savingsTarget || 0) - totalDeducted);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
                {/* header */}
                <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="font-semibold text-slate-800">Savings Records</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {plan.employee?.firstName} {plan.employee?.lastName}
                            {plan.employee?.employeeCode && ` · ${plan.employee.employeeCode}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-4 mt-0.5">
                        <FiX size={18} />
                    </button>
                </div>

                {/* summary strip */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
                    {[
                        { label: "Target", value: fmt(plan.savingsTarget) },
                        { label: "Total Saved", value: fmt(totalDeducted) },
                        { label: "Remaining", value: fmt(remaining) },
                    ].map(({ label, value }) => (
                        <div key={label} className="px-4 py-3 text-center">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                            <p className={`text-sm font-semibold ${label === "Remaining" ? (remaining > 0 ? "text-amber-600" : "text-green-600") : "text-slate-800"}`}>
                                {value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* records list */}
                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <p className="text-center text-slate-400 py-10 text-sm">Loading records…</p>
                    ) : records.length === 0 ? (
                        <p className="text-center text-slate-400 py-10 text-sm">No deductions recorded yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50">
                                <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                    <th className="px-4 py-2.5 text-left">#</th>
                                    <th className="px-4 py-2.5 text-left">Date</th>
                                    <th className="px-4 py-2.5 text-right">Amount Deducted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {records.map((r, idx) => (
                                    <tr key={r._id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-slate-600">{fmtDate(r.createdAt)}</td>
                                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmt(r.amountDeducted)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* footer */}
                {!loading && records.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50 rounded-b-xl">
                        <span className="text-xs text-slate-500">{records.length} deduction{records.length !== 1 ? "s" : ""}</span>
                        <span className="text-sm font-semibold text-slate-800">Total Saved: {fmt(totalDeducted)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── page ─────────────────────────────────────────────────────────────────────

const Savings = () => {
    const { savings, totalSavings, totalPages, currentPage } = useLoaderData();
    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirmModal, askConfirm } = useConfirm();

    const [modal, setModal] = useState(null);     // null | "add" | savings-object (edit)
    const [viewPlan, setViewPlan] = useState(null);

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

    const handleDelete = (id) => {
        askConfirm("Delete this savings plan?", async () => {
            try {
                await customFetch.delete(`/savings/${id}`);
                toast.success("Savings plan deleted");
                revalidator.revalidate();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
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
                <SavingsModal
                    initial={modal === "add" ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={afterSave}
                />
            )}
            {viewPlan && (
                <SavingsRecordsModal
                    plan={viewPlan}
                    onClose={() => setViewPlan(null)}
                />
            )}

            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Employee Savings</h1>
                    <p className="text-slate-500 mt-1">Total: {totalSavings}</p>
                </div>
                <button
                    onClick={() => setModal("add")}
                    className="flex items-center gap-2 py-2.5 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <FiPlus size={14} />
                    Add Savings Plan
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
                        onChange={(e) => { setFilterStatus(e.target.value); applyFilter("status", e.target.value); }}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                    >
                        <option value="">All Statuses</option>
                        {Object.values(SAVINS_STATUS).map((s) => (
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
                    {savings.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">No savings plans found.</p>
                    )}
                    {savings.map((s) => (
                        <div key={s._id} className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {s.employee?.firstName} {s.employee?.lastName}
                                        {s.employee?.employeeCode && <span className="ml-1 text-xs text-slate-400">({s.employee.employeeCode})</span>}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">{fmtDate(s.effectiveDate)}</p>
                                </div>
                                <div className="shrink-0">{statusBadge(s.status)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                <div className="bg-slate-50 rounded p-2"><p className="text-slate-400">Target</p><p className="font-medium text-slate-700">{fmt(s.savingsTarget)}</p></div>
                                <div className="bg-slate-50 rounded p-2"><p className="text-slate-400">Per Cutoff</p><p className="font-medium text-slate-700">{fmt(s.cutoffDeductionAmount)}</p></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setViewPlan(s)} className="p-2 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50" title="View records"><FiEye size={14} /></button>
                                <button onClick={() => setModal(s)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Edit"><FiEdit2 size={14} /></button>
                                <button onClick={() => handleDelete(s._id)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete"><FiTrash2 size={14} /></button>
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
                            <th className="px-4 py-3 text-left">Employee</th>
                            <th className="px-4 py-3 text-right">Savings Target</th>
                            <th className="px-4 py-3 text-right">Cutoff Deduction</th>
                            <th className="px-4 py-3 text-left">Effective Date</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {savings.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                    No savings plans found.
                                </td>
                            </tr>
                        )}
                        {savings.map((s, idx) => (
                            <tr key={s._id} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}>
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {s.employee?.firstName} {s.employee?.lastName}
                                    {s.employee?.employeeCode && (
                                        <span className="ml-1 text-xs text-slate-400">({s.employee.employeeCode})</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700 font-medium">{fmt(s.savingsTarget)}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{fmt(s.cutoffDeductionAmount)}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(s.effectiveDate)}</td>
                                <td className="px-4 py-3">{statusBadge(s.status)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => setViewPlan(s)}
                                            className="text-blue-400 hover:text-blue-600"
                                            title="View records"
                                        >
                                            <FiEye size={14} />
                                        </button>
                                        <button
                                            onClick={() => setModal(s)}
                                            className="text-slate-400 hover:text-slate-700"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(s._id)}
                                            className="text-red-400 hover:text-red-600"
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
export default Savings;
