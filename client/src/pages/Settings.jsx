import { useState } from "react";
import { redirect, useLoaderData, useRevalidator } from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { Overlay, useConfirm } from "../components";
import { philhealthMonthly, philhealthPerRun } from "@shared/philhealthPremium";
import { runsPerMonth } from "@shared/contributionFactor";

export const loader = async () => {
    try {
        const [{ data: phData }, { data: piData }, { data: sssData }] =
            await Promise.all([
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
const labelCls =
    "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1";

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

const NumInput = ({
    name,
    value,
    onChange,
    placeholder,
    step = "0.01",
    min = "0",
    prefix,
}) => (
    <div className="relative">
        {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                {prefix}
            </span>
        )}
        <input
            type="number"
            name={name}
            value={value ?? ""}
            onChange={onChange}
            placeholder={placeholder}
            step={step}
            min={min}
            className={`${inputCls} ${prefix ? "pl-7" : ""}`}
        />
    </div>
);

/**
 * A rate typed the way it is spoken. These are stored as decimals -- 0.05 for
 * 5% -- and were previously edited that way too, with the unit only hinted at
 * by a "(decimal)" suffix in the label. Typing 5 there meant 500%, silently, so
 * the field now shows and accepts 5 and converts on the way in and out.
 */
const PercentInput = ({ name, value, onChange, placeholder }) => {
    const shown =
        value === "" || value == null ? "" : round4(Number(value) * 100);
    return (
        <div className="relative">
            <input
                type="number"
                name={name}
                value={shown}
                onChange={(e) =>
                    onChange({
                        target: {
                            value:
                                e.target.value === ""
                                    ? ""
                                    : round4(Number(e.target.value) / 100),
                        },
                    })
                }
                placeholder={placeholder}
                step="0.01"
                min="0"
                className={`${inputCls} pr-8`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                %
            </span>
        </div>
    );
};

// Percent conversion lands on values like 0.30000000000000004; the tables hold
// four-decimal rates at most.
function round4(n) {
    return Math.round(Number(n) * 1e4) / 1e4;
}

// A figure the form works out rather than asks for. Shown, not editable, so it
// cannot disagree with the parts it is made of.
const ComputedField = ({ label, value, hint }) => (
    <div>
        <label className={labelCls}>{label}</label>
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 tabular-nums">
            {fmt(value)}
        </div>
        {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
);

const SectionHead = ({ title, note }) => (
    <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {title}
        </p>
        {note && <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>}
    </div>
);

/**
 * One shell for all three editors: a header that stays put, a body that
 * scrolls, and the actions pinned to the bottom. The SSS bracket form runs to
 * thirteen fields, and its Save button used to scroll off the end of it.
 */
const SettingsModal = ({
    open,
    onClose,
    title,
    subtitle,
    onSubmit,
    saving,
    submitLabel,
    children,
}) => (
    <Overlay isOpen={open} onClose={onClose}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[88vh]">
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div>
                    <p className="text-base font-semibold text-slate-800">
                        {title}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-slate-400 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 ml-4 mt-0.5"
                >
                    <FiX size={18} />
                </button>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
                <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    {children}
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                    >
                        {saving ? "Saving…" : submitLabel}
                    </button>
                </div>
            </form>
        </div>
    </Overlay>
);

// ─── PhilHealth calculator ────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
    { value: "monthly", label: "Monthly", run: "per month", unit: "month" },
    { value: "semi-monthly", label: "Semi-monthly", run: "per cutoff", unit: "cutoff" },
    { value: "daily", label: "Daily (paid semi-monthly)", run: "per cutoff", unit: "cutoff" },
    { value: "weekly", label: "Weekly", run: "per week", unit: "week" },
];

const CalcResult = ({ label, value, strong }) => (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {label}
        </p>
        <p
            className={`mt-1 tabular-nums ${strong ? "text-xl font-bold text-slate-900" : "text-lg font-semibold text-slate-700"}`}
        >
            {value}
        </p>
    </div>
);

// Works a salary through the same arithmetic payroll uses
// (@shared/philhealthPremium), on the rate rows above, so what it shows is
// exactly what a payroll would deduct.
const PhilHealthCalculator = ({ rates }) => {
    const years = [...rates].sort((a, b) => b.year - a.year);
    const thisYear = new Date().getFullYear();
    const [salary, setSalary] = useState("");
    const [year, setYear] = useState(
        String((years.find((r) => r.year === thisYear) ?? years[0])?.year ?? ""),
    );
    const [membership, setMembership] = useState("employed");
    const [period, setPeriod] = useState("semi-monthly");

    const rate = years.find((r) => String(r.year) === year) ?? years[0] ?? null;
    const amount = Number(salary);
    const ready = Boolean(rate) && salary !== "" && amount >= 0;

    const monthly = ready ? philhealthMonthly(rate, amount) : null;
    const runs = runsPerMonth(period);
    const perRun = monthly ? philhealthPerRun(monthly, period, 1 / runs) : null;
    const employed = membership === "employed";
    const option = PERIOD_OPTIONS.find((o) => o.value === period);

    let boundNote = null;
    if (monthly && amount < monthly.base)
        boundNote = `Below the ${fmt(monthly.base)} salary floor, so it is computed on the floor.`;
    else if (monthly && amount > monthly.base)
        boundNote = `Above the ${fmt(monthly.base)} salary ceiling, so it is computed on the ceiling.`;

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">
                    PhilHealth Contribution Calculator
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                    Uses the rates above and the same computation as payroll.
                </p>
            </div>

            <div className="p-5 flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="Monthly Basic Salary">
                        <NumInput
                            name="calcSalary"
                            value={salary}
                            onChange={(e) => setSalary(e.target.value)}
                            placeholder="15000"
                            prefix="₱"
                        />
                    </Field>
                    <Field label="Year">
                        <select
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className={inputCls}
                        >
                            {years.map((r) => (
                                <option key={r._id} value={r.year}>
                                    {r.year}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Membership">
                        <select
                            value={membership}
                            onChange={(e) => setMembership(e.target.value)}
                            className={inputCls}
                        >
                            <option value="employed">Employed</option>
                            <option value="self">
                                Self-employed / Individually paying
                            </option>
                        </select>
                    </Field>
                    {employed && (
                        <Field label="Pay Period">
                            <select
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                className={inputCls}
                            >
                                {PERIOD_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}
                </div>

                {!rate && (
                    <p className="text-sm text-slate-400">
                        Add a PhilHealth rate first.
                    </p>
                )}

                {monthly && (
                    <>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                                Per month
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <CalcResult
                                    label="Total Premium"
                                    value={fmt(monthly.premium)}
                                    strong
                                />
                                <CalcResult
                                    label="Employee Share"
                                    value={fmt(employed ? monthly.employee : monthly.premium)}
                                />
                                <CalcResult
                                    label="Employer Share"
                                    value={employed ? fmt(monthly.employer) : "Not applicable"}
                                />
                            </div>
                        </div>

                        {employed && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                                    Payroll deduction {option.run}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <CalcResult
                                        label="Employee"
                                        value={fmt(perRun.employee)}
                                        strong
                                    />
                                    <CalcResult
                                        label="Employer"
                                        value={fmt(perRun.employer)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 flex flex-col gap-1">
                            <p>
                                {fmt(monthly.base)} × {pct(rate.premiumRate)} ={" "}
                                {fmt(monthly.premium)}
                            </p>
                            {boundNote && <p>{boundNote}</p>}
                            {employed ? (
                                <p>
                                    Split {pct(rate.employeeShare)} employee /{" "}
                                    {pct(1 - rate.employeeShare)} employer. Each{" "}
                                    {option.unit} deducts the full share.
                                </p>
                            ) : (
                                <p>A self-employed member pays the whole premium.</p>
                            )}
                            {employed && period !== "monthly" && (
                                <p className="text-xs text-slate-400">
                                    In payroll, the salary above is the {option.unit}
                                    {"'"}s basic pay × {runs}.
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

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

    const cancel = () => {
        setAdding(false);
        setEditId(null);
        setForm(emptyPH());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                year: Number(form.year),
                premiumRate: Number(form.premiumRate),
                employeeShare: Number(form.employeeShare),
                minimumSalaryThreshold: Number(form.minimumSalaryThreshold),
                ...(form.deductionCeiling !== "" && {
                    deductionCeiling: Number(form.deductionCeiling),
                }),
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
            toast.error(
                err?.response?.data?.msg ||
                    err?.response?.data?.message ||
                    err.message,
            );
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
                    <p className="text-sm font-semibold text-slate-700">
                        PhilHealth Premium Rates
                    </p>
                    <button
                        onClick={() => {
                            setAdding(true);
                            setEditId(null);
                            setForm(emptyPH());
                        }}
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
                                <th className="px-5 py-2.5 text-right">
                                    Premium Rate
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    EE Share
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    Min Salary
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    Ceiling
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    EE Contribution*
                                </th>
                                <th className="px-5 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rates.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-6 text-center text-slate-400 text-xs"
                                    >
                                        No rates yet.
                                    </td>
                                </tr>
                            )}
                            {rates.map((r) => (
                                <tr key={r._id} className="hover:bg-slate-50">
                                    <td className="px-5 py-3 font-medium text-slate-800">
                                        {r.year}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {pct(r.premiumRate)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {pct(r.employeeShare)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {fmt(r.minimumSalaryThreshold)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {r.deductionCeiling
                                            ? fmt(r.deductionCeiling)
                                            : "—"}
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                                        {pct(
                                            Number(r.premiumRate) *
                                                Number(r.employeeShare),
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={() => startEdit(r)}
                                                className="text-blue-500 hover:text-blue-700"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(r._id)
                                                }
                                                className="text-red-400 hover:text-red-600"
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
                <p className="text-[11px] text-slate-400 px-5 py-2 border-t border-slate-100">
                    * EE Contribution = Premium Rate × EE Share (e.g. 5% × 50% =
                    2.5% of salary)
                </p>
            </div>

            <PhilHealthCalculator rates={rates} />

            <SettingsModal
                open={adding || !!editId}
                onClose={cancel}
                title={editId ? "Edit PhilHealth Rate" : "Add PhilHealth Rate"}
                subtitle="One rate per year. Payroll uses the row matching the pay period."
                onSubmit={handleSubmit}
                saving={saving}
                submitLabel={editId ? "Update Rate" : "Add Rate"}
            >
                <div>
                    <SectionHead
                        title="Premium"
                        note="The employee pays their share of the premium; the employer pays the rest."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label="Year">
                            <NumInput
                                name="year"
                                value={form.year}
                                onChange={set("year")}
                                step="1"
                                min="2000"
                                placeholder="2026"
                            />
                        </Field>
                        <Field label="Premium Rate">
                            <PercentInput
                                name="premiumRate"
                                value={form.premiumRate}
                                onChange={set("premiumRate")}
                                placeholder="5"
                            />
                        </Field>
                        <Field label="Employee Share">
                            <PercentInput
                                name="employeeShare"
                                value={form.employeeShare}
                                onChange={set("employeeShare")}
                                placeholder="50"
                            />
                        </Field>
                    </div>
                </div>

                <div>
                    <SectionHead
                        title="Salary bounds"
                        note="Salary is raised to the minimum and capped at the ceiling before the premium is applied."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Minimum Salary">
                            <NumInput
                                name="minimumSalaryThreshold"
                                value={form.minimumSalaryThreshold}
                                onChange={set("minimumSalaryThreshold")}
                                placeholder="10000"
                                step="1"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="Ceiling">
                            <NumInput
                                name="deductionCeiling"
                                value={form.deductionCeiling}
                                onChange={set("deductionCeiling")}
                                placeholder="100000"
                                step="1"
                                prefix="₱"
                            />
                        </Field>
                    </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                        What this deducts
                    </p>
                    <p className="text-sm text-slate-700">
                        {pct(
                            Number(form.premiumRate || 0) *
                                Number(form.employeeShare || 0),
                        )}{" "}
                        of salary from the employee
                        {form.minimumSalaryThreshold !== "" &&
                            form.deductionCeiling !== "" &&
                            ` — ${fmt(Number(form.minimumSalaryThreshold) * Number(form.premiumRate || 0) * Number(form.employeeShare || 0))} to ${fmt(Number(form.deductionCeiling) * Number(form.premiumRate || 0) * Number(form.employeeShare || 0))} a month`}
                    </p>
                </div>
            </SettingsModal>
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
    employerMaxContribution: "",
});

const PagIbigTab = ({ rates, onChanged }) => {
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptyPI());
    const [saving, setSaving] = useState(false);
    const { confirmModal: piConfirmModal, askConfirm: piAskConfirm } =
        useConfirm();

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
            percentageRateSalaryThreshold:
                r.percentageRateSalaryThreshold ?? "",
            flatRateMaxDeduction: r.flatRateMaxDeduction ?? "",
            employerMaxContribution: r.employerMaxContribution ?? "",
        });
        setAdding(false);
    };

    const cancel = () => {
        setAdding(false);
        setEditId(null);
        setForm(emptyPI());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const num = (v) => (v !== "" ? Number(v) : undefined);
        try {
            const payload = {
                year: num(form.year),
                incomeCeiling: num(form.incomeCeiling),
                basicEmployeeShare: num(form.basicEmployeeShare),
                basicEmployerShare: num(form.basicEmployerShare),
                overThresholdEmployeeShare: num(
                    form.overThresholdEmployeeShare,
                ),
                overThresholdEmployerShare: num(
                    form.overThresholdEmployerShare,
                ),
                percentageRateSalaryThreshold: num(
                    form.percentageRateSalaryThreshold,
                ),
                flatRateMaxDeduction: num(form.flatRateMaxDeduction),
                employerMaxContribution: num(form.employerMaxContribution),
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
            toast.error(
                err?.response?.data?.msg ||
                    err?.response?.data?.message ||
                    err.message,
            );
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
                    <p className="text-sm font-semibold text-slate-700">
                        Pag-IBIG Contribution Rates
                    </p>
                    <button
                        onClick={() => {
                            setAdding(true);
                            setEditId(null);
                            setForm(emptyPI());
                        }}
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
                                <th className="px-5 py-2.5 text-right">
                                    Income Ceiling
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    EE ≤ Ceiling
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    EE &gt; Ceiling
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    Salary Cap
                                </th>
                                <th className="px-5 py-2.5 text-right">
                                    Max Deduction
                                </th>
                                <th className="px-5 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rates.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-6 text-center text-slate-400 text-xs"
                                    >
                                        No rates yet.
                                    </td>
                                </tr>
                            )}
                            {rates.map((r) => (
                                <tr key={r._id} className="hover:bg-slate-50">
                                    <td className="px-5 py-3 font-medium text-slate-800">
                                        {r.year ?? "—"}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {fmt(r.incomeCeiling)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {pct(r.basicEmployeeShare)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {pct(r.overThresholdEmployeeShare)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-slate-600">
                                        {r.percentageRateSalaryThreshold
                                            ? fmt(
                                                  r.percentageRateSalaryThreshold,
                                              )
                                            : "—"}
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                                        {r.flatRateMaxDeduction
                                            ? fmt(r.flatRateMaxDeduction)
                                            : "—"}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={() => startEdit(r)}
                                                className="text-blue-500 hover:text-blue-700"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(r._id)
                                                }
                                                className="text-red-400 hover:text-red-600"
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

            <SettingsModal
                open={adding || !!editId}
                onClose={cancel}
                title={editId ? "Edit Pag-IBIG Rate" : "Add Pag-IBIG Rate"}
                subtitle="One rate per year. The ceiling decides which pair of shares applies."
                onSubmit={handleSubmit}
                saving={saving}
                submitLabel={editId ? "Update Rate" : "Add Rate"}
            >
                <div>
                    <SectionHead title="Year and ceiling" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Year">
                            <NumInput
                                name="year"
                                value={form.year}
                                onChange={set("year")}
                                step="1"
                                min="2000"
                                placeholder="2026"
                            />
                        </Field>
                        <Field label="Income Ceiling">
                            <NumInput
                                name="incomeCeiling"
                                value={form.incomeCeiling}
                                onChange={set("incomeCeiling")}
                                placeholder="1500"
                                step="1"
                                prefix="₱"
                            />
                        </Field>
                    </div>
                </div>

                <div>
                    <SectionHead
                        title="Monthly pay at or below the ceiling"
                        note="Applied to the whole salary."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Employee Share">
                            <PercentInput
                                name="basicEmployeeShare"
                                value={form.basicEmployeeShare}
                                onChange={set("basicEmployeeShare")}
                                placeholder="1"
                            />
                        </Field>
                        <Field label="Employer Share">
                            <PercentInput
                                name="basicEmployerShare"
                                value={form.basicEmployerShare}
                                onChange={set("basicEmployerShare")}
                                placeholder="2"
                            />
                        </Field>
                    </div>
                </div>

                <div>
                    <SectionHead
                        title="Monthly pay above the ceiling"
                        note="Applied to the salary, but never to more than the salary cap below."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Employee Share">
                            <PercentInput
                                name="overThresholdEmployeeShare"
                                value={form.overThresholdEmployeeShare}
                                onChange={set("overThresholdEmployeeShare")}
                                placeholder="2"
                            />
                        </Field>
                        <Field label="Employer Share">
                            <PercentInput
                                name="overThresholdEmployerShare"
                                value={form.overThresholdEmployerShare}
                                onChange={set("overThresholdEmployerShare")}
                                placeholder="2"
                            />
                        </Field>
                        <Field label="Salary Cap for %">
                            <NumInput
                                name="percentageRateSalaryThreshold"
                                value={form.percentageRateSalaryThreshold}
                                onChange={set("percentageRateSalaryThreshold")}
                                placeholder="5000"
                                step="1"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="Max Employee Deduction">
                            <NumInput
                                name="flatRateMaxDeduction"
                                value={form.flatRateMaxDeduction}
                                onChange={set("flatRateMaxDeduction")}
                                placeholder="200"
                                step="1"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="Max Employer Contribution">
                            <NumInput
                                name="employerMaxContribution"
                                value={form.employerMaxContribution}
                                onChange={set("employerMaxContribution")}
                                placeholder="200"
                                step="1"
                                prefix="₱"
                            />
                        </Field>
                    </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                        What this deducts
                    </p>
                    <p className="text-sm text-slate-700">
                        Above the ceiling:{" "}
                        {fmt(
                            Math.min(
                                Number(
                                    form.percentageRateSalaryThreshold || 0,
                                ) *
                                    Number(
                                        form.overThresholdEmployeeShare || 0,
                                    ),
                                Number(form.flatRateMaxDeduction) ||
                                    Number.POSITIVE_INFINITY,
                            ),
                        )}{" "}
                        a month from the employee
                        {Number(form.flatRateMaxDeduction) > 0 && " (capped)"}
                    </p>
                </div>
            </SettingsModal>
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
    const [filterYear, setFilterYear] = useState(
        years[0] ?? new Date().getFullYear(),
    );
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(emptySSS(filterYear));
    const [saving, setSaving] = useState(false);
    const { confirmModal: sssConfirmModal, askConfirm: sssAskConfirm } =
        useConfirm();

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    // The three totals are arithmetic on the fields above them, and the
    // employee total is what payroll actually deducts. Typing them by hand
    // invited a bracket whose parts and total disagreed, so they are derived
    // here and shown read-only.
    const n = (v) => Number(v) || 0;
    const r2 = (v) => Math.round(v * 100) / 100;
    const eeTotal = r2(n(form.employeeShare) + n(form.employeeMPF));
    const erTotal = r2(
        n(form.employerShare) + n(form.employerEC) + n(form.employerMPF),
    );
    const grandTotal = r2(eeTotal + erTotal);

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

    const cancel = () => {
        setAdding(false);
        setEditId(null);
        setForm(emptySSS(filterYear));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const num = (v) => (v !== "" ? Number(v) : null);
        try {
            const payload = {
                year: Number(form.year),
                msc: Number(form.msc),
                employeeShare: Number(form.employeeShare),
                employerShare: Number(form.employerShare),
                employerEC: Number(form.employerEC),
                totalEmployeeContribution: eeTotal,
                totalEmployerContribution: erTotal,
                totalContribution: grandTotal,
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
            toast.error(
                err?.response?.data?.msg ||
                    err?.response?.data?.message ||
                    err.message,
            );
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
                        <p className="text-sm font-semibold text-slate-700">
                            SSS Contribution Table
                        </p>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 outline-none"
                        >
                            {years.length === 0 && (
                                <option value={new Date().getFullYear()}>
                                    {new Date().getFullYear()}
                                </option>
                            )}
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                        <span className="text-xs text-slate-400">
                            {filtered.length} brackets
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setAdding(true);
                            setEditId(null);
                            setForm(emptySSS(filterYear));
                        }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
                    >
                        <FiPlus size={12} /> Add Bracket
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                <th className="px-4 py-2.5 text-left">
                                    Comp. Range
                                </th>
                                <th className="px-4 py-2.5 text-right">MSC</th>
                                <th className="px-4 py-2.5 text-right">
                                    EE Share
                                </th>
                                <th className="px-4 py-2.5 text-right">
                                    EE MPF
                                </th>
                                <th className="px-4 py-2.5 text-right">
                                    Total EE
                                </th>
                                <th className="px-4 py-2.5 text-right">
                                    ER Share
                                </th>
                                <th className="px-4 py-2.5 text-right">
                                    ER EC
                                </th>
                                <th className="px-4 py-2.5 text-right">
                                    ER MPF
                                </th>
                                <th className="px-4 py-2.5 text-right">
                                    Total ER
                                </th>
                                <th className="px-4 py-2.5 text-right">
                                    Grand Total
                                </th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={11}
                                        className="px-4 py-6 text-center text-slate-400 text-xs"
                                    >
                                        No brackets for this year yet.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((r) => (
                                <tr key={r._id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                                        {r.compensationFrom != null
                                            ? fmt(r.compensationFrom)
                                            : "Below"}{" "}
                                        –{" "}
                                        {r.compensationTo != null
                                            ? fmt(r.compensationTo)
                                            : "Above"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-700">
                                        {fmt(r.msc)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">
                                        {fmt(r.employeeShare)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">
                                        {r.employeeMPF
                                            ? fmt(r.employeeMPF)
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                                        {fmt(r.totalEmployeeContribution)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">
                                        {fmt(r.employerShare)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">
                                        {fmt(r.employerEC)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">
                                        {r.employerMPF
                                            ? fmt(r.employerMPF)
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">
                                        {fmt(r.totalEmployerContribution)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                                        {fmt(r.totalContribution)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={() => startEdit(r)}
                                                className="text-blue-500 hover:text-blue-700"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(r._id)
                                                }
                                                className="text-red-400 hover:text-red-600"
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

            <SettingsModal
                open={adding || !!editId}
                onClose={cancel}
                title={editId ? "Edit SSS Bracket" : "Add SSS Bracket"}
                subtitle="One bracket of the contribution table. Totals are worked out from the parts."
                onSubmit={handleSubmit}
                saving={saving}
                submitLabel={editId ? "Update Bracket" : "Add Bracket"}
            >
                <div>
                    <SectionHead
                        title="Bracket"
                        note="Leave a bound blank for an open-ended first or last row."
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field label="Year">
                            <NumInput
                                name="year"
                                value={form.year}
                                onChange={set("year")}
                                step="1"
                                min="2000"
                            />
                        </Field>
                        <Field label="Comp. From">
                            <NumInput
                                name="compensationFrom"
                                value={form.compensationFrom}
                                onChange={set("compensationFrom")}
                                placeholder="blank = no floor"
                                step="0.01"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="Comp. To">
                            <NumInput
                                name="compensationTo"
                                value={form.compensationTo}
                                onChange={set("compensationTo")}
                                placeholder="blank = no cap"
                                step="0.01"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="MSC">
                            <NumInput
                                name="msc"
                                value={form.msc}
                                onChange={set("msc")}
                                placeholder="4000"
                                step="0.01"
                                prefix="₱"
                            />
                        </Field>
                    </div>
                </div>

                <div>
                    <SectionHead title="Employee" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="Share (SS)">
                            <NumInput
                                name="employeeShare"
                                value={form.employeeShare}
                                onChange={set("employeeShare")}
                                placeholder="200.00"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="MPF">
                            <NumInput
                                name="employeeMPF"
                                value={form.employeeMPF}
                                onChange={set("employeeMPF")}
                                placeholder="0.00"
                                prefix="₱"
                            />
                        </Field>
                        <ComputedField
                            label="Total Employee"
                            value={eeTotal}
                            hint="Share + MPF"
                        />
                    </div>
                </div>

                <div>
                    <SectionHead title="Employer" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field label="Share (SS)">
                            <NumInput
                                name="employerShare"
                                value={form.employerShare}
                                onChange={set("employerShare")}
                                placeholder="380.00"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="EC">
                            <NumInput
                                name="employerEC"
                                value={form.employerEC}
                                onChange={set("employerEC")}
                                placeholder="10.00"
                                prefix="₱"
                            />
                        </Field>
                        <Field label="MPF">
                            <NumInput
                                name="employerMPF"
                                value={form.employerMPF}
                                onChange={set("employerMPF")}
                                placeholder="0.00"
                                prefix="₱"
                            />
                        </Field>
                        <ComputedField
                            label="Total Employer"
                            value={erTotal}
                            hint="Share + EC + MPF"
                        />
                    </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                            Grand Total
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            Employee {fmt(eeTotal)} + employer {fmt(erTotal)}
                        </p>
                    </div>
                    <p className="text-lg font-semibold text-slate-800 tabular-nums">
                        {fmt(grandTotal)}
                    </p>
                </div>
            </SettingsModal>
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
                <p className="text-slate-500 mt-1">
                    Manage government contribution rate tables.
                </p>
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

            {tab === "philhealth" && (
                <PhilHealthTab rates={philHealthRates} onChanged={refresh} />
            )}
            {tab === "pagibig" && (
                <PagIbigTab rates={pagIbigRates} onChanged={refresh} />
            )}
            {tab === "sss" && <SSSTab rates={sssRates} onChanged={refresh} />}
        </div>
    );
};

export default Settings;
