import { useState, useEffect, useRef } from "react";
import { redirect, useLoaderData, useRevalidator, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { useConfirm, Pagination } from "../components";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const employee = url.searchParams.get("employee") || "";
        const earningType = url.searchParams.get("earningType") || "";

        const params = new URLSearchParams({ page, limit: 20 });
        if (employee) params.set("employee", employee);
        if (earningType) params.set("earningType", earningType);

        const [{ data }, { data: etData }] = await Promise.all([
            customFetch.get(`/earning-records?${params}`),
            customFetch.get("/earning-types"),
        ]);
        return {
            earningRecords: data.earningRecords || [],
            totalEarningRecords: data.totalEarningRecords || 0,
            totalPages: data.totalPages || 1,
            currentPage: data.currentPage || 1,
            earningTypes: etData.earningTypes || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

const inputCls =
    "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 w-full";
const labelCls = "text-[11px] font-semibold uppercase tracking-widest text-slate-400";

// Searches employees server-side (`/employees?search=`) instead of filtering
// a preloaded list — with 2000+ employees, loading them all up front made
// this page slow. `initialEmployee` shows a name for the disabled/edit case
// (the record's employee is already populated by the API) without needing
// the full list.
const EmployeeCombobox = ({ value, onChange, disabled, initialEmployee }) => {
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
    if (disabled) return <input type="text" value={empName(initialEmployee)} disabled className={`${inputCls} bg-slate-100 text-slate-400 cursor-not-allowed`} />;
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

// ─── modal ────────────────────────────────────────────────────────────────────

const RecordModal = ({ initial, earningTypes, onClose, onSaved }) => {
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        employee: initial?.employee?._id ?? initial?.employee ?? "",
        earningType: initial?.earningType?._id ?? initial?.earningType ?? "",
        name: initial?.name ?? "",
        amount: initial?.amount ?? "",
    });

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = {
                earningType: form.earningType,
                name: form.name,
                amount: Number(form.amount),
            };
            if (isEdit) {
                await customFetch.patch(`/earning-records/${initial._id}`, body);
                toast.success("Earning record updated");
            } else {
                body.employee = form.employee;
                await customFetch.post("/earning-records", body);
                toast.success("Earning record created");
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
                        {isEdit ? "Edit Earning Record" : "Add Earning Record"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <FiX size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Employee</label>
                        <EmployeeCombobox
                            value={form.employee}
                            onChange={(val) => setForm((p) => ({ ...p, employee: val }))}
                            disabled={isEdit}
                            initialEmployee={initial?.employee}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Earning Type</label>
                        <select value={form.earningType} onChange={set("earningType")} required className={inputCls}>
                            <option value="">— Select type —</option>
                            {earningTypes.map((t) => (
                                <option key={t._id} value={t._id}>{t.earningName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Name / Description</label>
                        <input
                            value={form.name}
                            onChange={set("name")}
                            placeholder="e.g. Adjustment — Feb 2026"
                            required
                            className={inputCls}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Amount</label>
                        <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={form.amount}
                            onChange={set("amount")}
                            required
                            className={inputCls}
                        />
                    </div>

                    {!isEdit && (
                        <p className="text-xs text-slate-400 italic">
                            Not linked to a specific payroll — it'll be auto-attached the next time payroll is processed for this employee.
                        </p>
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

// ─── page ─────────────────────────────────────────────────────────────────────

const Earnings = () => {
    const {
        earningRecords,
        totalEarningRecords,
        totalPages,
        currentPage,
        earningTypes,
    } = useLoaderData();

    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();

    const [filterEmployee, setFilterEmployee] = useState(searchParams.get("employee") || "");
    const [filterType, setFilterType] = useState(searchParams.get("earningType") || "");
    const [modal, setModal] = useState(null); // null | "add" | record-object (edit)
    const [deleting, setDeleting] = useState(null);
    const { confirmModal, askConfirm } = useConfirm();

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
        setFilterType("");
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
        askConfirm("Delete this earning record?", async () => {
            setDeleting(id);
            try {
                await customFetch.delete(`/earning-records/${id}`);
                toast.success("Earning record deleted");
                revalidator.revalidate();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
            } finally {
                setDeleting(null);
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
                <RecordModal
                    initial={modal === "add" ? null : modal}
                    earningTypes={earningTypes}
                    onClose={() => setModal(null)}
                    onSaved={afterSave}
                />
            )}

            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Earnings</h1>
                    <p className="text-slate-500 mt-1">Total: {totalEarningRecords}</p>
                </div>
                <button
                    onClick={() => setModal("add")}
                    className="flex items-center gap-2 py-2.5 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <FiPlus size={14} />
                    Add Record
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
                    <label className={labelCls}>Type</label>
                    <select
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); applyFilter("earningType", e.target.value); }}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                    >
                        <option value="">All Types</option>
                        {earningTypes.map((t) => (
                            <option key={t._id} value={t._id}>{t.earningName}</option>
                        ))}
                    </select>
                </div>
                {(filterEmployee || filterType) && (
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
                    {earningRecords.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">No earning records found.</p>
                    )}
                    {earningRecords.map((rec) => (
                        <div key={rec._id} className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {rec.employee?.firstName} {rec.employee?.lastName}
                                        {rec.employee?.employeeCode && <span className="ml-1 text-xs text-slate-400">({rec.employee.employeeCode})</span>}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">{rec.earningType?.earningName ?? "—"} · {rec.name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {rec.payroll ? `${fmtDate(rec.payroll.payrollFrom)} – ${fmtDate(rec.payroll.payrollTo)}` : "Standing (unlinked)"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => setModal(rec)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Edit"><FiEdit2 size={14} /></button>
                                    <button onClick={() => handleDelete(rec._id)} disabled={deleting === rec._id} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40" title="Delete"><FiTrash2 size={14} /></button>
                                </div>
                            </div>
                            <p className="text-sm font-semibold text-slate-700">{fmt(rec.amount)}</p>
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
                            <th className="px-4 py-3 text-left">Type</th>
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-left">Pay Period</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {earningRecords.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                    No earning records found.
                                </td>
                            </tr>
                        )}
                        {earningRecords.map((rec, idx) => (
                            <tr
                                key={rec._id}
                                className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}
                            >
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {rec.employee?.firstName} {rec.employee?.lastName}
                                    {rec.employee?.employeeCode && (
                                        <span className="ml-1 text-xs text-slate-400">({rec.employee.employeeCode})</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {rec.earningType?.earningName ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-700">{rec.name}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">
                                    {rec.payroll
                                        ? `${fmtDate(rec.payroll.payrollFrom)} – ${fmtDate(rec.payroll.payrollTo)}`
                                        : <span className="italic text-slate-400">Standing (unlinked)</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-700">
                                    {fmt(rec.amount)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => setModal(rec)}
                                            className="text-slate-400 hover:text-slate-700"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rec._id)}
                                            disabled={deleting === rec._id}
                                            className="text-red-400 hover:text-red-600 disabled:opacity-40"
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

export default Earnings;
