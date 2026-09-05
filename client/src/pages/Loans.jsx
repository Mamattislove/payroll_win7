import { useState, useEffect, useRef } from "react";
import { redirect, useLoaderData, useRevalidator, useSearchParams } from "react-router-dom";
import { FiEdit2, FiEye, FiPlus, FiTrash2 } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { LOAN_STATUS } from "../../../utils/constants";
import { useConfirm, Pagination } from "../components";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const employee = url.searchParams.get("employee") || "";
        const loanType = url.searchParams.get("loanType") || "";
        const loanStatus = url.searchParams.get("loanStatus") || "";

        const params = new URLSearchParams({ page, limit: "20" });
        if (employee) params.set("employee", employee);
        if (loanType) params.set("loanType", loanType);
        if (loanStatus) params.set("loanStatus", loanStatus);

        // The employee combobox below now searches employees server-side
        // instead of the whole collection being preloaded here.
        const [{ data }, { data: ltData }] = await Promise.all([
            customFetch.get(`/loan-applications?${params}`),
            customFetch.get("/loan-types?limit=1000"),
        ]);
        return { ...data, loanTypes: ltData.loanTypes || [] };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

export const action = async () => null;

const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-PH") : "—");

const statusBadge = (status) => {
    if (status === LOAN_STATUS.ONGOING)
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">{status}</span>;
    if (status === LOAN_STATUS.FULLY_PAID)
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">{status}</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{status}</span>;
};

const _inputCls = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 w-full";

const InfoField = ({ label, value }) => (
    <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
);

// Searches employees server-side (`/employees?search=`) instead of filtering
// a preloaded list — with 2000+ employees, loading them all up front made
// this page slow. `initialEmployee` shows a name for the disabled/edit case
// (the loan's employee is already populated by the API) without needing the
// full list.
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
    if (disabled) return <input type="text" value={empName(initialEmployee)} disabled className={`${_inputCls} bg-slate-100 text-slate-400 cursor-not-allowed`} />;
    const displayValue = open ? query : (selected ? empName(selected) : "");
    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input type="text" value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search employee…" className={`${_inputCls} pr-8`} autoComplete="off" />
                {selected && !open && (
                    <button type="button" onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="Clear">×</button>
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

// ── Loan payments view modal ─────────────────────────────────────────────────
const LoanPaymentsModal = ({ loan, onClose }) => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        customFetch
            .get(`/loan-payments?loan=${loan._id}&limit=500`)
            .then(({ data }) => {
                if (!cancelled) setPayments(data.loanPayments || []);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [loan._id]);

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-semibold text-slate-800">
                            {loan.employee?.firstName} {loan.employee?.lastName}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {loan.employee?.employeeCode || "—"} — {loan.loanType?.loanTypeName}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none">×</button>
                </div>

                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                    {[
                        { label: "Loan Amount", value: fmt(loan.loanAmount) },
                        { label: "Total Paid", value: fmt(totalPaid) },
                        { label: "Balance", value: fmt(loan.loanPayable) },
                    ].map(({ label, value }) => (
                        <div key={label} className="px-4 py-3 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                        </div>
                    ))}
                </div>

                <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
                        Loan Details
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                        <InfoField label="Loan Name" value={loan.loanName} />
                        <InfoField label="Check Number" value={loan.checkNumber} />
                        <InfoField label="Status" value={statusBadge(loan.loanStatus)} />
                        <InfoField label="Date Granted" value={fmtDate(loan.dateGranted)} />
                        <InfoField label="Loan Term" value={loan.loanTermFrom || loan.loanTermTo ? `${fmtDate(loan.loanTermFrom)} – ${fmtDate(loan.loanTermTo)}` : null} />
                        <InfoField label="Monthly Amortization" value={fmt(loan.monthlyAmortization)} />
                        <InfoField label="First Month Amortization" value={fmtDate(loan.firstMonthAmortization)} />
                        {loan.remarks && <InfoField label="Remarks" value={loan.remarks} />}
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
                    ) : payments.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-sm">No payments recorded.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50">
                                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                    <th className="px-4 py-2 text-left">#</th>
                                    <th className="px-4 py-2 text-left">Date of Payment</th>
                                    <th className="px-4 py-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payments.map((p, i) => (
                                    <tr key={p._id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                                        <td className="px-4 py-2 text-slate-600">{fmtDate(p.dateOfPayment)}</td>
                                        <td className="px-4 py-2 text-right font-medium text-slate-700">{fmt(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="w-full py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Loan add / edit modal ────────────────────────────────────────────────────
const BLANK = {
    employee: "",
    loanType: "",
    loanAmount: "",
    loanPayable: "",
    monthlyAmortization: "",
    firstMonthAmortization: "",
    dateGranted: "",
    loanTermFrom: "",
    loanTermTo: "",
    checkNumber: "",
    remarks: "",
    loanStatus: "",
};

const toDateInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

const LoanModal = ({ loan, loanTypes, onClose, onSaved }) => {
    const isEdit = !!loan;
    const [form, setForm] = useState(
        isEdit
            ? {
                  employee: loan.employee?._id || "",
                  loanType: loan.loanType?._id || "",
                  loanAmount: loan.loanAmount ?? "",
                  loanPayable: loan.loanPayable ?? "",
                  monthlyAmortization: loan.monthlyAmortization ?? "",
                  firstMonthAmortization: toDateInput(loan.firstMonthAmortization),
                  dateGranted: toDateInput(loan.dateGranted),
                  loanTermFrom: toDateInput(loan.loanTermFrom),
                  loanTermTo: toDateInput(loan.loanTermTo),
                  checkNumber: loan.checkNumber || "",
                  remarks: loan.remarks || "",
                  loanStatus: loan.loanStatus || "",
              }
            : { ...BLANK },
    );
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            const payload = { ...form };
            Object.keys(payload).forEach((k) => {
                if (payload[k] === "") delete payload[k];
            });
            if (isEdit) {
                await customFetch.patch(`/loan-applications/${loan._id}`, payload);
            } else {
                await customFetch.post("/loan-applications", payload);
            }
            onSaved();
        } catch (err) {
            setError(err?.response?.data?.msg || "An error occurred.");
        } finally {
            setSaving(false);
        }
    };

    const inputCls =
        "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 w-full";
    const labelCls = "text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1 block";

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-base font-semibold text-slate-800">{isEdit ? "Edit Loan" : "Add Loan"}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none">×</button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className={labelCls}>Employee *</label>
                        <EmployeeCombobox
                            value={form.employee}
                            onChange={(val) => setForm((f) => ({ ...f, employee: val }))}
                            disabled={isEdit}
                            initialEmployee={loan?.employee}
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Loan Type *</label>
                        <select value={form.loanType} onChange={set("loanType")} className={inputCls} required disabled={isEdit}>
                            <option value="">Select Loan Type</option>
                            {loanTypes.map((lt) => (
                                <option key={lt._id} value={lt._id}>{lt.loanTypeName}</option>
                            ))}
                        </select>
                    </div>

                    {isEdit && (
                        <div>
                            <label className={labelCls}>Status</label>
                            <select value={form.loanStatus} onChange={set("loanStatus")} className={inputCls}>
                                {Object.values(LOAN_STATUS).map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className={labelCls}>Loan Amount *</label>
                        <input
                            type="number" step="0.01" min="0"
                            value={form.loanAmount} onChange={set("loanAmount")}
                            className={inputCls} placeholder="0.00"
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Loan Payable (Balance)</label>
                        <input
                            type="number" step="0.01" min="0"
                            value={form.loanPayable} onChange={set("loanPayable")}
                            className={inputCls} placeholder="0.00"
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Monthly Amortization *</label>
                        <input
                            type="number" step="0.01" min="0"
                            value={form.monthlyAmortization} onChange={set("monthlyAmortization")}
                            className={inputCls} placeholder="0.00" required
                        />
                    </div>

                    <div>
                        <label className={labelCls}>First Month Amortization *</label>
                        <input
                            type="date"
                            value={form.firstMonthAmortization} onChange={set("firstMonthAmortization")}
                            className={inputCls} required
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Date Granted</label>
                        <input type="date" value={form.dateGranted} onChange={set("dateGranted")} className={inputCls} />
                    </div>

                    <div>
                        <label className={labelCls}>Loan Term From</label>
                        <input type="date" value={form.loanTermFrom} onChange={set("loanTermFrom")} className={inputCls} />
                    </div>

                    <div>
                        <label className={labelCls}>Loan Term To</label>
                        <input type="date" value={form.loanTermTo} onChange={set("loanTermTo")} className={inputCls} />
                    </div>

                    <div>
                        <label className={labelCls}>Check Number</label>
                        <input
                            type="text"
                            value={form.checkNumber} onChange={set("checkNumber")}
                            className={inputCls} placeholder="Check #"
                        />
                    </div>

                    <div className="col-span-2">
                        <label className={labelCls}>Remarks</label>
                        <textarea
                            value={form.remarks} onChange={set("remarks")}
                            rows={2} className={inputCls} placeholder="Optional notes..."
                        />
                    </div>

                    {error && (
                        <div className="col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
                    )}
                </form>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                    <button
                        type="button" onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit} disabled={saving}
                        className="px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Loan"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── page ─────────────────────────────────────────────────────────────────────
const Loans = () => {
    const { loanApplications, totalLoanApplications, totalPages, currentPage, loanTypes } =
        useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();
    const { confirmModal, askConfirm } = useConfirm();

    const [modal, setModal] = useState(null); // null | "add" | loan record
    const [viewLoan, setViewLoan] = useState(null);

    const setParam = (key) => (e) => {
        const params = Object.fromEntries(searchParams);
        delete params.page;
        if (e.target.value) params[key] = e.target.value;
        else delete params[key];
        setSearchParams(params);
    };

    const setPage = (page) => {
        const params = Object.fromEntries(searchParams);
        setSearchParams({ ...params, page });
    };

    const handleDelete = (loan) => {
        askConfirm(
            `Delete loan for ${loan.employee?.firstName} ${loan.employee?.lastName} (${loan.loanType?.loanTypeName})?`,
            async () => {
                await customFetch.delete(`/loan-applications/${loan._id}`);
                revalidator.revalidate();
            },
        );
    };

    const handleSaved = () => {
        setModal(null);
        revalidator.revalidate();
    };

    return (
        <div>
            {confirmModal}
            {modal && (
                <LoanModal
                    loan={modal === "add" ? null : modal}
                    loanTypes={loanTypes}
                    onClose={() => setModal(null)}
                    onSaved={handleSaved}
                />
            )}
            {viewLoan && (
                <LoanPaymentsModal loan={viewLoan} onClose={() => setViewLoan(null)} />
            )}

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Loan Applications</h1>
                    <p className="text-slate-500 mt-1">Total: {totalLoanApplications}</p>
                </div>
                <button
                    onClick={() => setModal("add")}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <FiPlus /> Add Loan
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Employee</label>
                    <div className="w-full sm:w-56">
                        <EmployeeCombobox
                            value={searchParams.get("employee") || ""}
                            onChange={(val) => {
                                const params = Object.fromEntries(searchParams);
                                delete params.page;
                                if (val) params.employee = val;
                                else delete params.employee;
                                setSearchParams(params);
                            }}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Loan Type</label>
                    <select
                        value={searchParams.get("loanType") || ""}
                        onChange={setParam("loanType")}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                        <option value="">All Types</option>
                        {loanTypes.map((lt) => (
                            <option key={lt._id} value={lt._id}>{lt.loanTypeName}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Status</label>
                    <select
                        value={searchParams.get("loanStatus") || ""}
                        onChange={setParam("loanStatus")}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                        <option value="">All Status</option>
                        {Object.values(LOAN_STATUS).map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                {(searchParams.get("employee") || searchParams.get("loanType") || searchParams.get("loanStatus")) && (
                    <button
                        onClick={() => setSearchParams({})}
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
                    {loanApplications.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">No loan applications found.</p>
                    )}
                    {loanApplications.map((loan) => (
                        <div key={loan._id} className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">{loan.employee?.firstName} {loan.employee?.lastName}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{loan.loanType?.loanTypeName || "—"}</p>
                                </div>
                                <div className="shrink-0">{statusBadge(loan.loanStatus)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                <div className="bg-slate-50 rounded p-2"><p className="text-slate-400">Amount</p><p className="font-medium text-slate-700">{fmt(loan.loanAmount)}</p></div>
                                <div className="bg-slate-50 rounded p-2"><p className="text-slate-400">Balance</p><p className="font-medium text-slate-700">{fmt(loan.loanPayable)}</p></div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setViewLoan(loan)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="View Payments"><FiEye size={14} /></button>
                                <button onClick={() => setModal(loan)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100" title="Edit"><FiEdit2 size={14} /></button>
                                <button onClick={() => handleDelete(loan)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Delete"><FiTrash2 size={14} /></button>
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
                            <th className="px-4 py-3 text-left">Loan Type</th>
                            <th className="px-4 py-3 text-right">Loan Amount</th>
                            <th className="px-4 py-3 text-right">Amortization</th>
                            <th className="px-4 py-3 text-right">Balance</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loanApplications.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                                    No loan applications found.
                                </td>
                            </tr>
                        )}
                        {loanApplications.map((loan, idx) => (
                            <tr key={loan._id} className="bg-white hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {loan.employee?.firstName} {loan.employee?.lastName}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{loan.loanType?.loanTypeName || "—"}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{fmt(loan.loanAmount)}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{fmt(loan.monthlyAmortization)}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{fmt(loan.loanPayable)}</td>
                                <td className="px-4 py-3">{statusBadge(loan.loanStatus)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <button
                                            onClick={() => setViewLoan(loan)}
                                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                            title="View Payments"
                                        >
                                            <FiEye size={14} />
                                        </button>
                                        <button
                                            onClick={() => setModal(loan)}
                                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(loan)}
                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
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
        </div>
    );
};

export default Loans;
