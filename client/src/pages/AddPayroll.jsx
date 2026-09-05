import { useState, useEffect, useRef } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { fetchAllPages } from "../../utils/fetchAllPages";

export const loader = async () => {
    try {
        const compensations = await fetchAllPages(
            "/compensations",
            {},
            "compensations",
        );
        return { compensations };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const inputCls =
    "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 bg-slate-50";
const labelCls =
    "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1";

// Semi-monthly cutoff auto-fill: picking the 1st fills "To" with the 15th,
// picking the 16th fills "To" with the last day of the month. Any other
// day is left alone since it isn't the start of a standard cutoff.
const cutoffDateTo = (fromVal) => {
    if (!fromVal) return null;
    const d = new Date(`${fromVal}T00:00:00Z`);
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    if (day === 1) return new Date(Date.UTC(year, month, 15)).toISOString().slice(0, 10);
    if (day === 16) return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    return null;
};

const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "";

const employeeName = (comp) => {
    const emp = comp?.employeeDesignation?.employee;
    if (!emp) return "—";
    return `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "—";
};

const EmployeeCombobox = ({ compensations, value, onChange }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const selected = compensations.find((c) => c._id === value);

    const filtered = query.trim() === ""
        ? compensations
        : compensations.filter((c) => {
            const name = employeeName(c).toLowerCase();
            const code = (c.employeeDesignation?.employee?.employeeCode ?? "").toLowerCase();
            const q = query.toLowerCase();
            return name.includes(q) || code.includes(q);
        });

    const handleSelect = (comp) => { onChange(comp._id); setQuery(""); setOpen(false); };
    const handleClear = () => { onChange(""); setQuery(""); };

    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false); setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const displayValue = open ? query : (selected ? employeeName(selected) : "");

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input type="text" value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search employee…"
                    className={`${inputCls} pr-8`} autoComplete="off" />
                {selected && !open && (
                    <button type="button" onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="Clear">
                        <FiX size={14} />
                    </button>
                )}
            </div>
            {open && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">No employees found.</p>
                    ) : filtered.map((c) => {
                        const code = c.employeeDesignation?.employee?.employeeCode;
                        return (
                            <button key={c._id} type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(c)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 ${value === c._id ? "bg-slate-50 font-semibold" : ""}`}>
                                <span className="text-slate-800 truncate">{employeeName(c)}</span>
                                {code && <span className="text-slate-400 text-xs shrink-0">{code}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const AddPayroll = () => {
    const { compensations } = useLoaderData();
    const navigate = useNavigate();

    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        compensation: "",
        payrollFrom: "",
        payrollTo: "",
    });

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const selected = compensations.find((c) => c._id === form.compensation) || null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await customFetch.post("/payrolls", {
                compensation: form.compensation,
                payrollFrom: form.payrollFrom,
                payrollTo: form.payrollTo,
            });
            toast.success("Payroll processed");
            navigate("/dashboard/payroll");
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
        <div className="max-w-xl">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    ← Back
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Process Payroll</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Computes attendance-based pay and auto-attaches standing records for the period.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Employee / Compensation */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">
                        Employee
                    </p>

                    <div>
                        <label className={labelCls}>Employee / Compensation</label>
                        <EmployeeCombobox
                            compensations={compensations}
                            value={form.compensation}
                            onChange={(val) => setForm((p) => ({ ...p, compensation: val }))}
                        />
                    </div>

                    {selected && (
                        <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">Daily Rate</p>
                                <p className="font-medium text-slate-800">{fmt(selected.dailyRate)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">Monthly Rate</p>
                                <p className="font-medium text-slate-800">{fmt(selected.monthlyRate)}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pay Period */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">
                        Pay Period
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>From</label>
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
                        </div>
                        <div>
                            <label className={labelCls}>To</label>
                            <input
                                type="date"
                                value={form.payrollTo}
                                onChange={set("payrollTo")}
                                required
                                className={inputCls}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
                    >
                        {saving ? "Processing..." : "Process Payroll"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddPayroll;
