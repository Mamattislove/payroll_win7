import { useState } from "react";
import { Link, redirect, useLoaderData, useRouteLoaderData } from "react-router-dom";
import { toast } from "react-toastify";
import { FiArrowLeft, FiAlertTriangle, FiCheck, FiPlay } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { canWrite } from "../../../utils/permissions";
import { ClientCombobox } from "../components";
import ErrorState, { ACTION_PRIMARY } from "../components/common/ErrorState";

export const loader = async () => {
    try {
        const { data } = await customFetch.get("/clients?limit=1000");
        return { clients: data.clients || [] };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls =
    "text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1 block";

// Picking the 1st fills "to" with the 15th; picking the 16th fills it with the
// last day of the month. Anything else is left alone -- it is not the start of
// a standard cutoff. Same rule the reports use.
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

const STATUS = {
    ready: {
        label: "Ready",
        cls: "bg-green-100 text-green-700",
    },
    "no-attendance": {
        label: "No attendance",
        cls: "bg-amber-100 text-amber-700",
    },
    "already-generated": {
        label: "Already generated",
        cls: "bg-slate-100 text-slate-500",
    },
};

const StatusBadge = ({ status }) => {
    const s = STATUS[status] ?? STATUS.ready;
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
            {s.label}
        </span>
    );
};

const Tile = ({ label, value, tone = "" }) => (
    <div className="px-4 py-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-lg font-semibold mt-0.5 ${tone || "text-slate-800"}`}>
            {value}
        </p>
    </div>
);

const BatchPayroll = () => {
    const { clients } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const mayGenerate = canWrite("payrolls", user?.role);

    const [filter, setFilter] = useState({
        clientId: "",
        payrollFrom: "",
        payrollTo: "",
        payrollDate: "",
    });
    const [preview, setPreview] = useState(null);
    const [selected, setSelected] = useState(() => new Set());
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    const setFrom = (value) => {
        const to = cutoffDateTo(value);
        setFilter((f) => ({ ...f, payrollFrom: value, ...(to && { payrollTo: to }) }));
    };

    const loadPreview = async (e) => {
        e.preventDefault();
        setError("");
        setResult(null);
        setLoading(true);
        try {
            const params = new URLSearchParams({
                client: filter.clientId,
                payrollFrom: filter.payrollFrom,
                payrollTo: filter.payrollTo,
            });
            const { data } = await customFetch.get(`/payrolls/batch-preview?${params}`);
            setPreview(data);
            // Employees with timekeeping are ticked; the ones without are not,
            // so nobody generates an empty payroll without meaning to.
            setSelected(
                new Set(
                    data.rows
                        .filter((r) => r.status === "ready")
                        .map((r) => String(r.compensation)),
                ),
            );
        } catch (err) {
            setPreview(null);
            setError(
                err?.response?.data?.msg ||
                    err?.response?.data?.message ||
                    "Could not load the preview.",
            );
        } finally {
            setLoading(false);
        }
    };

    const toggleRow = (id) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const selectable = (preview?.rows ?? []).filter(
        (r) => r.status !== "already-generated",
    );
    const allSelected =
        selectable.length > 0 && selectable.every((r) => selected.has(String(r.compensation)));

    const toggleAll = () =>
        setSelected(
            allSelected
                ? new Set()
                : new Set(selectable.map((r) => String(r.compensation))),
        );

    const generate = async () => {
        setGenerating(true);
        setError("");
        try {
            const { data } = await customFetch.post("/payrolls/batch", {
                payrollFrom: filter.payrollFrom,
                payrollTo: filter.payrollTo,
                ...(filter.payrollDate && { payrollDate: filter.payrollDate }),
                compensations: [...selected],
            });
            setResult(data);
            toast.success(data.msg);
            // Re-read so the table shows what was just generated.
            const params = new URLSearchParams({
                client: filter.clientId,
                payrollFrom: filter.payrollFrom,
                payrollTo: filter.payrollTo,
            });
            const { data: fresh } = await customFetch.get(
                `/payrolls/batch-preview?${params}`,
            );
            setPreview(fresh);
            setSelected(new Set());
        } catch (err) {
            setError(
                err?.response?.data?.msg ||
                    err?.response?.data?.message ||
                    "The batch could not be completed.",
            );
        } finally {
            setGenerating(false);
        }
    };

    if (!mayGenerate)
        return (
            <ErrorState
                inline
                code="403"
                title="You cannot generate payroll"
                message="Your account can view payroll records but not create them. Ask an administrator if you need this access."
            >
                <Link to="/dashboard/payroll" className={ACTION_PRIMARY}>
                    Back to payroll
                </Link>
            </ErrorState>
        );

    const canPreview = filter.clientId && filter.payrollFrom && filter.payrollTo;

    return (
        <div>
            <div className="mb-6 flex items-center gap-3">
                <Link
                    to="/dashboard/payroll"
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <FiArrowLeft size={16} />
                    Back
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Batch Payroll
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Generate a whole client&rsquo;s payroll for one cutoff.
                    </p>
                </div>
            </div>

            <form
                onSubmit={loadPreview}
                className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end"
            >
                <div className="flex flex-col gap-1 w-full sm:w-72">
                    <label className={labelCls}>Client</label>
                    <ClientCombobox
                        clients={clients}
                        value={filter.clientId}
                        onChange={(val) => setFilter((f) => ({ ...f, clientId: val }))}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Period From</label>
                    <input
                        type="date"
                        value={filter.payrollFrom}
                        onChange={(e) => setFrom(e.target.value)}
                        className={inputCls}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Period To</label>
                    <input
                        type="date"
                        value={filter.payrollTo}
                        onChange={(e) =>
                            setFilter((f) => ({ ...f, payrollTo: e.target.value }))
                        }
                        className={inputCls}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Payroll Date</label>
                    <input
                        type="date"
                        value={filter.payrollDate}
                        onChange={(e) =>
                            setFilter((f) => ({ ...f, payrollDate: e.target.value }))
                        }
                        className={inputCls}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!canPreview || loading}
                    className="px-4 py-2.5 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    {loading ? "Loading…" : "Preview"}
                </button>
            </form>

            {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
                    {error}
                </p>
            )}

            {result && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4">
                    <p className="font-medium">{result.msg}</p>
                    {result.skipped?.length > 0 && (
                        <p className="mt-1 text-green-700">
                            {result.skipped.length} skipped (already had a payroll for
                            this period).
                        </p>
                    )}
                    {result.failed?.length > 0 && (
                        <p className="mt-1 text-red-700">
                            {result.failed.length} failed:{" "}
                            {result.failed[0].reason}
                            {result.failed.length > 1 ? " …" : ""}
                        </p>
                    )}
                </div>
            )}

            {preview && (
                <>
                    <div className="bg-white rounded-xl border border-slate-200 mb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                            <Tile label="Employees" value={preview.total} />
                            <Tile
                                label="Ready"
                                value={preview.counts.ready}
                                tone="text-green-700"
                            />
                            <Tile
                                label="No attendance"
                                value={preview.counts.noAttendance}
                                tone={
                                    preview.counts.noAttendance > 0
                                        ? "text-amber-600"
                                        : ""
                                }
                            />
                            <Tile
                                label="Already generated"
                                value={preview.counts.alreadyGenerated}
                                tone="text-slate-400"
                            />
                        </div>
                    </div>

                    {preview.counts.noAttendance > 0 && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4 flex items-start gap-2.5">
                            <FiAlertTriangle
                                className="text-amber-600 mt-0.5 shrink-0"
                                size={16}
                            />
                            <p className="text-sm text-amber-800">
                                <span className="font-medium">
                                    {preview.counts.noAttendance} employee(s) have no
                                    timekeeping for this period.
                                </span>{" "}
                                They are left unticked. Generating them anyway produces
                                a payroll with no attendance pay, which fills in by
                                itself once the timekeeping is keyed in.
                            </p>
                        </div>
                    )}

                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 mb-4 text-sm text-slate-600">
                        {preview.deductsLoans
                            ? "This is the second cutoff, so loan amortisation will be deducted."
                            : "This is the first cutoff, so no loan amortisation is deducted."}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left w-10">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            className="w-4 h-4 rounded border-slate-300 accent-slate-700"
                                            title="Select all"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left">Code</th>
                                    <th className="px-4 py-3 text-left">Employee</th>
                                    <th className="px-4 py-3 text-right">Days</th>
                                    <th className="px-4 py-3 text-right">Hours</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {preview.rows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-8 text-center text-slate-400"
                                        >
                                            No active employees for this client.
                                        </td>
                                    </tr>
                                )}
                                {preview.rows.map((row) => {
                                    const id = String(row.compensation);
                                    const done = row.status === "already-generated";
                                    return (
                                        <tr
                                            key={id}
                                            className={done ? "bg-slate-50" : "hover:bg-slate-50"}
                                        >
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(id)}
                                                    onChange={() => toggleRow(id)}
                                                    disabled={done}
                                                    className="w-4 h-4 rounded border-slate-300 accent-slate-900 disabled:opacity-40"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {row.employeeCode || "—"}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {row.employeeName}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">
                                                {row.attendanceDays}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">
                                                {row.attendanceHours}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={row.status} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-slate-500">
                            <FiCheck className="inline mb-0.5 mr-1" size={14} />
                            {selected.size} of {selectable.length} selected
                        </p>
                        <button
                            type="button"
                            onClick={generate}
                            disabled={generating || selected.size === 0}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            <FiPlay size={14} />
                            {generating
                                ? `Generating ${selected.size}…`
                                : `Generate ${selected.size} Payroll(s)`}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
export default BatchPayroll;
