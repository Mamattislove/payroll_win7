import { useState, useEffect, useRef } from "react";
import {
    Link,
    redirect,
    useLoaderData,
    useNavigate,
    useSearchParams,
    useRevalidator,
    useRouteLoaderData,
} from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiEye, FiLayers, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import {
    Overlay,
    InfoField,
    useConfirm,
    Pagination,
    ClientCombobox,
} from "../components";
import { COMPENSATION_STATUS, DAY_TYPES } from "../../../utils/constants";
import { canWrite } from "../../../utils/permissions";
import { computePayroll } from "@shared/computePayroll";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || "1";
        const compensation = url.searchParams.get("compensation") || "";
        const client = url.searchParams.get("client") || "";
        const from = url.searchParams.get("from") || "";
        const to = url.searchParams.get("to") || "";

        const params = new URLSearchParams({ page });
        params.set("limit", "20");
        if (compensation) params.set("compensation", compensation);
        if (client) params.set("client", client);
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        // The employee comboboxes below now search compensations server-side
        // instead of the whole collection being preloaded here.
        const [
            { data },
            { data: earningTypeData },
            { data: allowanceTypeData },
            { data: deductionTypeData },
            { data: chargeTypeData },
            { data: clientData },
        ] = await Promise.all([
            customFetch.get(`/payrolls?${params}`),
            customFetch.get(`/earning-types?limit=1000`),
            customFetch.get(`/allowance-types?limit=1000`),
            customFetch.get(`/deduction-types?limit=1000`),
            customFetch.get(`/charge-types?limit=1000`),
            customFetch.get(`/clients?limit=1000`),
        ]);

        return {
            ...data,
            earningTypes: earningTypeData.earningTypes || [],
            allowanceTypes: allowanceTypeData.allowanceTypes || [],
            deductionTypes: deductionTypeData.deductionTypes || [],
            chargeTypes: chargeTypeData.chargeTypes || [],
            clients: clientData.clients || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// ─── shared UI ────────────────────────────────────────────────────────────────

const inputCls =
    "w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 bg-white";
const labelCls = "block text-xs text-slate-500 mb-0.5";

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
    <div>
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const toDate = (val) => (val ? new Date(val).toLocaleDateString("en-PH") : "—");

const employeeName = (comp) => {
    const emp = comp?.employeeDesignation?.employee;
    if (!emp) return "—";
    return `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "—";
};

// Searches compensations server-side (`/compensations?search=`) instead of
// filtering a preloaded list — with 2000+ compensations (each with a deep
// employee/client/department/position populate), loading them all up front
// made this page slow. Selecting a result hands back the full compensation
// object (some callers need dailyRate/monthlyRate/employeeDesignation, not
// just the id). `initialSelected` lets a caller show a name for an
// already-known selection (e.g. a filter restored from the URL).
const EmployeeCombobox = ({ value, onChange, initialSelected, client }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(initialSelected || null);
    const containerRef = useRef(null);

    useEffect(() => {
        setSelected(initialSelected || null);
    }, [initialSelected?._id]);

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
                        // Scopes the picker to one client when the caller
                        // supplies one, so it cannot offer employees who
                        // are not designated under it.
                        ...(client && { client }),
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
    }, [query, open, client]);

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
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target)
            ) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const displayValue = open ? query : selected ? employeeName(selected) : "";

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
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
                        <p className="px-3 py-2.5 text-sm text-slate-400">
                            Searching…
                        </p>
                    ) : results.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">
                            No employees found.
                        </p>
                    ) : (
                        results.map((c) => {
                            const code =
                                c.employeeDesignation?.employee?.employeeCode;
                            const client =
                                c.employeeDesignation?.client?.clientName;
                            const inactive =
                                c.activeStatus !== COMPENSATION_STATUS.ACTIVE;
                            return (
                                <button
                                    key={c._id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelect(c)}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 ${value === c._id ? "bg-slate-50 font-semibold" : ""}`}
                                >
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-1.5">
                                            <span className="text-slate-800 truncate">
                                                {employeeName(c)}
                                            </span>
                                            {inactive && (
                                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                                                    Inactive
                                                </span>
                                            )}
                                        </span>
                                        {client && (
                                            <span className="block text-xs text-slate-400 truncate">
                                                {client}
                                            </span>
                                        )}
                                    </span>
                                    {code && (
                                        <span className="text-slate-400 text-xs shrink-0">
                                            {code}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

// ─── record section (earnings / allowances / charges) ──────────────────────────

const RecordSection = ({
    title,
    records,
    types,
    typeKey,
    typeLabelKey,
    endpoint,
    employeeId,
    payrollId,
    onChanged,
    editable,
}) => {
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();

    const total = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const handleAdd = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const raw = Object.fromEntries(new FormData(e.target));
            await customFetch.post(endpoint, {
                employee: employeeId,
                [typeKey]: raw[typeKey],
                name: raw.name,
                amount: Number(raw.amount),
                payroll: payrollId,
            });
            toast.success(`${title} added`);
            setAdding(false);
            onChanged();
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

    const handleRemove = (recordId) => {
        askConfirm(
            `Remove this ${title.toLowerCase()} from the payroll?`,
            async () => {
                try {
                    const remainingIds = records
                        .filter((r) => r._id !== recordId)
                        .map((r) => r._id);
                    const key = endpoint
                        .replace("/", "")
                        .replace("-records", "s");
                    await customFetch.patch(`/payrolls/${payrollId}`, {
                        [key]: remainingIds,
                    });
                    toast.success(`${title} removed`);
                    onChanged();
                } catch (error) {
                    toast.error(
                        error?.response?.data?.msg ||
                            error?.response?.data?.message ||
                            error.message,
                    );
                }
            },
        );
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {title} — {fmt(total)}
                </p>
                {editable && (
                    <button
                        type="button"
                        onClick={() => setAdding((v) => !v)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                        {adding ? "Cancel" : "Add"}
                    </button>
                )}
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">
                    No {title.toLowerCase()} linked.
                </p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li
                        key={r._id}
                        className="flex items-center justify-between py-1.5 text-sm"
                    >
                        <div>
                            <span className="text-slate-800">{r.name}</span>
                            <span className="text-slate-400 ml-2 text-xs">
                                {r[typeKey]?.[typeLabelKey] ?? ""}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">
                                {fmt(r.amount)}
                            </span>
                            {editable && (
                                <button
                                    type="button"
                                    onClick={() => handleRemove(r._id)}
                                    className="text-red-400 hover:text-red-600"
                                    title="Remove from payroll"
                                >
                                    <FiTrash2 size={13} />
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {adding && (
                <form
                    onSubmit={handleAdd}
                    className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2"
                >
                    <select name={typeKey} required className={inputCls}>
                        <option value="">— Type —</option>
                        {types.map((t) => (
                            <option key={t._id} value={t._id}>
                                {t[typeLabelKey]}
                            </option>
                        ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            name="name"
                            placeholder="Name"
                            required
                            className={inputCls}
                        />
                        <input
                            name="amount"
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="Amount"
                            required
                            className={inputCls}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="py-1.5 rounded bg-slate-900 text-white text-xs hover:bg-slate-700 disabled:opacity-60"
                    >
                        {saving ? "Adding..." : "Add"}
                    </button>
                </form>
            )}
            {confirmModal}
        </div>
    );
};

// ─── deduction section ────────────────────────────────────────────────────────

const DeductionSection = ({
    records,
    employeeId,
    payrollId,
    onChanged,
    editable,
}) => {
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirmModal: dedConfirmModal, askConfirm: dedAskConfirm } =
        useConfirm();
    const [existingRecords, setExistingRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [amount, setAmount] = useState("");

    const total = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const openAdd = async () => {
        setAdding(true);
        setSelectedRecord(null);
        setAmount("");
        setLoadingRecords(true);
        try {
            const { data } = await customFetch.get(
                `/deduction-records?employee=${employeeId}&limit=100`,
            );
            setExistingRecords(data.deductionRecords || []);
        } catch {
            setExistingRecords([]);
        } finally {
            setLoadingRecords(false);
        }
    };

    const closeAdd = () => {
        setAdding(false);
        setSelectedRecord(null);
        setAmount("");
    };

    const handleRecordSelect = (e) => {
        const rec =
            existingRecords.find((r) => r._id === e.target.value) || null;
        setSelectedRecord(rec);
        setAmount(
            rec?.monthlyDeduction
                ? String(rec.monthlyDeduction)
                : rec?.currentAmount != null
                  ? String(rec.currentAmount)
                  : "",
        );
    };

    const handleAddExisting = async (e) => {
        e.preventDefault();
        if (!selectedRecord) return;
        setSaving(true);
        try {
            await customFetch.post("/deduction-payments", {
                deductionRecord: selectedRecord._id,
                amount: Number(amount),
                payroll: payrollId,
            });
            toast.success("Deduction added");
            closeAdd();
            onChanged();
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

    const handleRemove = (paymentId) => {
        dedAskConfirm(
            "Remove this deduction payment from the payroll?",
            async () => {
                try {
                    await customFetch.delete(
                        `/deduction-payments/${paymentId}`,
                    );
                    toast.success("Deduction removed");
                    onChanged();
                } catch (error) {
                    toast.error(
                        error?.response?.data?.msg ||
                            error?.response?.data?.message ||
                            error.message,
                    );
                }
            },
        );
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Deductions — {fmt(total)}
                </p>
                {editable && (
                    <button
                        type="button"
                        onClick={adding ? closeAdd : openAdd}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                        {adding ? "Cancel" : "Add"}
                    </button>
                )}
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">
                    No deductions linked.
                </p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li
                        key={r._id}
                        className="flex items-center justify-between py-1.5 text-sm"
                    >
                        <div>
                            <span className="text-slate-800">
                                {r.deductionRecord?.name}
                            </span>
                            <span className="text-slate-400 ml-2 text-xs">
                                {r.deductionRecord?.deductionType
                                    ?.deductionName ?? ""}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">
                                {fmt(r.amount)}
                            </span>
                            {editable && (
                                <button
                                    type="button"
                                    onClick={() => handleRemove(r._id)}
                                    className="text-red-400 hover:text-red-600"
                                    title="Remove from payroll"
                                >
                                    <FiTrash2 size={13} />
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {adding && (
                <form
                    onSubmit={handleAddExisting}
                    className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2"
                >
                    {loadingRecords ? (
                        <p className="text-xs text-slate-400 py-1">
                            Loading records…
                        </p>
                    ) : (
                        <select
                            required
                            value={selectedRecord?._id ?? ""}
                            onChange={handleRecordSelect}
                            className={inputCls}
                        >
                            <option value="">
                                — Select deduction record —
                            </option>
                            {existingRecords.map((rec) => (
                                <option key={rec._id} value={rec._id}>
                                    {rec.name}
                                    {rec.deductionType?.deductionName
                                        ? ` (${rec.deductionType.deductionName})`
                                        : ""}
                                    {rec.currentAmount != null
                                        ? ` — bal: ₱${Number(rec.currentAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                                        : ""}
                                </option>
                            ))}
                        </select>
                    )}
                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Amount"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={inputCls}
                    />
                    <button
                        type="submit"
                        disabled={saving || !selectedRecord}
                        className="py-1.5 rounded bg-slate-900 text-white text-xs hover:bg-slate-700 disabled:opacity-60"
                    >
                        {saving ? "Adding..." : "Add"}
                    </button>
                </form>
            )}
            {dedConfirmModal}
        </div>
    );
};

// ─── loan section ─────────────────────────────────────────────────────────────

const LoanSection = ({
    records,
    employeeId,
    payrollId,
    onChanged,
    editable,
}) => {
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();
    const [loanList, setLoanList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [amount, setAmount] = useState("");

    const total = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const openAdd = async () => {
        setAdding(true);
        setSelectedLoan(null);
        setAmount("");
        setLoadingList(true);
        try {
            const { data } = await customFetch.get(
                `/loan-applications?employee=${employeeId}&loanStatus=on going&limit=100`,
            );
            setLoanList(data.loanApplications || []);
        } catch {
            setLoanList([]);
        } finally {
            setLoadingList(false);
        }
    };

    const closeAdd = () => {
        setAdding(false);
        setSelectedLoan(null);
        setAmount("");
    };

    const handleSelect = (e) => {
        const l = loanList.find((r) => r._id === e.target.value) || null;
        setSelectedLoan(l);
        setAmount(
            l
                ? String(
                      Math.min(l.monthlyAmortization || 0, l.loanPayable || 0),
                  )
                : "",
        );
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!selectedLoan) return;
        setSaving(true);
        try {
            await customFetch.post("/loan-payments", {
                loan: selectedLoan._id,
                amount: Number(amount),
                payroll: payrollId,
            });
            toast.success("Loan payment added");
            closeAdd();
            onChanged();
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

    const handleRemove = (paymentId) => {
        askConfirm(
            "Remove this loan payment from the payroll? The balance will be restored.",
            async () => {
                try {
                    await customFetch.delete(`/loan-payments/${paymentId}`);
                    toast.success("Loan payment removed");
                    onChanged();
                } catch (error) {
                    toast.error(
                        error?.response?.data?.msg ||
                            error?.response?.data?.message ||
                            error.message,
                    );
                }
            },
        );
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Loan Payments — {fmt(total)}
                </p>
                {editable && (
                    <button
                        type="button"
                        onClick={adding ? closeAdd : openAdd}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                        {adding ? "Cancel" : "Add"}
                    </button>
                )}
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">
                    No loan payments linked.
                </p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li
                        key={r._id}
                        className="flex items-center justify-between py-1.5 text-sm"
                    >
                        <div>
                            <span className="text-slate-800">
                                {r.loan?.loanName || "Loan"}
                            </span>
                            {r.loan?.loanType?.loanTypeName && (
                                <span className="text-slate-400 ml-2 text-xs">
                                    {r.loan.loanType.loanTypeName}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">
                                {fmt(r.amount)}
                            </span>
                            {editable && (
                                <button
                                    type="button"
                                    onClick={() => handleRemove(r._id)}
                                    className="text-red-400 hover:text-red-600"
                                    title="Remove from payroll"
                                >
                                    <FiTrash2 size={13} />
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {adding && (
                <form
                    onSubmit={handleAdd}
                    className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2"
                >
                    {loadingList ? (
                        <p className="text-xs text-slate-400 py-1">
                            Loading loans…
                        </p>
                    ) : (
                        <select
                            required
                            value={selectedLoan?._id ?? ""}
                            onChange={handleSelect}
                            className={inputCls}
                        >
                            <option value="">— Select loan —</option>
                            {loanList.map((l) => (
                                <option key={l._id} value={l._id}>
                                    {l.loanName}
                                    {l.loanType?.loanTypeName
                                        ? ` (${l.loanType.loanTypeName})`
                                        : ""}
                                    {` — Bal: ₱${Number(l.loanPayable).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
                                </option>
                            ))}
                        </select>
                    )}
                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Amount"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={inputCls}
                    />
                    <button
                        type="submit"
                        disabled={saving || !selectedLoan}
                        className="py-1.5 rounded bg-slate-900 text-white text-xs hover:bg-slate-700 disabled:opacity-60"
                    >
                        {saving ? "Adding..." : "Add"}
                    </button>
                </form>
            )}
            {confirmModal}
        </div>
    );
};

// ─── savings section ──────────────────────────────────────────────────────────

const SavingsSection = ({
    records,
    employeeId,
    payrollId,
    onChanged,
    editable,
}) => {
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();
    const [savingsList, setSavingsList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [selectedSavings, setSelectedSavings] = useState(null);
    const [amount, setAmount] = useState("");

    const total = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const openAdd = async () => {
        setAdding(true);
        setSelectedSavings(null);
        setAmount("");
        setLoadingList(true);
        try {
            const { data } = await customFetch.get(
                `/savings?employee=${employeeId}&status=active&limit=100`,
            );
            setSavingsList(data.savings || []);
        } catch {
            setSavingsList([]);
        } finally {
            setLoadingList(false);
        }
    };

    const closeAdd = () => {
        setAdding(false);
        setSelectedSavings(null);
        setAmount("");
    };

    const handleSelect = (e) => {
        const s = savingsList.find((r) => r._id === e.target.value) || null;
        setSelectedSavings(s);
        setAmount(
            s?.cutoffDeductionAmount != null
                ? String(s.cutoffDeductionAmount)
                : "",
        );
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!selectedSavings) return;
        setSaving(true);
        try {
            await customFetch.post("/savings-records", {
                savings: selectedSavings._id,
                amount: Number(amount),
                payroll: payrollId,
            });
            toast.success("Savings deduction added");
            closeAdd();
            onChanged();
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

    const handleRemove = (paymentId) => {
        askConfirm(
            "Remove this savings deduction from the payroll?",
            async () => {
                try {
                    await customFetch.delete(`/savings-records/${paymentId}`);
                    toast.success("Savings deduction removed");
                    onChanged();
                } catch (error) {
                    toast.error(
                        error?.response?.data?.msg ||
                            error?.response?.data?.message ||
                            error.message,
                    );
                }
            },
        );
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Savings — {fmt(total)}
                </p>
                {editable && (
                    <button
                        type="button"
                        onClick={adding ? closeAdd : openAdd}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                        {adding ? "Cancel" : "Add"}
                    </button>
                )}
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">
                    No savings linked.
                </p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li
                        key={r._id}
                        className="flex items-center justify-between py-1.5 text-sm"
                    >
                        <div>
                            <span className="text-slate-800">Savings</span>
                            {r.savings?.savingsTarget != null && (
                                <span className="text-slate-400 ml-2 text-xs">
                                    Target: {fmt(r.savings.savingsTarget)}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">
                                {fmt(r.amount)}
                            </span>
                            {editable && (
                                <button
                                    type="button"
                                    onClick={() => handleRemove(r._id)}
                                    className="text-red-400 hover:text-red-600"
                                    title="Remove from payroll"
                                >
                                    <FiTrash2 size={13} />
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {adding && (
                <form
                    onSubmit={handleAdd}
                    className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2"
                >
                    {loadingList ? (
                        <p className="text-xs text-slate-400 py-1">
                            Loading savings plans…
                        </p>
                    ) : (
                        <select
                            required
                            value={selectedSavings?._id ?? ""}
                            onChange={handleSelect}
                            className={inputCls}
                        >
                            <option value="">— Select savings plan —</option>
                            {savingsList.map((s) => (
                                <option key={s._id} value={s._id}>
                                    {`Target: ₱${Number(s.savingsTarget).toLocaleString("en-PH", { minimumFractionDigits: 2 })} — Cutoff: ₱${Number(s.cutoffDeductionAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
                                </option>
                            ))}
                        </select>
                    )}
                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Amount"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={inputCls}
                    />
                    <button
                        type="submit"
                        disabled={saving || !selectedSavings}
                        className="py-1.5 rounded bg-slate-900 text-white text-xs hover:bg-slate-700 disabled:opacity-60"
                    >
                        {saving ? "Adding..." : "Add"}
                    </button>
                </form>
            )}
            {confirmModal}
        </div>
    );
};

// ─── attendance breakdown ────────────────────────────────────────────────────

const StatTile = ({ label, value }) => (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            {label}
        </p>
        <p className="text-lg font-semibold text-slate-800 tabular-nums">
            {value}
        </p>
    </div>
);

const h2 = (n) => (Number(n) || 0).toFixed(2);

// Works whether the value arrives as an ISO string from the API or a Date.
const isoDay = (v) => new Date(v).toISOString().slice(0, 10);

// Shows the actual days that produced the pay, the same way the bulk-attendance
// summary does. The attendance is looked up by compensation + period rather than
// through Payroll.attendance: that array was only ever filled in for a handful of
// records, so the stored link cannot be relied on.
const AttendanceBreakdown = ({ item }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const compensationId = item.compensation?._id ?? item.compensation;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const { data } = await customFetch.get("/attendances", {
                    params: {
                        compensation: compensationId,
                        dateFrom: isoDay(item.payrollFrom),
                        dateTo: isoDay(item.payrollTo),
                        limit: 500,
                        sort: "asc",
                    },
                });
                if (!cancelled) setRows(data.attendances || []);
            } catch {
                if (!cancelled) setRows([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [compensationId, item.payrollFrom, item.payrollTo]);

    if (loading) {
        return <p className="text-sm text-slate-400">Loading attendance…</p>;
    }

    if (rows.length === 0) {
        return (
            <p className="text-sm text-slate-400">
                No attendance records exist for this period, so the pay cannot
                be traced back to individual days. Payrolls up to May 2026 were
                imported from the previous system without their timekeeping.
            </p>
        );
    }

    const sum = (field) =>
        rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
    const totals = {
        regularHours: sum("regularHours"),
        overtimeHours: sum("overtimeHours"),
        nightPremiumHours: sum("nightPremiumHours"),
        overtimeNightPremiumHours: sum("overtimeNightPremiumHours"),
        lateHr: sum("lateHr"),
        undertimeHr: sum("undertimeHr"),
        regularHoursPay: sum("regularHoursPay"),
    };
    // Run the same aggregation the payroll itself uses, so the figures shown
    // here and the figures banked on the record cannot drift apart by
    // construction. Counting regularHoursPay by hand here got it wrong twice:
    // holiday days are paid at their own multipliers and belong in
    // holidayRestDayPay, and night hours sit outside regularHours so their base
    // wage went missing from basic pay entirely.
    const regularRows = rows.filter((r) => r.dayType === DAY_TYPES.REGULAR);
    const dailyRate = Number(item.compensation?.dailyRate) || 0;
    const computed = computePayroll(rows, dailyRate);
    const basicPay = computed.regularPay;
    const daysWorked = computed.daysWorked;

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <StatTile label="Days" value={daysWorked} />
                <StatTile label="Reg Hrs" value={h2(totals.regularHours)} />
                <StatTile label="OT Hrs" value={h2(totals.overtimeHours)} />
                <StatTile
                    label="Night Prem"
                    value={h2(totals.nightPremiumHours)}
                />
                <StatTile label="Late" value={h2(totals.lateHr)} />
                <StatTile label="Undertime" value={h2(totals.undertimeHr)} />
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-900 text-white uppercase tracking-wider sticky top-0">
                                <th className="px-3 py-2 text-left">Date</th>
                                <th className="px-3 py-2 text-left">
                                    Day Type
                                </th>
                                <th className="px-3 py-2 text-right">Reg</th>
                                <th className="px-3 py-2 text-right">OT</th>
                                <th className="px-3 py-2 text-right">ND</th>
                                <th className="px-3 py-2 text-right">OT-ND</th>
                                <th className="px-3 py-2 text-right">Late</th>
                                <th className="px-3 py-2 text-right">UT</th>
                                <th className="px-3 py-2 text-right">
                                    Regular Pay
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row, idx) => (
                                <tr
                                    key={row._id}
                                    className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}
                                >
                                    <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">
                                        {toDate(row.attendanceDate)}
                                    </td>
                                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                        {row.dayType || "—"}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                                        {h2(row.regularHours)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                                        {h2(row.overtimeHours)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                                        {h2(row.nightPremiumHours)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                                        {h2(row.overtimeNightPremiumHours)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                                        {h2(row.lateHr)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                                        {h2(row.undertimeHr)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-medium text-slate-800 tabular-nums">
                                        {fmt(row.regularHoursPay)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 text-white px-4 py-3">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-300">
                        Regular Hours
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                        {h2(
                            regularRows.reduce(
                                (s, r) =>
                                    s +
                                    (Number(r.regularHours) || 0) +
                                    (Number(r.nightPremiumHours) || 0),
                                0,
                            ),
                        )}
                        h over {daysWorked} regular day
                        {daysWorked === 1 ? "" : "s"}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-slate-300">
                        Basic Pay
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                        {fmt(basicPay)}
                    </p>
                </div>
            </div>

            {Math.abs(basicPay - (Number(item.regularPay) || 0)) > 0.01 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    These regular days add up to {fmt(basicPay)}, but the
                    payroll records {fmt(item.regularPay)} as Regular Pay. The
                    payroll was likely edited by hand after it was generated.
                </p>
            )}
        </div>
    );
};

// ─── payroll detail modal ───────────────────────────────────────────────────────

const PayrollDetailModal = ({
    payroll,
    types,
    editable,
    onClose,
    onUpdated,
}) => {
    const [item, setItem] = useState(payroll);

    if (!item) return null;

    const employeeId =
        item.compensation?.employeeDesignation?.employee?._id ??
        item.compensation?.employeeDesignation?.employee;

    const refresh = async () => {
        const { data } = await customFetch.get(`/payrolls/${item._id}`);
        setItem(data.payroll);
        onUpdated();
    };

    const attendanceFields = [
        { label: "Regular Pay", value: fmt(item.regularPay) },
        { label: "Regular OT Pay", value: fmt(item.regularOTPay) },
        { label: "Holiday/Rest Day Pay", value: fmt(item.holidayRestDayPay) },
        { label: "Holiday/RD OT Pay", value: fmt(item.holidayRestDayOTPay) },
        {
            label: "Night Differential Pay",
            value: fmt(item.nightDifferentialPay),
        },
        { label: "Absences", value: fmt(item.absences) },
        { label: "Late", value: fmt(item.late) },
        { label: "Undertime", value: fmt(item.undertime) },
    ];

    const govFields = [
        { label: "SSS Contribution", value: fmt(item.sssContribution) },
        {
            label: "PhilHealth Contribution",
            value: fmt(item.philhealthContribution),
        },
        {
            label: "Pag-IBIG Contribution",
            value: fmt(item.pagibigContribution),
        },
        { label: "Withholding Tax", value: fmt(item.withholdingTax) },
    ];

    const totalFields = [
        { label: "Gross Pay", value: fmt(item.grossPay) },
        { label: "Total Deductions", value: fmt(item.totalDeductions) },
        { label: "Net Salary", value: fmt(item.netSalary) },
        { label: "Final Pay", value: fmt(item.finalPay) },
    ];

    return (
        <Overlay isOpen={true} onClose={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {editable ? "Edit Payroll" : "View Payroll"}
                    </h2>
                    {editable ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            Editing
                        </span>
                    ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                            Read Only
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-500 mb-5">
                    {employeeName(item.compensation)} —{" "}
                    {toDate(item.payrollFrom)} to {toDate(item.payrollTo)}
                </p>

                <div className="flex flex-col gap-6">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
                            Payroll Date
                        </p>
                        <p className="text-sm font-medium text-slate-700">
                            {toDate(item.payrollDate) || "—"}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
                            Attendance-Based Pay
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                            {attendanceFields.map((f) => (
                                <InfoField
                                    key={f.label}
                                    label={f.label}
                                    value={f.value}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
                            Attendance Behind the Basic Pay
                        </p>
                        <AttendanceBreakdown item={item} />
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
                            Government Contributions
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                            {govFields.map((f) => (
                                <InfoField
                                    key={f.label}
                                    label={f.label}
                                    value={f.value}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
                            Linked Records
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <RecordSection
                                title="Earnings"
                                records={item.earning || []}
                                types={types.earningTypes}
                                typeKey="earningType"
                                typeLabelKey="earningName"
                                endpoint="/earning-records"
                                employeeId={employeeId}
                                payrollId={item._id}
                                onChanged={refresh}
                                editable={editable}
                            />
                            <RecordSection
                                title="Charges"
                                records={item.charges || []}
                                types={types.chargeTypes}
                                typeKey="chargeType"
                                typeLabelKey="chargeName"
                                endpoint="/charge-records"
                                employeeId={employeeId}
                                payrollId={item._id}
                                onChanged={refresh}
                                editable={editable}
                            />
                            <RecordSection
                                title="Allowances"
                                records={item.allowances || []}
                                types={types.allowanceTypes}
                                typeKey="allowanceType"
                                typeLabelKey="allowanceName"
                                endpoint="/allowance-records"
                                employeeId={employeeId}
                                payrollId={item._id}
                                onChanged={refresh}
                                editable={editable}
                            />

                            <DeductionSection
                                records={item.deductions || []}
                                employeeId={employeeId}
                                payrollId={item._id}
                                onChanged={refresh}
                                editable={editable}
                            />
                            <LoanSection
                                records={item.loans || []}
                                employeeId={employeeId}
                                payrollId={item._id}
                                onChanged={refresh}
                                editable={editable}
                            />
                            <SavingsSection
                                records={item.savings || []}
                                employeeId={employeeId}
                                payrollId={item._id}
                                onChanged={refresh}
                                editable={editable}
                            />
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
                            Totals
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                            {totalFields.map((f) => (
                                <InfoField
                                    key={f.label}
                                    label={f.label}
                                    value={f.value}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </Overlay>
    );
};

// ─── process payroll modal ────────────────────────────────────────────────────

const ProcessPayrollModal = ({ onClose, onDone }) => {
    const [saving, setSaving] = useState(false);
    const [selectedComp, setSelectedComp] = useState(null);
    const [form, setForm] = useState({
        payrollFrom: "",
        payrollTo: "",
        payrollDate: "",
    });

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const selected = selectedComp;
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await customFetch.post("/payrolls", {
                compensation: selectedComp?._id,
                payrollFrom: form.payrollFrom,
                payrollTo: form.payrollTo,
                ...(form.payrollDate && { payrollDate: form.payrollDate }),
            });
            toast.success("Payroll processed");
            onDone();
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-800">
                        Process Payroll
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <FiX size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field label="Employee / Compensation">
                        <EmployeeCombobox
                            value={selectedComp?._id ?? ""}
                            onChange={setSelectedComp}
                        />
                    </Field>

                    {selected && (
                        <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">
                                    Daily Rate
                                </p>
                                <p className="font-medium text-slate-800">
                                    {fmt(selected.dailyRate)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">
                                    Monthly Rate
                                </p>
                                <p className="font-medium text-slate-800">
                                    {fmt(selected.monthlyRate)}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="From">
                            <input
                                type="date"
                                value={form.payrollFrom}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const autoTo = cutoffDateTo(val);
                                    setForm((p) => ({
                                        ...p,
                                        payrollFrom: val,
                                        ...(autoTo && { payrollTo: autoTo }),
                                    }));
                                }}
                                required
                                className={inputCls}
                            />
                        </Field>
                        <Field label="To">
                            <input
                                type="date"
                                value={form.payrollTo}
                                onChange={set("payrollTo")}
                                required
                                className={inputCls}
                            />
                        </Field>
                    </div>

                    <Field label="Payroll Date">
                        <input
                            type="date"
                            value={form.payrollDate}
                            onChange={set("payrollDate")}
                            className={inputCls}
                        />
                    </Field>

                    <div className="flex gap-3 pt-2">
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
                            {saving ? "Processing..." : "Process"}
                        </button>
                    </div>
                </form>
            </div>
        </Overlay>
    );
};

// ─── main page ───────────────────────────────────────────────────────────────

const Payroll = () => {
    const {
        payrolls,
        totalPayrolls,
        totalPages,
        currentPage,
        earningTypes,
        allowanceTypes,
        deductionTypes,
        chargeTypes,
        clients,
    } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();
    const navigate = useNavigate();

    const [viewItem, setViewItem] = useState(null);
    const [processOpen, setProcessOpen] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();

    // Processing, editing and deleting a payroll are all the same resource, so
    // one flag covers the three controls on this page. The linked-record
    // sections inside a payroll are narrower and gate themselves.
    const mayEdit = canWrite("payrolls", user?.role);

    const filterCompensation = searchParams.get("compensation") || "";
    const filterClient = searchParams.get("client") || "";
    const filterFrom = searchParams.get("from") || "";
    const filterTo = searchParams.get("to") || "";

    const applyFilter = (key, value) => {
        const params = new URLSearchParams(searchParams);
        if (value) params.set(key, value);
        else params.delete(key);
        params.set("page", "1");
        setSearchParams(params);
    };

    // Switching client drops the employee filter. The previously picked
    // employee normally belongs to a different client, and the API gives
    // `compensation` precedence over `client`, so leaving it in place would
    // list records that contradict the client box.
    const selectClient = (id) => {
        const params = new URLSearchParams(searchParams);
        if (id) params.set("client", id);
        else params.delete("client");
        params.delete("compensation");
        params.set("page", "1");
        setSearchParams(params);
    };

    const clearFilters = () => setSearchParams({ page: "1" });

    const setPage = (page) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", page);
        setSearchParams(params);
    };

    const handleDelete = (payroll) => {
        askConfirm(
            "Delete this payroll? Linked records will be unlinked, not destroyed.",
            async () => {
                try {
                    await customFetch.delete(`/payrolls/${payroll._id}`);
                    toast.success("Payroll deleted");
                    revalidator.revalidate();
                } catch (error) {
                    toast.error(
                        error?.response?.data?.msg ||
                            error?.response?.data?.message ||
                            error.message,
                    );
                }
            },
        );
    };

    const types = { earningTypes, allowanceTypes, deductionTypes, chargeTypes };
    const hasFilters =
        filterCompensation || filterClient || filterFrom || filterTo;

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Payroll
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Total: {totalPayrolls}
                    </p>
                </div>
                {mayEdit && (
                    <div className="flex items-center gap-2">
                        <Link
                            to="/dashboard/payroll/batch"
                            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <FiLayers size={14} />
                            Batch by Client
                        </Link>
                    <button
                        onClick={() => setProcessOpen(true)}
                        className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                    >
                        <FiPlus size={14} />
                        Process Payroll
                    </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1 w-56">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Client
                    </label>
                    <ClientCombobox
                        clients={clients}
                        value={filterClient}
                        onChange={selectClient}
                    />
                </div>
                <div className="flex flex-col gap-1 w-56">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Employee
                    </label>
                    <EmployeeCombobox
                        // Remounts on client change so the box does not keep
                        // displaying an employee from the previous client.
                        key={filterClient}
                        client={filterClient}
                        value={filterCompensation}
                        onChange={(comp) =>
                            applyFilter("compensation", comp?._id ?? "")
                        }
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        From
                    </label>
                    <input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => {
                            // Combined into one setSearchParams call rather than two
                            // applyFilter() calls — applyFilter reads searchParams from
                            // this render's closure, so a second call back-to-back would
                            // build on the stale (pre-"from") params and drop the update.
                            const val = e.target.value;
                            const autoTo = cutoffDateTo(val);
                            const params = new URLSearchParams(searchParams);
                            if (val) params.set("from", val);
                            else params.delete("from");
                            if (autoTo) params.set("to", autoTo);
                            params.set("page", "1");
                            setSearchParams(params);
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        To
                    </label>
                    <input
                        type="date"
                        value={filterTo}
                        onChange={(e) => applyFilter("to", e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
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
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Employee</th>
                            <th className="px-4 py-3 text-left">Period</th>
                            <th className="px-4 py-3 text-left">
                                Payroll Date
                            </th>
                            <th className="px-4 py-3 text-right">Gross Pay</th>
                            <th className="px-4 py-3 text-right">Net Salary</th>
                            <th className="px-4 py-3 text-right">Final Pay</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {payrolls.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-8 text-center text-slate-400"
                                >
                                    No payrolls found.
                                </td>
                            </tr>
                        )}
                        {payrolls.map((p, idx) => (
                            <tr key={p._id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {employeeName(p.compensation)}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {toDate(p.payrollFrom)} –{" "}
                                    {toDate(p.payrollTo)}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {toDate(p.payrollDate)}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600">
                                    {fmt(p.grossPay)}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600">
                                    {fmt(p.netSalary)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                    {fmt(p.finalPay)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setViewItem(p)}
                                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                            title="View"
                                        >
                                            <FiEye size={14} />
                                        </button>
                                        {mayEdit && (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/dashboard/payroll/${p._id}/edit`,
                                                        )
                                                    }
                                                    className="text-blue-500 hover:text-blue-700"
                                                    title="Edit payroll"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleDelete(p)
                                                    }
                                                    className="text-red-400 hover:text-red-600"
                                                    title="Delete payroll"
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

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
            />

            {viewItem && (
                <PayrollDetailModal
                    payroll={viewItem}
                    types={types}
                    editable={false}
                    onClose={() => {
                        setViewItem(null);
                        revalidator.revalidate();
                    }}
                    onUpdated={() => revalidator.revalidate()}
                />
            )}

            {processOpen && (
                <ProcessPayrollModal
                    onClose={() => setProcessOpen(false)}
                    onDone={() => {
                        setProcessOpen(false);
                        revalidator.revalidate();
                    }}
                />
            )}
            {confirmModal}
        </div>
    );
};
export default Payroll;
