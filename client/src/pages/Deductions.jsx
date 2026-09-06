import { useState, useEffect, useRef } from "react";
import { redirect, useLoaderData, useRevalidator, useSearchParams, useRouteLoaderData } from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiEye, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { useConfirm, Pagination } from "../components";
import { canWrite } from "../../../utils/permissions";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const employee = url.searchParams.get("employee") || "";
        const deductionType = url.searchParams.get("deductionType") || "";

        const params = new URLSearchParams({ page });
        params.set("limit", "20");
        if (employee) params.set("employee", employee);
        if (deductionType) params.set("deductionType", deductionType);

        // The employee combobox below now searches employees server-side
        // instead of the whole collection being preloaded here.
        const [{ data }, { data: dtData }] = await Promise.all([
            customFetch.get(`/deduction-records?${params}`),
            customFetch.get("/deduction-types"),
        ]);
        return {
            ...data,
            deductionTypes: dtData.deductionTypes || [],
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

const RecordModal = ({ initial, deductionTypes, onClose, onSaved }) => {
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        employee: initial?.employee?._id ?? initial?.employee ?? "",
        deductionType: initial?.deductionType?._id ?? initial?.deductionType ?? "",
        name: initial?.name ?? "",
        currentAmount: initial?.currentAmount ?? "",
        monthlyDeduction: initial?.monthlyDeduction ?? "",
        applicationDate: initial?.applicationDate
            ? initial.applicationDate.slice(0, 10)
            : "",
    });

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = {};
            if (!isEdit) {
                body.employee = form.employee;
                body.deductionType = form.deductionType;
                body.name = form.name;
                body.initialAmount = Number(form.currentAmount);
            }
            if (form.currentAmount !== "") body.currentAmount = Number(form.currentAmount);
            if (form.monthlyDeduction !== "") body.monthlyDeduction = Number(form.monthlyDeduction);
            if (form.applicationDate) body.applicationDate = form.applicationDate;

            if (isEdit) {
                await customFetch.patch(`/deduction-records/${initial._id}`, body);
                toast.success("Record updated");
            } else {
                await customFetch.post("/deduction-records", body);
                toast.success("Record created");
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
                        {isEdit ? "Edit Deduction Record" : "Add Deduction Record"}
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
                        <label className={labelCls}>Deduction Type</label>
                        <select value={form.deductionType} onChange={set("deductionType")} required className={inputCls}>
                            <option value="">— Select type —</option>
                            {deductionTypes.map((dt) => (
                                <option key={dt._id} value={dt._id}>
                                    {dt.deductionName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className={labelCls}>Name / Description</label>
                        <input
                            value={form.name}
                            onChange={set("name")}
                            placeholder="e.g. SSS Loan — Feb 2025"
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
                            value={form.currentAmount}
                            onChange={set("currentAmount")}
                            required
                            className={inputCls}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Amortization / period</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.monthlyDeduction}
                                onChange={set("monthlyDeduction")}
                                placeholder="per payroll"
                                className={inputCls}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className={labelCls}>Application Date</label>
                            <input
                                type="date"
                                value={form.applicationDate}
                                onChange={set("applicationDate")}
                                className={inputCls}
                            />
                        </div>
                    </div>

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

// ─── payment history modal ────────────────────────────────────────────────────

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : null;

const PaymentHistoryModal = ({ record, onClose }) => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        customFetch
            .get(`/deduction-payments?deductionRecord=${record._id}&limit=500`)
            .then(({ data }) => {
                if (!cancelled) setPayments(data.deductionPayments || []);
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [record._id]);

    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = record.currentAmount ?? record.initialAmount ?? 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
                {/* header */}
                <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="font-semibold text-slate-800">{record.name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {record.employee?.firstName} {record.employee?.lastName}
                            {record.employee?.employeeCode && ` · ${record.employee.employeeCode}`}
                            {" · "}
                            {record.deductionType?.deductionName ?? "—"}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-4 mt-0.5">
                        <FiX size={18} />
                    </button>
                </div>

                {/* summary strip */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
                    {[
                        { label: "Initial", value: fmt(record.initialAmount) },
                        { label: "Total Paid", value: fmt(totalPaid) },
                        { label: "Balance", value: fmt(balance) },
                    ].map(({ label, value }) => (
                        <div key={label} className="px-4 py-3 text-center">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                            <p className={`text-sm font-semibold ${label === "Balance" ? (balance > 0 ? "text-amber-600" : "text-green-600") : "text-slate-800"}`}>
                                {value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* payment list */}
                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <p className="text-center text-slate-400 py-10 text-sm">Loading payments…</p>
                    ) : payments.length === 0 ? (
                        <p className="text-center text-slate-400 py-10 text-sm">No payments recorded yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50">
                                <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                    <th className="px-4 py-2.5 text-left">#</th>
                                    <th className="px-4 py-2.5 text-left">Date</th>
                                    <th className="px-4 py-2.5 text-left">Payroll Period</th>
                                    <th className="px-4 py-2.5 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {payments.map((p, idx) => (
                                    <tr key={p._id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-slate-600">
                                            {fmtDate(p.deductionDate) || fmtDate(p.createdAt)}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-500 text-xs">
                                            {p.payroll
                                                ? `${fmtDate(p.payroll.payrollFrom)} – ${fmtDate(p.payroll.payrollTo)}`
                                                : <span className="italic text-slate-400">Ad-hoc</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                                            {fmt(p.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* footer */}
                {!loading && payments.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50 rounded-b-xl">
                        <span className="text-xs text-slate-500">{payments.length} payment{payments.length !== 1 ? "s" : ""}</span>
                        <span className="text-sm font-semibold text-slate-800">Total Paid: {fmt(totalPaid)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── page ─────────────────────────────────────────────────────────────────────

const Deductions = () => {
    const {
        deductionRecords,
        totalDeductionRecords,
        totalPages,
        currentPage,
        deductionTypes,
    } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");

    // Same resource the router checks, so the controls and the API agree.
    // "View payments" stays for everyone -- it only reads.
    const mayEdit = canWrite("deductionRecords", user?.role);

    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();

    const [filterEmployee, setFilterEmployee] = useState(searchParams.get("employee") || "");
    const [filterType, setFilterType] = useState(searchParams.get("deductionType") || "");
    const [modal, setModal] = useState(null); // null | "add" | record-object (edit)
    const [viewRecord, setViewRecord] = useState(null);
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
        askConfirm("Delete this deduction record?", async () => {
            setDeleting(id);
            try {
                await customFetch.delete(`/deduction-records/${id}`);
                toast.success("Record deleted");
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
                    deductionTypes={deductionTypes}
                    onClose={() => setModal(null)}
                    onSaved={afterSave}
                />
            )}
            {viewRecord && (
                <PaymentHistoryModal
                    record={viewRecord}
                    onClose={() => setViewRecord(null)}
                />
            )}

            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Deduction Records</h1>
                    <p className="text-slate-500 mt-1">Total: {totalDeductionRecords}</p>
                </div>
                {mayEdit && (
                    <button
                        onClick={() => setModal("add")}
                        className="flex items-center gap-2 py-2.5 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <FiPlus size={14} />
                        Add Record
                    </button>
                )}
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
                        onChange={(e) => {
                            setFilterType(e.target.value);
                            applyFilter("deductionType", e.target.value);
                        }}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                    >
                        <option value="">All Types</option>
                        {deductionTypes.map((dt) => (
                            <option key={dt._id} value={dt._id}>
                                {dt.deductionName}
                            </option>
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
                    {deductionRecords.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">No deduction records found.</p>
                    )}
                    {deductionRecords.map((rec) => (
                        <div key={rec._id} className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {rec.employee?.firstName} {rec.employee?.lastName}
                                        {rec.employee?.employeeCode && <span className="ml-1 text-xs text-slate-400">({rec.employee.employeeCode})</span>}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">{rec.deductionType?.deductionName ?? "—"} · {rec.name}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => setViewRecord(rec)} className="p-2 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50" title="View payments"><FiEye size={14} /></button>
                                    {mayEdit && (
                                        <>
                                        <button onClick={() => setModal(rec)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Edit"><FiEdit2 size={14} /></button>
                                        <button onClick={() => handleDelete(rec._id)} disabled={deleting === rec._id} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40" title="Delete"><FiTrash2 size={14} /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-50 rounded p-2"><p className="text-slate-400">Balance</p><p className={`font-medium ${rec.currentAmount > 0 ? "text-amber-600" : "text-green-600"}`}>{fmt(rec.currentAmount ?? rec.initialAmount)}</p></div>
                                <div className="bg-slate-50 rounded p-2"><p className="text-slate-400">Per Month</p><p className="font-medium text-slate-700">{rec.monthlyDeduction ? fmt(rec.monthlyDeduction) : "—"}</p></div>
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
                            <th className="px-4 py-3 text-left">Type</th>
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-right">Initial</th>
                            <th className="px-4 py-3 text-right">Balance</th>
                            <th className="px-4 py-3 text-right">Amortization</th>
                            <th className="px-4 py-3 text-left">App. Date</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {deductionRecords.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                                    No deduction records found.
                                </td>
                            </tr>
                        )}
                        {deductionRecords.map((rec, idx) => (
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
                                        <span className="ml-1 text-xs text-slate-400">
                                            ({rec.employee.employeeCode})
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {rec.deductionType?.deductionName ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-700">{rec.name}</td>
                                <td className="px-4 py-3 text-right text-slate-600">
                                    {fmt(rec.initialAmount)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span
                                        className={
                                            rec.currentAmount > 0
                                                ? "text-amber-600 font-medium"
                                                : "text-green-600 font-medium"
                                        }
                                    >
                                        {fmt(rec.currentAmount ?? rec.initialAmount)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600">
                                    {rec.monthlyDeduction ? fmt(rec.monthlyDeduction) : "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">
                                    {rec.applicationDate
                                        ? new Date(rec.applicationDate).toLocaleDateString("en-PH")
                                        : "—"}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => setViewRecord(rec)}
                                            className="text-blue-400 hover:text-blue-600"
                                            title="View payments"
                                        >
                                            <FiEye size={14} />
                                        </button>
                                        {mayEdit && (
                                            <>
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
                                            </>
                                        )}
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

export default Deductions;
