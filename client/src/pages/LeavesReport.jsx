import { useState } from "react";
import { redirect, useLoaderData } from "react-router-dom";
import { FiDownload } from "react-icons/fi";
import {
    Document,
    Page,
    View,
    Text,
    Image,
    StyleSheet,
    pdf,
} from "@react-pdf/renderer";
import customFetch from "../../utils/customFetch";
import { LEAVE_STATUS, LEAVE_HALFDAY } from "../../../utils/constants";
import { ClientCombobox, DepartmentSelect } from "../components";
import logo from "../assets/ynl.png";

export const loader = async () => {
    try {
        const { data } = await customFetch.get("/clients?limit=1000");
        return { clients: data.clients || [] };
    } catch (e) {
        if (e?.response?.status === 401) return redirect("/login");
        throw e;
    }
};

// ─── helpers ─────────────────────────────────────────────────────────────────

// The API hands these over as ISO strings, but the same rows read straight from
// Mongo arrive as Date objects. Slicing a Date's string form yields "Tue Aug 10"
// and parses to Invalid Date, which silently became 0 days on every line, so
// both shapes are normalised to a UTC midnight timestamp here.
const asUTCDay = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return null;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// "Aug. 16, 2026" — the form the printed reports use, which en-PH's short
// month ("Aug") does not produce on its own.
const fmtCovered = (v) => {
    const t = asUTCDay(v);
    if (t == null) return "—";
    const d = new Date(t);
    const month = d.toLocaleDateString("en-PH", {
        month: "short",
        timeZone: "UTC",
    });
    return `${month}. ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

const fmtDay = (v) => {
    const t = asUTCDay(v);
    return t == null
        ? "—"
        : new Date(t).toLocaleDateString("en-PH", {
              month: "short",
              day: "2-digit",
              year: "numeric",
              timeZone: "UTC",
          });
};

const f1 = (n) =>
    (+n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

// Semi-monthly cutoff auto-fill: picking the 1st fills "To" with the 15th,
// picking the 16th fills "To" with the last day of the month.
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Inclusive calendar days: a leave dated the 3rd to the 5th is three days, and
// a one-day leave is one. Rest days are not subtracted — the application holds
// no schedule, so this counts the days applied for, not days actually worked.
const leaveDays = (l) => {
    const from = asUTCDay(l.dateFrom);
    const to = asUTCDay(l.dateTo ?? l.dateFrom);
    if (from == null || to == null) return 0;
    const span = Math.floor((to - from) / DAY_MS) + 1;
    if (span < 1) return 0;
    return l.halfday === LEAVE_HALFDAY.HALF_DAY ? span / 2 : span;
};

function buildRows(leaves) {
    return leaves
        .map((l) => ({
            code: l.employee?.employeeCode || "—",
            name: l.employee
                ? `${l.employee.lastName}, ${l.employee.firstName}`
                : "—",
            type: l.leaveType?.leaveTypeName || "—",
            from: l.dateFrom,
            to: l.dateTo,
            days: leaveDays(l),
            pay: l.withPay || "—",
            status: l.status || "—",
        }))
        .sort(
            (a, b) =>
                a.name.localeCompare(b.name) ||
                String(a.from).localeCompare(String(b.from)),
        );
}

const sumDays = (rows) => rows.reduce((s, r) => s + r.days, 0);

// ─── PDF ──────────────────────────────────────────────────────────────────────

const W = { num: 24, code: 56, type: 104, date: 68, days: 40, pay: 66 };

const S = StyleSheet.create({
    page: {
        fontFamily: "Helvetica",
        fontSize: 8,
        paddingTop: 24,
        paddingBottom: 28,
        paddingHorizontal: 30,
    },
    header: { textAlign: "center", marginBottom: 10 },
    logo: {
        width: 34,
        height: 34,
        objectFit: "contain",
        alignSelf: "center",
        marginBottom: 3,
    },
    coName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
    coAddr: { fontSize: 7.5, color: "#475569", marginBottom: 1 },
    rptTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 4 },
    rptDate: { fontSize: 7.5, color: "#475569", marginTop: 1 },
    metaRow: { flexDirection: "row", marginBottom: 5, fontSize: 8 },
    metaBold: { fontFamily: "Helvetica-Bold" },
    row: { flexDirection: "row" },
    th: {
        backgroundColor: "#1e3a5f",
        color: "#ffffff",
        borderWidth: 0.5,
        borderColor: "#4a6f9f",
        borderStyle: "solid",
        padding: 3.5,
        justifyContent: "center",
    },
    thText: { fontFamily: "Helvetica-Bold", fontSize: 7 },
    td: {
        borderWidth: 0.5,
        borderColor: "#c8d3e0",
        borderStyle: "solid",
        paddingHorizontal: 3,
        paddingVertical: 3,
    },
    tdEven: { backgroundColor: "#ffffff" },
    tdOdd: { backgroundColor: "#f4f7fb" },
    tdR: { fontSize: 7.5, textAlign: "right" },
    tdL: { fontSize: 7.5 },
    tdC: { fontSize: 7, textAlign: "center", color: "#475569" },
    gt: { backgroundColor: "#1e3a5f" },
    gtLabel: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8 },
    gtAmt: {
        color: "#ffffff",
        fontFamily: "Helvetica-Bold",
        fontSize: 8,
        textAlign: "right",
    },
    empty: { fontSize: 8, color: "#64748b", textAlign: "center", padding: 14 },
});

const LeavesPDF = ({ report }) => {
    const { rows, clientName, departmentName, dateFrom, dateTo, statusLabel } = report;

    return (
        <Document>
            <Page size="A4" style={S.page}>
                <View style={S.header}>
                    <Image src={logo} style={S.logo} />
                    <Text style={S.coName}>
                        YAMAN NG LAHI LABOR SERVICE COOPERATIVE
                    </Text>
                    <Text style={S.coAddr}>
                        Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas,
                        Bulacan
                    </Text>
                    <Text style={S.rptTitle}>LEAVES REPORT</Text>
                    <Text style={S.rptDate}>
                        Date Covered: {fmtCovered(dateFrom)} -{" "}
                        {fmtCovered(dateTo)}
                    </Text>
                </View>

                <View style={S.metaRow}>
                    <Text>
                        CLIENT: <Text style={S.metaBold}>{clientName}</Text>
                    </Text>
                    <Text>
                        {"   "}DEPARTMENT:{" "}
                        <Text style={S.metaBold}>
                            {departmentName || "ALL"}
                        </Text>
                    </Text>
                    <Text>
                        {"   "}STATUS:{" "}
                        <Text style={S.metaBold}>{statusLabel}</Text>
                    </Text>
                </View>

                <View style={S.row} fixed>
                    <View style={[S.th, { width: W.num }]}>
                        <Text style={S.thText}>#</Text>
                    </View>
                    <View style={[S.th, { width: W.code }]}>
                        <Text style={S.thText}>Code</Text>
                    </View>
                    <View style={[S.th, { flex: 1 }]}>
                        <Text style={S.thText}>Employee Name</Text>
                    </View>
                    <View style={[S.th, { width: W.type }]}>
                        <Text style={S.thText}>Leave Type</Text>
                    </View>
                    <View style={[S.th, { width: W.date }]}>
                        <Text style={S.thText}>From</Text>
                    </View>
                    <View style={[S.th, { width: W.date }]}>
                        <Text style={S.thText}>To</Text>
                    </View>
                    <View style={[S.th, { width: W.days }]}>
                        <Text style={S.thText}>Days</Text>
                    </View>
                    <View style={[S.th, { width: W.pay }]}>
                        <Text style={S.thText}>Pay</Text>
                    </View>
                </View>

                {rows.length === 0 ? (
                    <Text style={S.empty}>
                        No leaves for this client and period.
                    </Text>
                ) : (
                    rows.map((row, i) => {
                        const bg = i % 2 === 0 ? S.tdEven : S.tdOdd;
                        return (
                            <View key={i} style={S.row} wrap={false}>
                                <View style={[S.td, bg, { width: W.num }]}>
                                    <Text style={S.tdC}>{i + 1}</Text>
                                </View>
                                <View style={[S.td, bg, { width: W.code }]}>
                                    <Text style={S.tdL}>{row.code}</Text>
                                </View>
                                <View style={[S.td, bg, { flex: 1 }]}>
                                    <Text style={S.tdL}>{row.name}</Text>
                                </View>
                                <View style={[S.td, bg, { width: W.type }]}>
                                    <Text style={S.tdL}>{row.type}</Text>
                                </View>
                                <View style={[S.td, bg, { width: W.date }]}>
                                    <Text style={S.tdC}>{fmtDay(row.from)}</Text>
                                </View>
                                <View style={[S.td, bg, { width: W.date }]}>
                                    <Text style={S.tdC}>{fmtDay(row.to)}</Text>
                                </View>
                                <View style={[S.td, bg, { width: W.days }]}>
                                    <Text style={S.tdR}>{f1(row.days)}</Text>
                                </View>
                                <View style={[S.td, bg, { width: W.pay }]}>
                                    <Text style={S.tdC}>{row.pay}</Text>
                                </View>
                            </View>
                        );
                    })
                )}

                {rows.length > 0 && (
                    <View style={[S.row, S.gt]}>
                        <View style={[S.td, S.gt, { width: W.num }]}>
                            <Text style={S.gtLabel}> </Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.code }]}>
                            <Text style={S.gtLabel}>TOTAL</Text>
                        </View>
                        <View style={[S.td, S.gt, { flex: 1 }]}>
                            <Text style={S.gtLabel}> </Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.type }]}>
                            <Text style={S.gtLabel}> </Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.date }]}>
                            <Text style={S.gtLabel}> </Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.date }]}>
                            <Text style={S.gtLabel}> </Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.days }]}>
                            <Text style={S.gtAmt}>{f1(sumDays(rows))}</Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.pay }]}>
                            <Text style={S.gtLabel}> </Text>
                        </View>
                    </View>
                )}
            </Page>
        </Document>
    );
};

// ─── Screen table ─────────────────────────────────────────────────────────────

const Th = ({ children, right }) => (
    <th
        className={`bg-slate-800 text-white text-[8.5px] font-semibold uppercase tracking-wide px-2 py-1.5 border border-slate-600 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
        {children}
    </th>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const LeavesReport = () => {
    const { clients } = useLoaderData();
    const [filter, setFilter] = useState({
        clientId: "",
        departmentId: "",
        departmentName: "",
        dateFrom: "",
        dateTo: "",
        status: LEAVE_STATUS.APPROVED,
    });
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [error, setError] = useState("");

    const generate = async (e) => {
        e.preventDefault();
        if (!filter.clientId) {
            setError("Please select a client.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                client: filter.clientId,
                from: filter.dateFrom,
                to: filter.dateTo,
                limit: 10000,
                sort: "dateFrom",
            });
            if (filter.departmentId)
                params.set("department", filter.departmentId);
            if (filter.status) params.set("status", filter.status);
            const { data } = await customFetch.get(
                `/leave-applications?${params}`,
            );
            setReport({
                rows: buildRows(data.leaveApplications || []),
                clientName:
                    clients.find((c) => c._id === filter.clientId)
                        ?.clientName ?? "",
                departmentName: filter.departmentName,
                dateFrom: filter.dateFrom,
                dateTo: filter.dateTo,
                statusLabel: filter.status ? filter.status : "ALL",
            });
        } catch {
            setError("Failed to load leave data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        if (!report) return;
        setPdfLoading(true);
        try {
            const blob = await pdf(<LeavesPDF report={report} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `leaves-report-${report.dateFrom}-to-${report.dateTo}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setError("Failed to generate PDF. Please try again.");
        } finally {
            setPdfLoading(false);
        }
    };

    const inputCls =
        "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
    const labelCls =
        "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";

    return (
        <>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 mb-4">
                    Leaves Report
                </h1>
                <form
                    onSubmit={generate}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap gap-4 items-end shadow-sm"
                >
                    <div className="flex-1 min-w-52">
                        <label className={labelCls}>Client</label>
                        <ClientCombobox
                            clients={clients}
                            value={filter.clientId}
                            onChange={(id) =>
                                setFilter((p) => ({
                                    ...p,
                                    clientId: id,
                                    departmentId: "",
                                    departmentName: "",
                                }))
                            }
                        />
                    </div>
                    <div className="min-w-44">
                        <label className={labelCls}>Department</label>
                        <DepartmentSelect
                            clientId={filter.clientId}
                            value={filter.departmentId}
                            onChange={(id, name) =>
                                setFilter((p) => ({
                                    ...p,
                                    departmentId: id,
                                    departmentName: name,
                                }))
                            }
                            className={`${inputCls} disabled:opacity-60`}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Date From</label>
                        <input
                            type="date"
                            required
                            value={filter.dateFrom}
                            onChange={(e) => {
                                const val = e.target.value;
                                const autoTo = cutoffDateTo(val);
                                setFilter((p) => ({
                                    ...p,
                                    dateFrom: val,
                                    ...(autoTo && { dateTo: autoTo }),
                                }));
                            }}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Date To</label>
                        <input
                            type="date"
                            required
                            value={filter.dateTo}
                            onChange={(e) =>
                                setFilter((p) => ({
                                    ...p,
                                    dateTo: e.target.value,
                                }))
                            }
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Status</label>
                        <select
                            value={filter.status}
                            onChange={(e) =>
                                setFilter((p) => ({
                                    ...p,
                                    status: e.target.value,
                                }))
                            }
                            className={inputCls}
                        >
                            {Object.values(LEAVE_STATUS).map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                            <option value="">all</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-60 transition-colors"
                    >
                        {loading ? "Generating…" : "Generate"}
                    </button>
                    {report && report.rows.length > 0 && (
                        <button
                            type="button"
                            onClick={downloadPDF}
                            disabled={pdfLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
                        >
                            <FiDownload className="text-base" />
                            {pdfLoading ? "Building PDF…" : "Download PDF"}
                        </button>
                    )}
                </form>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>

            {report && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <div className="text-center mb-4 pb-4 border-b border-slate-200">
                        <p
                            className="font-bold text-sm uppercase tracking-widest"
                            style={{ fontFamily: "Georgia, serif" }}
                        >
                            Yaman ng Lahi Labor Service Cooperative
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas,
                            Bulacan
                        </p>
                        <p className="font-bold text-sm mt-2">LEAVES REPORT</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Date Covered: {fmtCovered(report.dateFrom)} -{" "}
                            {fmtCovered(report.dateTo)}
                        </p>
                    </div>
                    <p className="text-xs mb-3">
                        CLIENT: <strong>{report.clientName}</strong>
                        <span className="ml-6">
                            DEPARTMENT:{" "}
                            <strong>{report.departmentName || "ALL"}</strong>
                        </span>
                        <span className="ml-6">
                            STATUS: <strong>{report.statusLabel}</strong>
                        </span>
                    </p>

                    <div
                        className="overflow-x-auto bg-white"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        <table className="border-collapse min-w-full">
                            <thead>
                                <tr>
                                    <Th>#</Th>
                                    <Th>Code</Th>
                                    <Th>Employee Name</Th>
                                    <Th>Leave Type</Th>
                                    <Th>From</Th>
                                    <Th>To</Th>
                                    <Th right>Days</Th>
                                    <Th>Pay</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.rows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="text-center py-10 text-slate-400 text-sm"
                                        >
                                            No leaves for this client and
                                            period.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {report.rows.map((row, i) => (
                                            <tr
                                                key={i}
                                                className={
                                                    i % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-slate-50"
                                                }
                                            >
                                                <td className="px-2 py-1 text-center text-[9.5px] border border-slate-200 font-semibold text-slate-400">
                                                    {i + 1}
                                                </td>
                                                <td className="px-2 py-1 text-[9.5px] border border-slate-200 whitespace-nowrap font-mono text-slate-500">
                                                    {row.code}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] font-semibold border border-slate-200 whitespace-nowrap">
                                                    {row.name}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] border border-slate-200 whitespace-nowrap text-slate-600">
                                                    {row.type}
                                                </td>
                                                <td className="px-2 py-1 text-center text-[9.5px] border border-slate-200 whitespace-nowrap text-slate-500">
                                                    {fmtDay(row.from)}
                                                </td>
                                                <td className="px-2 py-1 text-center text-[9.5px] border border-slate-200 whitespace-nowrap text-slate-500">
                                                    {fmtDay(row.to)}
                                                </td>
                                                <td className="px-2 py-1 text-right text-[10px] border border-slate-200 whitespace-nowrap font-semibold text-slate-800">
                                                    {f1(row.days)}
                                                </td>
                                                <td className="px-2 py-1 text-center text-[9.5px] border border-slate-200 whitespace-nowrap text-slate-600 capitalize">
                                                    {row.pay}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-800 text-white">
                                            <td
                                                colSpan={6}
                                                className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border border-slate-600"
                                            >
                                                Total Days
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-[10px] font-bold text-white border border-slate-600 whitespace-nowrap">
                                                {f1(sumDays(report.rows))}
                                            </td>
                                            <td className="border border-slate-600" />
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-slate-400 text-right">
                        {report.rows.length} record
                        {report.rows.length !== 1 ? "s" : ""}
                    </p>
                </div>
            )}
        </>
    );
};

export default LeavesReport;
