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
import { EMPLOYMENT_STATUS } from "../../../utils/constants";
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

// ─── the three agencies ───────────────────────────────────────────────────────

// Everything that differs between the tabs lives here, so the table, the PDF
// and the totals are written once. Adding a fourth agency is a new entry.
const AGENCIES = [
    {
        key: "sss",
        label: "SSS",
        title: "SSS CONTRIBUTIONS REPORT",
        numberField: "sssNumber",
        numberLabel: "SSS No.",
        employeeField: "sssContribution",
        employerField: "sssEmployerContribution",
    },
    {
        key: "philhealth",
        label: "PhilHealth",
        title: "PHILHEALTH CONTRIBUTIONS REPORT",
        numberField: "philhealthNumber",
        numberLabel: "PhilHealth No.",
        employeeField: "philhealthContribution",
        employerField: "philhealthEmployerContribution",
    },
    {
        key: "pagibig",
        label: "Pag-IBIG",
        title: "PAG-IBIG CONTRIBUTIONS REPORT",
        numberField: "pagibigNumber",
        numberLabel: "Pag-IBIG No.",
        employeeField: "pagibigContribution",
        employerField: "pagibigEmployerContribution",
    },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

// "Aug. 16, 2026" — the form the printed reports use, which en-PH's short
// month ("Aug") does not produce on its own.
const fmtCovered = (s) => {
    const d = new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
    const month = d.toLocaleDateString("en-PH", {
        month: "short",
        timeZone: "UTC",
    });
    return `${month}. ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

const f2 = (n) =>
    (+n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const fmtPeriod = (from, to) => {
    const d = (v) =>
        new Date(`${String(v).slice(0, 10)}T00:00:00Z`).toLocaleDateString(
            "en-PH",
            { month: "short", day: "2-digit", timeZone: "UTC" },
        );
    return `${d(from)} – ${d(to)}`;
};

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

/**
 * Rows for one agency. Built for all three from a single fetch, so switching
 * tabs is instant and the three tabs can never disagree about a period.
 *
 * An employee with a zero contribution is dropped: a remittance list is who
 * owes something this cutoff, and "no deduction" employees would otherwise pad
 * every page with zero rows.
 */
function buildRows(payrolls, agency) {
    const rows = payrolls
        .map((p) => {
            const emp = p.compensation?.employeeDesignation?.employee;
            return {
                code: emp?.employeeCode || "—",
                name: emp ? `${emp.lastName}, ${emp.firstName}` : "—",
                number: emp?.[agency.numberField] || "—",
                period: fmtPeriod(p.payrollFrom, p.payrollTo),
                periodKey: String(p.payrollFrom ?? ""),
                employee: p[agency.employeeField] || 0,
                employer: p[agency.employerField] || 0,
            };
        })
        .filter((r) => r.employee > 0 || r.employer > 0)
        .sort(
            (a, b) =>
                a.name.localeCompare(b.name) ||
                a.periodKey.localeCompare(b.periodKey),
        );

    const showPeriod = new Set(rows.map((r) => r.periodKey)).size > 1;
    return { rows, showPeriod };
}

const totalsOf = (rows) =>
    rows.reduce(
        (t, r) => ({
            employee: t.employee + r.employee,
            employer: t.employer + r.employer,
            total: t.total + r.employee + r.employer,
        }),
        { employee: 0, employer: 0, total: 0 },
    );

// ─── PDF ──────────────────────────────────────────────────────────────────────

const W = { num: 24, code: 54, agencyNo: 92, period: 74, amt: 70 };

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

const GovPDF = ({ report, agency }) => {
    const { rows, showPeriod } = buildRows(report.payrolls, agency);
    const t = totalsOf(rows);
    const { clientName, departmentName, dateFrom, dateTo } = report;

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
                    <Text style={S.rptTitle}>{agency.title}</Text>
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
                    <View style={[S.th, { width: W.agencyNo }]}>
                        <Text style={S.thText}>{agency.numberLabel}</Text>
                    </View>
                    {showPeriod && (
                        <View style={[S.th, { width: W.period }]}>
                            <Text style={S.thText}>Period</Text>
                        </View>
                    )}
                    <View style={[S.th, { width: W.amt }]}>
                        <Text style={S.thText}>Employee</Text>
                    </View>
                    <View style={[S.th, { width: W.amt }]}>
                        <Text style={S.thText}>Employer</Text>
                    </View>
                    <View style={[S.th, { width: W.amt }]}>
                        <Text style={S.thText}>Total</Text>
                    </View>
                </View>

                {rows.length === 0 ? (
                    <Text style={S.empty}>
                        No {agency.label} contributions for this client and
                        period.
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
                                <View style={[S.td, bg, { width: W.agencyNo }]}>
                                    <Text style={S.tdL}>{row.number}</Text>
                                </View>
                                {showPeriod && (
                                    <View
                                        style={[S.td, bg, { width: W.period }]}
                                    >
                                        <Text style={S.tdC}>{row.period}</Text>
                                    </View>
                                )}
                                <View style={[S.td, bg, { width: W.amt }]}>
                                    <Text style={S.tdR}>
                                        {f2(row.employee)}
                                    </Text>
                                </View>
                                <View style={[S.td, bg, { width: W.amt }]}>
                                    <Text style={S.tdR}>
                                        {f2(row.employer)}
                                    </Text>
                                </View>
                                <View style={[S.td, bg, { width: W.amt }]}>
                                    <Text style={S.tdR}>
                                        {f2(row.employee + row.employer)}
                                    </Text>
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
                        <View style={[S.td, S.gt, { width: W.agencyNo }]}>
                            <Text style={S.gtLabel}> </Text>
                        </View>
                        {showPeriod && (
                            <View style={[S.td, S.gt, { width: W.period }]}>
                                <Text style={S.gtLabel}> </Text>
                            </View>
                        )}
                        <View style={[S.td, S.gt, { width: W.amt }]}>
                            <Text style={S.gtAmt}>{f2(t.employee)}</Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.amt }]}>
                            <Text style={S.gtAmt}>{f2(t.employer)}</Text>
                        </View>
                        <View style={[S.td, S.gt, { width: W.amt }]}>
                            <Text style={S.gtAmt}>{f2(t.total)}</Text>
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

const GovContributionsReport = () => {
    const { clients } = useLoaderData();
    const [filter, setFilter] = useState({
        clientId: "",
        departmentId: "",
        departmentName: "",
        dateFrom: "",
        dateTo: "",
    });
    const [report, setReport] = useState(null);
    const [tab, setTab] = useState(AGENCIES[0].key);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [error, setError] = useState("");

    const agency = AGENCIES.find((a) => a.key === tab) ?? AGENCIES[0];

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
                employeeStatus: EMPLOYMENT_STATUS.ACTIVE,
            });
            if (filter.departmentId)
                params.set("department", filter.departmentId);
            const { data } = await customFetch.get(`/payrolls?${params}`);
            // The payrolls are kept whole rather than pre-shaped per agency:
            // all three tabs read the same fetch, so they cannot drift apart
            // and switching tabs costs nothing.
            setReport({
                payrolls: data.payrolls || [],
                clientName:
                    clients.find((c) => c._id === filter.clientId)
                        ?.clientName ?? "",
                departmentName: filter.departmentName,
                dateFrom: filter.dateFrom,
                dateTo: filter.dateTo,
            });
        } catch {
            setError("Failed to load payroll data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        if (!report) return;
        setPdfLoading(true);
        try {
            const blob = await pdf(
                <GovPDF report={report} agency={agency} />,
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${agency.key}-contributions-${report.dateFrom}-to-${report.dateTo}.pdf`;
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

    const { rows, showPeriod } = report
        ? buildRows(report.payrolls, agency)
        : { rows: [], showPeriod: false };
    const t = totalsOf(rows);
    const colSpan = showPeriod ? 8 : 7;

    return (
        <>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 mb-4">
                    Government Contributions
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
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-60 transition-colors"
                    >
                        {loading ? "Generating…" : "Generate"}
                    </button>
                    {report && rows.length > 0 && (
                        <button
                            type="button"
                            onClick={downloadPDF}
                            disabled={pdfLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
                        >
                            <FiDownload className="text-base" />
                            {pdfLoading
                                ? "Building PDF…"
                                : `Download ${agency.label} PDF`}
                        </button>
                    )}
                </form>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>

            {report && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                    {/* Tabs. Each carries its own total so the three agencies
                        can be compared without switching back and forth. */}
                    <div className="flex border-b border-slate-200 px-2">
                        {AGENCIES.map((a) => {
                            const active = a.key === tab;
                            const at = totalsOf(
                                buildRows(report.payrolls, a).rows,
                            );
                            return (
                                <button
                                    key={a.key}
                                    type="button"
                                    onClick={() => setTab(a.key)}
                                    className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                        active
                                            ? "border-slate-800 text-slate-800"
                                            : "border-transparent text-slate-400 hover:text-slate-600"
                                    }`}
                                >
                                    {a.label}
                                    <span className="ml-2 text-[11px] font-medium text-slate-400">
                                        ₱{f2(at.total)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-6">
                        <div className="text-center mb-4 pb-4 border-b border-slate-200">
                            <p
                                className="font-bold text-sm uppercase tracking-widest"
                                style={{ fontFamily: "Georgia, serif" }}
                            >
                                Yaman ng Lahi Labor Service Cooperative
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Lot 3 Unit 3 Arcadia Residence Borol 1st
                                Balagtas, Bulacan
                            </p>
                            <p className="font-bold text-sm mt-2">
                                {agency.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Date Covered: {fmtCovered(report.dateFrom)} -{" "}
                                {fmtCovered(report.dateTo)}
                            </p>
                        </div>
                        <p className="text-xs mb-3">
                            CLIENT: <strong>{report.clientName}</strong>
                            <span className="ml-6">
                                DEPARTMENT:{" "}
                                <strong>
                                    {report.departmentName || "ALL"}
                                </strong>
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
                                        <Th>{agency.numberLabel}</Th>
                                        {showPeriod && <Th>Period</Th>}
                                        <Th right>Employee</Th>
                                        <Th right>Employer</Th>
                                        <Th right>Total</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={colSpan}
                                                className="text-center py-10 text-slate-400 text-sm"
                                            >
                                                No {agency.label} contributions
                                                for this client and period.
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {rows.map((row, i) => (
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
                                                    <td className="px-2 py-1 text-[9.5px] border border-slate-200 whitespace-nowrap font-mono text-slate-500">
                                                        {row.number}
                                                    </td>
                                                    {showPeriod && (
                                                        <td className="px-2 py-1 text-center text-[9.5px] border border-slate-200 whitespace-nowrap text-slate-500">
                                                            {row.period}
                                                        </td>
                                                    )}
                                                    <td className="px-2 py-1 text-right text-[10px] border border-slate-200 whitespace-nowrap font-semibold text-slate-800">
                                                        {f2(row.employee)}
                                                    </td>
                                                    <td className="px-2 py-1 text-right text-[10px] border border-slate-200 whitespace-nowrap text-slate-600">
                                                        {f2(row.employer)}
                                                    </td>
                                                    <td className="px-2 py-1 text-right text-[10px] border border-slate-200 whitespace-nowrap font-bold text-slate-800 bg-blue-50">
                                                        {f2(
                                                            row.employee +
                                                                row.employer,
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-800 text-white">
                                                <td
                                                    colSpan={
                                                        showPeriod ? 5 : 4
                                                    }
                                                    className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border border-slate-600"
                                                >
                                                    Total
                                                </td>
                                                <td className="px-2 py-1.5 text-right text-[10px] font-bold text-white border border-slate-600 whitespace-nowrap">
                                                    {f2(t.employee)}
                                                </td>
                                                <td className="px-2 py-1.5 text-right text-[10px] font-bold text-white border border-slate-600 whitespace-nowrap">
                                                    {f2(t.employer)}
                                                </td>
                                                <td className="px-2 py-1.5 text-right text-[10px] font-bold text-white border border-slate-600 whitespace-nowrap">
                                                    {f2(t.total)}
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-xs text-slate-400 text-right">
                            {rows.length} record{rows.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default GovContributionsReport;
