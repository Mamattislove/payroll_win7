import { useState, useEffect } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FiArrowLeft, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { InfoField, useConfirm } from "../components";

export const loader = async ({ params }) => {
    try {
        const { data: payrollData } = await customFetch.get(`/payrolls/${params.id}`);
        const payroll = payrollData.payroll;

        const compId = payroll.compensation?._id ?? payroll.compensation;
        const from = payroll.payrollFrom
            ? new Date(payroll.payrollFrom).toISOString().split("T")[0]
            : "";
        const to = payroll.payrollTo
            ? new Date(payroll.payrollTo).toISOString().split("T")[0]
            : "";

        const [
            { data: earningTypeData },
            { data: allowanceTypeData },
            { data: chargeTypeData },
            { data: attendanceData },
        ] = await Promise.all([
            customFetch.get(`/earning-types?limit=1000`),
            customFetch.get(`/allowance-types?limit=1000`),
            customFetch.get(`/charge-types?limit=1000`),
            customFetch.get(
                `/attendances?compensation=${compId}&dateFrom=${from}&dateTo=${to}&limit=1000&sort=asc`,
            ),
        ]);

        return {
            payroll,
            earningTypes: earningTypeData.earningTypes || [],
            allowanceTypes: allowanceTypeData.allowanceTypes || [],
            chargeTypes: chargeTypeData.chargeTypes || [],
            attendances: attendanceData.attendances || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const inputCls =
    "w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 bg-white";

const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const toDate = (val) =>
    val
        ? new Date(val).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
        : "—";

const toShortDate = (val) =>
    val
        ? new Date(val).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
        : "—";

const employeeName = (comp) => {
    const emp = comp?.employeeDesignation?.employee;
    if (!emp) return "—";
    return `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "—";
};

const DAY_TYPE_COLOR = {
    "Regular": "bg-slate-100 text-slate-600",
    "Absent": "bg-red-100 text-red-600",
    "Rest Day (OFF / Absent)": "bg-red-100 text-red-600",
    "Leave": "bg-amber-100 text-amber-700",
    "Leave With Pay": "bg-green-100 text-green-700",
    "Leave Half Day": "bg-amber-100 text-amber-700",
    "Special / Rest Day": "bg-purple-100 text-purple-700",
    "Legal Holiday": "bg-blue-100 text-blue-700",
    "Double Holiday (Legal + Legal)": "bg-blue-100 text-blue-700",
    "Special + Rest Day": "bg-purple-100 text-purple-700",
    "Legal Regular Pay": "bg-blue-100 text-blue-700",
    "Legal 3x Pay": "bg-blue-100 text-blue-700",
    "Legal + RD 2x Pay": "bg-blue-100 text-blue-700",
    "Legal + RD Regular Pay": "bg-blue-100 text-blue-700",
    "Legal + RD 3x Pay": "bg-blue-100 text-blue-700",
};

// ─── record section ────────────────────────────────────────────────────────────

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
                error?.response?.data?.msg || error?.response?.data?.message || error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = (recordId) => {
        askConfirm(`Remove this ${title.toLowerCase()} from the payroll?`, async () => {
            try {
                const remainingIds = records.filter((r) => r._id !== recordId).map((r) => r._id);
                const key = endpoint.replace("/", "").replace("-records", "s");
                await customFetch.patch(`/payrolls/${payrollId}`, { [key]: remainingIds });
                toast.success(`${title} removed`);
                onChanged();
            } catch (error) {
                toast.error(
                    error?.response?.data?.msg || error?.response?.data?.message || error.message,
                );
            }
        });
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {title} — {fmt(total)}
                </p>
                <button
                    type="button"
                    onClick={() => setAdding((v) => !v)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                    {adding ? "Cancel" : "Add"}
                </button>
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">No {title.toLowerCase()} linked.</p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li key={r._id} className="flex items-center justify-between py-1.5 text-sm">
                        <div>
                            <span className="text-slate-800">{r.name}</span>
                            <span className="text-slate-400 ml-2 text-xs">
                                {r[typeKey]?.[typeLabelKey] ?? ""}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">{fmt(r.amount)}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(r._id)}
                                className="text-red-400 hover:text-red-600"
                            >
                                <FiTrash2 size={13} />
                            </button>
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
                        <input name="name" placeholder="Name" required className={inputCls} />
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

const DeductionSection = ({ records, employeeId, payrollId, onChanged }) => {
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirmModal: dedConfirmModal, askConfirm: dedAskConfirm } = useConfirm();
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
        const rec = existingRecords.find((r) => r._id === e.target.value) || null;
        setSelectedRecord(rec);
        setAmount(rec?.monthlyDeduction ? String(rec.monthlyDeduction) : rec?.currentAmount != null ? String(rec.currentAmount) : "");
    };

    const handleAdd = async (e) => {
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
                error?.response?.data?.msg || error?.response?.data?.message || error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = (paymentId) => {
        dedAskConfirm("Remove this deduction payment from the payroll?", async () => {
            try {
                await customFetch.delete(`/deduction-payments/${paymentId}`);
                toast.success("Deduction removed");
                onChanged();
            } catch (error) {
                toast.error(
                    error?.response?.data?.msg || error?.response?.data?.message || error.message,
                );
            }
        });
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Deductions — {fmt(total)}
                </p>
                <button
                    type="button"
                    onClick={adding ? closeAdd : openAdd}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                    {adding ? "Cancel" : "Add"}
                </button>
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">No deductions linked.</p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li key={r._id} className="flex items-center justify-between py-1.5 text-sm">
                        <div>
                            <span className="text-slate-800">{r.deductionRecord?.name}</span>
                            <span className="text-slate-400 ml-2 text-xs">
                                {r.deductionRecord?.deductionType?.deductionName ?? ""}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">{fmt(r.amount)}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(r._id)}
                                className="text-red-400 hover:text-red-600"
                            >
                                <FiTrash2 size={13} />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {adding && (
                <form onSubmit={handleAdd} className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    {loadingRecords ? (
                        <p className="text-xs text-slate-400 py-1">Loading records…</p>
                    ) : (
                        <select
                            required
                            value={selectedRecord?._id ?? ""}
                            onChange={handleRecordSelect}
                            className={inputCls}
                        >
                            <option value="">— Select deduction record —</option>
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

const LoanSection = ({ records, employeeId, payrollId, onChanged }) => {
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
            l ? String(Math.min(l.monthlyAmortization || 0, l.loanPayable || 0)) : "",
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
                error?.response?.data?.msg || error?.response?.data?.message || error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = (paymentId) => {
        askConfirm("Remove this loan payment from the payroll? The balance will be restored.", async () => {
            try {
                await customFetch.delete(`/loan-payments/${paymentId}`);
                toast.success("Loan payment removed");
                onChanged();
            } catch (error) {
                toast.error(
                    error?.response?.data?.msg || error?.response?.data?.message || error.message,
                );
            }
        });
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Loan Payments — {fmt(total)}
                </p>
                <button
                    type="button"
                    onClick={adding ? closeAdd : openAdd}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                    {adding ? "Cancel" : "Add"}
                </button>
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">No loan payments linked.</p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li key={r._id} className="flex items-center justify-between py-1.5 text-sm">
                        <div>
                            <span className="text-slate-800">{r.loan?.loanName || "Loan"}</span>
                            {r.loan?.loanType?.loanTypeName && (
                                <span className="text-slate-400 ml-2 text-xs">
                                    {r.loan.loanType.loanTypeName}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">{fmt(r.amount)}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(r._id)}
                                className="text-red-400 hover:text-red-600"
                            >
                                <FiTrash2 size={13} />
                            </button>
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
                        <p className="text-xs text-slate-400 py-1">Loading loans…</p>
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
                                    {l.loanType?.loanTypeName ? ` (${l.loanType.loanTypeName})` : ""}
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

const SavingsSection = ({ records, employeeId, payrollId, onChanged }) => {
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
        setAmount(s?.cutoffDeductionAmount != null ? String(s.cutoffDeductionAmount) : "");
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
                error?.response?.data?.msg || error?.response?.data?.message || error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = (paymentId) => {
        askConfirm("Remove this savings deduction from the payroll?", async () => {
            try {
                await customFetch.delete(`/savings-records/${paymentId}`);
                toast.success("Savings deduction removed");
                onChanged();
            } catch (error) {
                toast.error(
                    error?.response?.data?.msg || error?.response?.data?.message || error.message,
                );
            }
        });
    };

    return (
        <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Savings — {fmt(total)}
                </p>
                <button
                    type="button"
                    onClick={adding ? closeAdd : openAdd}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    {adding ? <FiX size={12} /> : <FiPlus size={12} />}
                    {adding ? "Cancel" : "Add"}
                </button>
            </div>

            {records.length === 0 && !adding && (
                <p className="text-xs text-slate-400 py-2">No savings linked.</p>
            )}

            <ul className="divide-y divide-slate-100">
                {records.map((r) => (
                    <li key={r._id} className="flex items-center justify-between py-1.5 text-sm">
                        <div>
                            <span className="text-slate-800">Savings</span>
                            {r.savings?.savingsTarget != null && (
                                <span className="text-slate-400 ml-2 text-xs">
                                    Target: {fmt(r.savings.savingsTarget)}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700">{fmt(r.amount)}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(r._id)}
                                className="text-red-400 hover:text-red-600"
                            >
                                <FiTrash2 size={13} />
                            </button>
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
                        <p className="text-xs text-slate-400 py-1">Loading savings plans…</p>
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

// ─── payroll date section ─────────────────────────────────────────────────────

const PayrollDateSection = ({ payroll, onChanged }) => {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [date, setDate] = useState("");

    const toDateInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

    useEffect(() => {
        setDate(toDateInput(payroll.payrollDate));
    }, [payroll]);

    const cancel = () => {
        setDate(toDateInput(payroll.payrollDate));
        setEditing(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await customFetch.patch(`/payrolls/${payroll._id}`, { payrollDate: date || null });
            toast.success("Payroll date saved");
            setEditing(false);
            onChanged();
        } catch (error) {
            toast.error(
                error?.response?.data?.msg || error?.response?.data?.message || error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Payroll Date
                </p>
                {!editing ? (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        <FiEdit2 size={11} />
                        Edit
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={cancel}
                            className="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="text-xs px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                )}
            </div>
            {editing ? (
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputCls}
                />
            ) : (
                <p className="text-sm font-medium text-slate-700">
                    {toDate(payroll.payrollDate) || "—"}
                </p>
            )}
        </div>
    );
};

// ─── gov contribution section ────────────────────────────────────────────────

const GOV_EE_FIELDS = [
    { key: "sssContribution", label: "SSS" },
    { key: "philhealthContribution", label: "PhilHealth" },
    { key: "pagibigContribution", label: "Pag-IBIG" },
    { key: "withholdingTax", label: "Withholding Tax" },
];

const GOV_ER_FIELDS = [
    { key: "sssEmployerContribution", label: "SSS" },
    { key: "philhealthEmployerContribution", label: "PhilHealth" },
    { key: "pagibigEmployerContribution", label: "Pag-IBIG" },
];

const GovContributionSection = ({ payroll, onChanged }) => {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({});

    useEffect(() => {
        setForm({
            sssContribution: payroll.sssContribution ?? 0,
            philhealthContribution: payroll.philhealthContribution ?? 0,
            pagibigContribution: payroll.pagibigContribution ?? 0,
            withholdingTax: payroll.withholdingTax ?? 0,
            sssEmployerContribution: payroll.sssEmployerContribution ?? 0,
            philhealthEmployerContribution: payroll.philhealthEmployerContribution ?? 0,
            pagibigEmployerContribution: payroll.pagibigEmployerContribution ?? 0,
        });
    }, [payroll]);

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const cancel = () => {
        setEditing(false);
        setForm({
            sssContribution: payroll.sssContribution ?? 0,
            philhealthContribution: payroll.philhealthContribution ?? 0,
            pagibigContribution: payroll.pagibigContribution ?? 0,
            withholdingTax: payroll.withholdingTax ?? 0,
            sssEmployerContribution: payroll.sssEmployerContribution ?? 0,
            philhealthEmployerContribution: payroll.philhealthEmployerContribution ?? 0,
            pagibigEmployerContribution: payroll.pagibigEmployerContribution ?? 0,
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await customFetch.patch(`/payrolls/${payroll._id}`, {
                sssContribution: Number(form.sssContribution),
                philhealthContribution: Number(form.philhealthContribution),
                pagibigContribution: Number(form.pagibigContribution),
                withholdingTax: Number(form.withholdingTax),
                sssEmployerContribution: Number(form.sssEmployerContribution),
                philhealthEmployerContribution: Number(form.philhealthEmployerContribution),
                pagibigEmployerContribution: Number(form.pagibigEmployerContribution),
            });
            toast.success("Contributions saved");
            setEditing(false);
            onChanged();
        } catch (error) {
            toast.error(
                error?.response?.data?.msg || error?.response?.data?.message || error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Government Contributions
                </p>
                {!editing ? (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                        <FiEdit2 size={11} />
                        Edit
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={cancel}
                            className="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="text-xs px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                )}
            </div>

            {editing ? (
                <div className="flex flex-col gap-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Employee Deductions</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {GOV_EE_FIELDS.map(({ key, label }) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                                        {label}
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={form[key] ?? 0}
                                        onChange={set(key)}
                                        className={inputCls}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Employer Share</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {GOV_ER_FIELDS.map(({ key, label }) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                                        {label}
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={form[key] ?? 0}
                                        onChange={set(key)}
                                        className={inputCls}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Employee Deductions</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                            {GOV_EE_FIELDS.map(({ key, label }) => (
                                <InfoField key={key} label={label} value={fmt(payroll[key])} />
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Employer Share</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                            {GOV_ER_FIELDS.map(({ key, label }) => (
                                <InfoField key={key} label={label} value={fmt(payroll[key])} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── attendance panel ─────────────────────────────────────────────────────────

const fmtPay = (v) =>
    v ? `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : null;

const PayRow = ({ label, hours, pay, negative }) =>
    hours > 0 || (pay && Number(pay) > 0) ? (
        <div className="flex items-center justify-between text-xs">
            <span className={negative ? "text-red-500" : "text-slate-500"}>
                {label}
                {hours > 0 && (
                    <span className="ml-1 text-slate-400">({hours}h)</span>
                )}
            </span>
            <span className={negative ? "text-red-500 font-medium" : "text-slate-700 font-medium"}>
                {negative ? "−" : ""}{fmtPay(pay) ?? "—"}
            </span>
        </div>
    ) : null;

const AttendancePanel = ({ attendances }) => {
    const n = (v) => Number(v) || 0;

    const grandTotal = attendances.reduce((sum, a) => {
        return (
            sum +
            n(a.regularHoursPay) +
            n(a.overtimeHoursPay) +
            n(a.nightPremiumPay) +
            n(a.overtimeNightPremiumPay) -
            n(a.lateDeduction) -
            n(a.undertimeDeduction)
        );
    }, 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Attendance
                </p>
                <span className="text-xs text-slate-500 font-medium">
                    {attendances.length} records
                </span>
            </div>

            {attendances.length === 0 ? (
                <p className="text-xs text-slate-400 p-4">
                    No attendance records for this period.
                </p>
            ) : (
                <>
                    <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                        {attendances.map((a) => {
                            const colorCls =
                                DAY_TYPE_COLOR[a.dayType] || "bg-slate-100 text-slate-600";

                            const regPay   = n(a.regularHoursPay);
                            const otPay    = n(a.overtimeHoursPay);
                            const ndPay    = n(a.nightPremiumPay);
                            const ndotPay  = n(a.overtimeNightPremiumPay);
                            const lateDed  = n(a.lateDeduction);
                            const utDed    = n(a.undertimeDeduction);

                            const dayTotal = regPay + otPay + ndPay + ndotPay - lateDed - utDed;

                            return (
                                <div key={a._id} className="px-4 py-3 flex flex-col gap-1.5">
                                    {/* Date + badge */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-800">
                                            {toShortDate(a.attendanceDate)}
                                        </span>
                                        <span
                                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colorCls}`}
                                        >
                                            {a.dayType ?? "—"}
                                        </span>
                                    </div>

                                    {/* Time In / Out */}
                                    {(a.timeIn || a.timeOut) && (
                                        <p className="text-xs text-slate-400">
                                            {a.timeIn ?? "—"} → {a.timeOut ?? "—"}
                                        </p>
                                    )}

                                    {/* Remarks */}
                                    {a.remarks && (
                                        <p className="text-[11px] text-slate-400 italic">
                                            {a.remarks}
                                        </p>
                                    )}

                                    {/* Pay breakdown */}
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                        <PayRow
                                            label="Reg"
                                            hours={n(a.regularHours)}
                                            pay={a.regularHoursPay}
                                        />
                                        <PayRow
                                            label="OT"
                                            hours={n(a.overtimeHours)}
                                            pay={a.overtimeHoursPay}
                                        />
                                        <PayRow
                                            label="ND"
                                            hours={n(a.nightPremiumHours)}
                                            pay={a.nightPremiumPay}
                                        />
                                        <PayRow
                                            label="NDOT"
                                            hours={n(a.overtimeNightPremiumHours)}
                                            pay={a.overtimeNightPremiumPay}
                                        />
                                        <PayRow
                                            label="Late"
                                            hours={n(a.lateHr)}
                                            pay={a.lateDeduction}
                                            negative
                                        />
                                        <PayRow
                                            label="UT"
                                            hours={n(a.undertimeHr)}
                                            pay={a.undertimeDeduction}
                                            negative
                                        />
                                    </div>

                                    {/* Day total */}
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                            Total
                                        </span>
                                        <span
                                            className={`text-sm font-semibold ${
                                                dayTotal >= 0 ? "text-slate-800" : "text-red-500"
                                            }`}
                                        >
                                            {fmtPay(dayTotal) ?? "₱0.00"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Grand total footer */}
                    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Period Total
                        </span>
                        <span className="text-sm font-bold text-slate-800">
                            {fmtPay(grandTotal) ?? "₱0.00"}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

// ─── page ─────────────────────────────────────────────────────────────────────

const EditPayroll = () => {
    const {
        payroll: initial,
        earningTypes,
        allowanceTypes,
        chargeTypes,
        attendances,
    } = useLoaderData();
    const navigate = useNavigate();
    const [payroll, setPayroll] = useState(initial);

    const refresh = async () => {
        const { data } = await customFetch.get(`/payrolls/${payroll._id}`);
        setPayroll(data.payroll);
    };

    const employeeId =
        payroll.compensation?.employeeDesignation?.employee?._id ??
        payroll.compensation?.employeeDesignation?.employee;

    const attendanceFields = [
        { label: "Regular Pay", value: fmt(payroll.regularPay) },
        { label: "Regular OT Pay", value: fmt(payroll.regularOTPay) },
        { label: "Holiday/Rest Day Pay", value: fmt(payroll.holidayRestDayPay) },
        { label: "Holiday/RD OT Pay", value: fmt(payroll.holidayRestDayOTPay) },
        { label: "Night Differential Pay", value: fmt(payroll.nightDifferentialPay) },
        { label: "Leave With Pay", value: fmt(payroll.leavePay) },
        { label: "Days Worked", value: (Number(payroll.daysWorked) || 0).toFixed(2) },
        { label: "Absences", value: fmt(payroll.absences) },
        { label: "Late", value: fmt(payroll.late) },
        { label: "Undertime", value: fmt(payroll.undertime) },
    ];

    const totalFields = [
        { label: "Gross Pay", value: fmt(payroll.grossPay) },
        { label: "Total Deductions", value: fmt(payroll.totalDeductions) },
        { label: "Net Salary", value: fmt(payroll.netSalary) },
        { label: "Final Pay", value: fmt(payroll.finalPay) },
    ];

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <FiArrowLeft size={15} />
                    Back
                </button>
                <div className="h-5 w-px bg-slate-200" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Edit Payroll</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {employeeName(payroll.compensation)} —{" "}
                        {toDate(payroll.payrollFrom)} to {toDate(payroll.payrollTo)}
                    </p>
                </div>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    Editing
                </span>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
                {/* Left — edit cards */}
                <div className="flex flex-col gap-6">
                    {/* Payroll Date */}
                    <PayrollDateSection payroll={payroll} onChanged={refresh} />

                    {/* Attendance-Based Pay */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-4">
                            Attendance-Based Pay
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                            {attendanceFields.map((f) => (
                                <InfoField key={f.label} label={f.label} value={f.value} />
                            ))}
                        </div>
                    </div>

                    {/* Government Contributions */}
                    <GovContributionSection payroll={payroll} onChanged={refresh} />

                    {/* Linked Records */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-4">
                            Linked Records
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <RecordSection
                                title="Earnings"
                                records={payroll.earning || []}
                                types={earningTypes}
                                typeKey="earningType"
                                typeLabelKey="earningName"
                                endpoint="/earning-records"
                                employeeId={employeeId}
                                payrollId={payroll._id}
                                onChanged={refresh}
                            />
                            <RecordSection
                                title="Allowances"
                                records={payroll.allowances || []}
                                types={allowanceTypes}
                                typeKey="allowanceType"
                                typeLabelKey="allowanceName"
                                endpoint="/allowance-records"
                                employeeId={employeeId}
                                payrollId={payroll._id}
                                onChanged={refresh}
                            />
                            <DeductionSection
                                records={payroll.deductions || []}
                                employeeId={employeeId}
                                payrollId={payroll._id}
                                onChanged={refresh}
                            />
                            <LoanSection
                                records={payroll.loans || []}
                                employeeId={employeeId}
                                payrollId={payroll._id}
                                onChanged={refresh}
                            />
                            <SavingsSection
                                records={payroll.savings || []}
                                employeeId={employeeId}
                                payrollId={payroll._id}
                                onChanged={refresh}
                            />
                            <RecordSection
                                title="Charges"
                                records={payroll.charges || []}
                                types={chargeTypes}
                                typeKey="chargeType"
                                typeLabelKey="chargeName"
                                endpoint="/charge-records"
                                employeeId={employeeId}
                                payrollId={payroll._id}
                                onChanged={refresh}
                            />
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-4">
                            Totals
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                            {totalFields.map((f) => (
                                <InfoField key={f.label} label={f.label} value={f.value} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right — attendance panel */}
                <AttendancePanel attendances={attendances} />
            </div>
        </div>
    );
};

export default EditPayroll;
