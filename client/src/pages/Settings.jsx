import { useState } from "react";
import { redirect, useLoaderData, useRevalidator } from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { Overlay, useConfirm } from "../components";

export const loader = async () => {
    try {
        const [
            { data: phData },
            { data: piData },
            { data: sssData },
        ] = await Promise.all([
            customFetch.get("/philhealth-rates?limit=100"),
            customFetch.get("/pagibig-rates?limit=100"),
            customFetch.get("/sss-rates?limit=1000"),
        ]);
        return {
            philHealthRates: phData.philHealthRates || [],
            pagIbigRates: piData.pagIbigRates || [],
            sssRates: sssData.sssRates || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// ─── shared ───────────────────────────────────────────────────────────────────

const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 bg-slate-50";
const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1";

const fmt = (v) =>
    v !== undefined && v !== null
        ? `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const pct = (v) =>
    v !== undefined && v !== null ? `${(Number(v) * 100).toFixed(2)}%` : "—";

const Field = ({ label, children }) => (
    <div>
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

const NumInput = ({ name, value, onChange, placeholder, step = "0.01", min = "0" }) => (
    <input
        type="number"
        name={name}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        min={min}
        className={inputCls}
    />
);

// ─── PhilHealth tab ───────────────────────────────────────────────────────────

const emptyPH = () => ({
    year: new Date().getFullYear(),
    premiumRate: "",
    employeeShare: "",
    minimumSalaryThreshold: "",
    deductionCeiling: "",
});

const PhilHealthTab = ({ rates, onChanged }) => {
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptyPH());
    const [saving, setSaving] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const startEdit = (r) => {
        setEditId(r._id);
        setForm({
            year: r.year,
            premiumRate: r.premiumRate,
            employeeShare: r.employeeShare,
            minimumSalaryThreshold: r.minimumSalaryThreshold,
            deductionCeiling: r.deductionCeiling ?? "",
        });
        setAdding(false);
    };

    const cancel = () => { setAdding(false); setEditId(null); setForm(emptyPH()); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                year: Number(form.year),
                premiumRate: Number(form.premiumRate),
                employeeShare: Number(form.employeeShare),
                minimumSalaryThreshold: Number(form.minimumSalaryThreshold),
                ...(form.deductionCeiling !== "" && { deductionCeiling: Number(form.deductionCeiling) }),
            };
            if (editId) {
                await customFetch.patch(`/philhealth-rates/${editId}`, payload);
                toast.success("PhilHealth rate updated");
            } else {
                await customFetch.post("/philhealth-rates", payload);
                toast.success("PhilHealth rate added");
            }
            cancel();
            onChanged();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id) => {
        askConfirm("Delete this PhilHealth rate?", async () => {
            try {
                await customFetch.delete(`/philhealth-rates/${id}`);
                toast.success("Deleted");
                onChanged();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err.message);
            }
        });
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">PhilHealth Premium Rates</p>
                    <button
                        onClick={() => { setAdding(true); setEditId(null); setForm(emptyPH()); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
                    >
                        <FiPlus size={12} /> Add Rate
                    </button>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                            <th className="px-5 py-2.5 text-left">Year</th>
                            <th className="px-5 py-2.5 text-right">Premium Rate</th>
                            <th className="px-5 py-2.5 text-right">EE Share</th>
                            <th className="px-5 py-2.5 text-right">Min Salary</th>
                            <th className="px-5 py-2.5 text-right">Ceiling</th>
                            <th className="px-5 py-2.5 text-right">EE Contribution*</th>
                            <th className="px-5 py-2.5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rates.length === 0 && (
                            <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-400 text-xs">No rates yet.</td></tr>
                        )}
                        {rates.map((r) => (
                            <tr key={r._id} className="hover:bg-slate-50">
                                <td className="px-5 py-3 font-medium text-slate-800">{r.year}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{pct(r.premiumRate)}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{pct(r.employeeShare)}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{fmt(r.minimumSalaryThreshold)}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{r.deductionCeiling ? fmt(r.deductionCeiling) : "—"}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-800">
                                    {pct(Number(r.premiumRate) * Number(r.employeeShare))}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2 justify-end">
                                        <button onClick={() => startEdit(r)} className="text-blue-500 hover:text-blue-700"><FiEdit2 size={13} /></button>
                                        <button onClick={() => handleDelete(r._id)} className="text-red-400 hover:text-red-600"><FiTrash2 size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                <p className="text-[11px] text-slate-400 px-5 py-2 border-t border-slate-100">
                    * EE Contribution = Premium Rate × EE Share (e.g. 5% × 50% = 2.5% of salary)
                </p>
            </div>

            <Overlay isOpen={adding || !!editId} onClose={cancel}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-slate-700">{editId ? "Edit Rate" : "Add PhilHealth Rate"}</p>
                        <button onClick={cancel} className="text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <Field label="Year">
                            <NumInput name="year" value={form.year} onChange={set("year")} step="1" min="2000" placeholder="2026" />
                        </Field>
                        <Field label="Premium Rate (decimal)">
                            <NumInput name="premiumRate" value={form.premiumRate} onChange={set("premiumRate")} placeholder="0.05" />
                        </Field>
                        <Field label="EE Share (decimal)">
                            <NumInput name="employeeShare" value={form.employeeShare} onChange={set("employeeShare")} placeholder="0.5" />
                        </Field>
                        <Field label="Min Salary">
                            <NumInput name="minimumSalaryThreshold" value={form.minimumSalaryThreshold} onChange={set("minimumSalaryThreshold")} placeholder="10000" step="1" />
                        </Field>
                        <Field label="Ceiling (optional)">
                            <NumInput name="deductionCeiling" value={form.deductionCeiling} onChange={set("deductionCeiling")} placeholder="100000" step="1" />
                        </Field>
                        <div className="col-span-full flex gap-2 pt-1">
                            <button type="button" onClick={cancel} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60">
                                {saving ? "Saving…" : editId ? "Update" : "Add"}
                            </button>
                        </div>
                    </form>
                </div>
            </Overlay>
            {confirmModal}
        </div>
    );
};

// ─── Pag-IBIG tab ─────────────────────────────────────────────────────────────

const emptyPI = () => ({
    year: new Date().getFullYear(),
    incomeCeiling: "",
    basicEmployeeShare: "",
    basicEmployerShare: "",
    overThresholdEmployeeShare: "",
    overThresholdEmployerShare: "",
    percentageRateSalaryThreshold: "",
    flatRateMaxDeduction: "",
});

const PagIbigTab = ({ rates, onChanged }) => {
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptyPI());
    const [saving, setSaving] = useState(false);
    const { confirmModal: piConfirmModal, askConfirm: piAskConfirm } = useConfirm();

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const startEdit = (r) => {
        setEditId(r._id);
        setForm({
            year: r.year ?? "",
            incomeCeiling: r.incomeCeiling ?? "",
            basicEmployeeShare: r.basicEmployeeShare ?? "",
            basicEmployerShare: r.basicEmployerShare ?? "",
            overThresholdEmployeeShare: r.overThresholdEmployeeShare ?? "",
            overThresholdEmployerShare: r.overThresholdEmployerShare ?? "",
            percentageRateSalaryThreshold: r.percentageRateSalaryThreshold ?? "",
            flatRateMaxDeduction: r.flatRateMaxDeduction ?? "",
        });
        setAdding(false);
    };

    const cancel = () => { setAdding(false); setEditId(null); setForm(emptyPI()); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const num = (v) => v !== "" ? Number(v) : undefined;
        try {
            const payload = {
                year: num(form.year),
                incomeCeiling: num(form.incomeCeiling),
                basicEmployeeShare: num(form.basicEmployeeShare),
                basicEmployerShare: num(form.basicEmployerShare),
                overThresholdEmployeeShare: num(form.overThresholdEmployeeShare),
                overThresholdEmployerShare: num(form.overThresholdEmployerShare),
                percentageRateSalaryThreshold: num(form.percentageRateSalaryThreshold),
                flatRateMaxDeduction: num(form.flatRateMaxDeduction),
            };
            if (editId) {
                await customFetch.patch(`/pagibig-rates/${editId}`, payload);
                toast.success("Pag-IBIG rate updated");
            } else {
                await customFetch.post("/pagibig-rates", payload);
                toast.success("Pag-IBIG rate added");
            }
            cancel();
            onChanged();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id) => {
        piAskConfirm("Delete this Pag-IBIG rate?", async () => {
            try {
                await customFetch.delete(`/pagibig-rates/${id}`);
                toast.success("Deleted");
                onChanged();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err.message);
            }
        });
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">Pag-IBIG Contribution Rates</p>
                    <button
                        onClick={() => { setAdding(true); setEditId(null); setForm(emptyPI()); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
                    >
                        <FiPlus size={12} /> Add Rate
                    </button>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                            <th className="px-5 py-2.5 text-left">Year</th>
                            <th className="px-5 py-2.5 text-right">Income Ceiling</th>
                            <th className="px-5 py-2.5 text-right">EE ≤ Ceiling</th>
                            <th className="px-5 py-2.5 text-right">EE &gt; Ceiling</th>
                            <th className="px-5 py-2.5 text-right">Salary Cap</th>
                            <th className="px-5 py-2.5 text-right">Max Deduction</th>
                            <th className="px-5 py-2.5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rates.length === 0 && (
                            <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-400 text-xs">No rates yet.</td></tr>
                        )}
                        {rates.map((r) => (
                            <tr key={r._id} className="hover:bg-slate-50">
                                <td className="px-5 py-3 font-medium text-slate-800">{r.year ?? "—"}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{fmt(r.incomeCeiling)}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{pct(r.basicEmployeeShare)}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{pct(r.overThresholdEmployeeShare)}</td>
                                <td className="px-5 py-3 text-right text-slate-600">{r.percentageRateSalaryThreshold ? fmt(r.percentageRateSalaryThreshold) : "—"}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-800">{r.flatRateMaxDeduction ? fmt(r.flatRateMaxDeduction) : "—"}</td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2 justify-end">
                                        <button onClick={() => startEdit(r)} className="text-blue-500 hover:text-blue-700"><FiEdit2 size={13} /></button>
                                        <button onClick={() => handleDelete(r._id)} className="text-red-400 hover:text-red-600"><FiTrash2 size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            <Overlay isOpen={adding || !!editId} onClose={cancel}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-slate-700">{editId ? "Edit Rate" : "Add Pag-IBIG Rate"}</p>
                        <button onClick={cancel} className="text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <Field label="Year">
                            <NumInput name="year" value={form.year} onChange={set("year")} step="1" min="2000" placeholder="2026" />
                        </Field>
                        <Field label="Income Ceiling">
                            <NumInput name="incomeCeiling" value={form.incomeCeiling} onChange={set("incomeCeiling")} placeholder="1500" step="1" />
                        </Field>
                        <Field label="EE Share ≤ Ceiling (decimal)">
                            <NumInput name="basicEmployeeShare" value={form.basicEmployeeShare} onChange={set("basicEmployeeShare")} placeholder="0.01" />
                        </Field>
                        <Field label="ER Share ≤ Ceiling (decimal)">
                            <NumInput name="basicEmployerShare" value={form.basicEmployerShare} onChange={set("basicEmployerShare")} placeholder="0.02" />
                        </Field>
                        <Field label="EE Share &gt; Ceiling (decimal)">
                            <NumInput name="overThresholdEmployeeShare" value={form.overThresholdEmployeeShare} onChange={set("overThresholdEmployeeShare")} placeholder="0.02" />
                        </Field>
                        <Field label="ER Share &gt; Ceiling (decimal)">
                            <NumInput name="overThresholdEmployerShare" value={form.overThresholdEmployerShare} onChange={set("overThresholdEmployerShare")} placeholder="0.02" />
                        </Field>
                        <Field label="Salary Cap for %">
                            <NumInput name="percentageRateSalaryThreshold" value={form.percentageRateSalaryThreshold} onChange={set("percentageRateSalaryThreshold")} placeholder="5000" step="1" />
                        </Field>
                        <Field label="Max EE Deduction">
                            <NumInput name="flatRateMaxDeduction" value={form.flatRateMaxDeduction} onChange={set("flatRateMaxDeduction")} placeholder="100" step="1" />
                        </Field>
                        <div className="col-span-full flex gap-2 pt-1">
                            <button type="button" onClick={cancel} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60">
                                {saving ? "Saving…" : editId ? "Update" : "Add"}
                            </button>
                        </div>
                    </form>
                </div>
            </Overlay>
            {piConfirmModal}
        </div>
    );
};

// ─── SSS tab ──────────────────────────────────────────────────────────────────

const emptySSS = (year) => ({
    year: year || new Date().getFullYear(),
    compensationFrom: "",
    compensationTo: "",
    msc: "",
    employeeShare: "",
    employeeMPF: "",
    employerShare: "",
    employerEC: "",
    employerMPF: "",
    totalEmployeeContribution: "",
    totalEmployerContribution: "",
    totalContribution: "",
});

const SSSTab = ({ rates, onChanged }) => {
    const years = [...new Set(rates.map((r) => r.year))].sort((a, b) => b - a);
    const [filterYear, setFilterYear] = useState(years[0] ?? new Date().getFullYear());
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptySSS(filterYear));
    const [saving, setSaving] = useState(false);
    const { confirmModal: sssConfirmModal, askConfirm: sssAskConfirm } = useConfirm();

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const filtered = rates.filter((r) => r.year === Number(filterYear));

    const startEdit = (r) => {
        setEditId(r._id);
        setForm({
            year: r.year,
            compensationFrom: r.compensationFrom ?? "",
            compensationTo: r.compensationTo ?? "",
            msc: r.msc,
            employeeShare: r.employeeShare,
            employeeMPF: r.employeeMPF ?? "",
            employerShare: r.employerShare,
            employerEC: r.employerEC,
            employerMPF: r.employerMPF ?? "",
            totalEmployeeContribution: r.totalEmployeeContribution,
            totalEmployerContribution: r.totalEmployerContribution,
            totalContribution: r.totalContribution,
        });
        setAdding(false);
    };

    const cancel = () => { setAdding(false); setEditId(null); setForm(emptySSS(filterYear)); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const num = (v) => v !== "" ? Number(v) : null;
        try {
            const payload = {
                year: Number(form.year),
                msc: Number(form.msc),
                employeeShare: Number(form.employeeShare),
                employerShare: Number(form.employerShare),
                employerEC: Number(form.employerEC),
                totalEmployeeContribution: Number(form.totalEmployeeContribution),
                totalEmployerContribution: Number(form.totalEmployerContribution),
                totalContribution: Number(form.totalContribution),
                compensationFrom: num(form.compensationFrom),
                compensationTo: num(form.compensationTo),
                employeeMPF: num(form.employeeMPF) ?? 0,
                employerMPF: num(form.employerMPF) ?? 0,
            };
            if (editId) {
                await customFetch.patch(`/sss-rates/${editId}`, payload);
                toast.success("SSS bracket updated");
            } else {
                await customFetch.post("/sss-rates", payload);
                toast.success("SSS bracket added");
                setFilterYear(Number(form.year));
            }
            cancel();
            onChanged();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id) => {
        sssAskConfirm("Delete this SSS bracket?", async () => {
            try {
                await customFetch.delete(`/sss-rates/${id}`);
                toast.success("Deleted");
                onChanged();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err.message);
            }
        });
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-slate-700">SSS Contribution Table</p>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 outline-none"
                        >
                            {years.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <span className="text-xs text-slate-400">{filtered.length} brackets</span>
                    </div>
                    <button
                        onClick={() => { setAdding(true); setEditId(null); setForm(emptySSS(filterYear)); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
                    >
                        <FiPlus size={12} /> Add Bracket
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                <th className="px-4 py-2.5 text-left">Comp. Range</th>
                                <th className="px-4 py-2.5 text-right">MSC</th>
                                <th className="px-4 py-2.5 text-right">EE Share</th>
                                <th className="px-4 py-2.5 text-right">EE MPF</th>
                                <th className="px-4 py-2.5 text-right">Total EE</th>
                                <th className="px-4 py-2.5 text-right">ER Share</th>
                                <th className="px-4 py-2.5 text-right">ER EC</th>
                                <th className="px-4 py-2.5 text-right">ER MPF</th>
                                <th className="px-4 py-2.5 text-right">Total ER</th>
                                <th className="px-4 py-2.5 text-right">Grand Total</th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 && (
                                <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-400 text-xs">No brackets for this year yet.</td></tr>
                            )}
                            {filtered.map((r) => (
                                <tr key={r._id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                                        {r.compensationFrom != null ? fmt(r.compensationFrom) : "Below"} – {r.compensationTo != null ? fmt(r.compensationTo) : "Above"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-700">{fmt(r.msc)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.employeeShare)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{r.employeeMPF ? fmt(r.employeeMPF) : "—"}</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmt(r.totalEmployeeContribution)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.employerShare)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.employerEC)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{r.employerMPF ? fmt(r.employerMPF) : "—"}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.totalEmployerContribution)}</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmt(r.totalContribution)}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button onClick={() => startEdit(r)} className="text-blue-500 hover:text-blue-700"><FiEdit2 size={13} /></button>
                                            <button onClick={() => handleDelete(r._id)} className="text-red-400 hover:text-red-600"><FiTrash2 size={13} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Overlay isOpen={adding || !!editId} onClose={cancel}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-slate-700">{editId ? "Edit SSS Bracket" : "Add SSS Bracket"}</p>
                        <button onClick={cancel} className="text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            <Field label="Year">
                                <NumInput name="year" value={form.year} onChange={set("year")} step="1" min="2000" />
                            </Field>
                            <Field label="Comp. From (blank = none)">
                                <NumInput name="compensationFrom" value={form.compensationFrom} onChange={set("compensationFrom")} placeholder="blank = first row" step="0.01" />
                            </Field>
                            <Field label="Comp. To (blank = none)">
                                <NumInput name="compensationTo" value={form.compensationTo} onChange={set("compensationTo")} placeholder="blank = last row" step="0.01" />
                            </Field>
                            <Field label="MSC">
                                <NumInput name="msc" value={form.msc} onChange={set("msc")} placeholder="4000" step="0.01" />
                            </Field>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Employee</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                <Field label="EE Share (SS)">
                                    <NumInput name="employeeShare" value={form.employeeShare} onChange={set("employeeShare")} placeholder="200.00" />
                                </Field>
                                <Field label="EE MPF">
                                    <NumInput name="employeeMPF" value={form.employeeMPF} onChange={set("employeeMPF")} placeholder="0.00" />
                                </Field>
                                <Field label="Total EE Contribution">
                                    <NumInput name="totalEmployeeContribution" value={form.totalEmployeeContribution} onChange={set("totalEmployeeContribution")} placeholder="200.00" />
                                </Field>
                            </div>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Employer</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                <Field label="ER Share (SS)">
                                    <NumInput name="employerShare" value={form.employerShare} onChange={set("employerShare")} placeholder="380.00" />
                                </Field>
                                <Field label="ER EC">
                                    <NumInput name="employerEC" value={form.employerEC} onChange={set("employerEC")} placeholder="10.00" />
                                </Field>
                                <Field label="ER MPF">
                                    <NumInput name="employerMPF" value={form.employerMPF} onChange={set("employerMPF")} placeholder="0.00" />
                                </Field>
                                <Field label="Total ER Contribution">
                                    <NumInput name="totalEmployerContribution" value={form.totalEmployerContribution} onChange={set("totalEmployerContribution")} placeholder="390.00" />
                                </Field>
                            </div>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                <Field label="Grand Total">
                                    <NumInput name="totalContribution" value={form.totalContribution} onChange={set("totalContribution")} placeholder="590.00" />
                                </Field>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={cancel} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60">
                                {saving ? "Saving…" : editId ? "Update" : "Add Bracket"}
                            </button>
                        </div>
                    </form>
                </div>
            </Overlay>
            {sssConfirmModal}
        </div>
    );
};

// ─── main page ────────────────────────────────────────────────────────────────

const TABS = [
    { key: "philhealth", label: "PhilHealth" },
    { key: "pagibig", label: "Pag-IBIG" },
    { key: "sss", label: "SSS" },
];

const Settings = () => {
    const { philHealthRates, pagIbigRates, sssRates } = useLoaderData();
    const revalidator = useRevalidator();
    const [tab, setTab] = useState("philhealth");

    const refresh = () => revalidator.revalidate();

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
                <p className="text-slate-500 mt-1">Manage government contribution rate tables.</p>
            </div>

            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            tab === t.key
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "philhealth" && <PhilHealthTab rates={philHealthRates} onChanged={refresh} />}
            {tab === "pagibig" && <PagIbigTab rates={pagIbigRates} onChanged={refresh} />}
            {tab === "sss" && <SSSTab rates={sssRates} onChanged={refresh} />}
        </div>
    );
};

export default Settings;
