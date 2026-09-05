import { useState } from "react";
import { redirect, useLoaderData } from "react-router-dom";
import { FiDownload } from "react-icons/fi";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import customFetch from "../../utils/customFetch";
import { ClientCombobox } from "../components";
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

const fmtDate = (s) =>
    new Date(`${s}T00:00:00Z`).toLocaleDateString("en-PH", {
        month: "short", day: "2-digit", year: "numeric", timeZone: "UTC",
    });

const f2 = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Compact "Jun 01 – Jun 15" for the per-row pay period.
const fmtPeriod = (from, to) => {
    const d = (v) =>
        new Date(`${String(v).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-PH", {
            month: "short", day: "2-digit", timeZone: "UTC",
        });
    return `${d(from)} – ${d(to)}`;
};

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

// Charge types are user-managed master data (not a fixed set), so the report's
// charge columns are derived from whatever charge types actually appear in the
// fetched payrolls, rather than a hardcoded list.
function buildReport(payrolls) {
    const chargeNames = new Set();
    const rows = payrolls
        .map((p) => {
            const emp = p.compensation?.employeeDesignation?.employee;
            const charges = {};
            for (const c of p.charges || []) {
                const label = c.chargeType?.chargeName || "Other";
                chargeNames.add(label);
                charges[label] = (charges[label] || 0) + (c.amount || 0);
            }
            return {
                code: emp?.employeeCode || "—",
                name: emp ? `${emp.lastName}, ${emp.firstName}` : "—",
                // A range wider than one cutoff returns several payrolls per
                // employee. Without the period they render as indistinguishable
                // duplicate rows on what is a signature sheet.
                period: fmtPeriod(p.payrollFrom, p.payrollTo),
                periodKey: String(p.payrollFrom ?? ""),
                netPay: p.netSalary || 0,
                charges,
                finalPay: p.finalPay || 0,
            };
        })
        .sort(
            (a, b) =>
                a.name.localeCompare(b.name) ||
                a.periodKey.localeCompare(b.periodKey),
        );

    return { rows, chargeColumns: [...chargeNames].sort((a, b) => a.localeCompare(b)) };
}

function sumRows(rows, chargeColumns) {
    const totals = { netPay: 0, finalPay: 0, charges: {} };
    for (const col of chargeColumns) totals.charges[col] = 0;
    for (const r of rows) {
        totals.netPay += r.netPay;
        totals.finalPay += r.finalPay;
        for (const col of chargeColumns) totals.charges[col] += r.charges[col] || 0;
    }
    return totals;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

const W = { num: 16, code: 30, period: 62, net: 44, charge: 40, final: 44, sig: 60 };

const S = StyleSheet.create({
    page:     { fontFamily: "Helvetica", fontSize: 6, paddingTop: 16, paddingBottom: 16, paddingHorizontal: 18 },
    header:   { textAlign: "center", marginBottom: 6, paddingBottom: 5, borderBottomWidth: 0.5, borderBottomColor: "#c8d3e0", borderBottomStyle: "solid" },
    logo:     { width: 40, height: 40, objectFit: "contain", alignSelf: "center", marginBottom: 3 },
    coName:   { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
    coAddr:   { fontSize: 6, color: "#64748b", marginBottom: 1 },
    rptTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginTop: 3, marginBottom: 1 },
    rptDate:  { fontSize: 6, color: "#64748b" },
    meta:     { fontSize: 6.5, marginBottom: 4 },
    metaBold: { fontFamily: "Helvetica-Bold" },
    row:      { flexDirection: "row" },
    th: {
        backgroundColor: "#1e3a5f", color: "#ffffff",
        borderWidth: 0.5, borderColor: "#4a6f9f", borderStyle: "solid",
        padding: 2.5, justifyContent: "center", alignItems: "center",
    },
    thText:   { fontFamily: "Helvetica-Bold", fontSize: 5, textAlign: "center" },
    td: {
        borderWidth: 0.5, borderColor: "#c8d3e0", borderStyle: "solid",
        paddingHorizontal: 2, paddingVertical: 2,
    },
    tdEven:   { backgroundColor: "#ffffff" },
    tdOdd:    { backgroundColor: "#f4f7fb" },
    tdR:      { fontSize: 6, textAlign: "right" },
    tdL:      { fontSize: 6, textAlign: "left" },
    tdC:      { fontSize: 5.5, textAlign: "center", color: "#64748b" },
    gt:       { backgroundColor: "#1e3a5f" },
    gtLabel:  { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6 },
    gtAmt:    { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6, textAlign: "right" },
});

const NetPayPDF = ({ report }) => {
    const { rows, chargeColumns, clientName, dateFrom, dateTo } = report;
    const t = sumRows(rows, chargeColumns);

    return (
        <Document>
            <Page size={[936, 612]} style={S.page}>
                <View style={S.header}>
                    <Image src={logo} style={S.logo} />
                    <Text style={S.coName}>YAMAN NG LAHI LABOR SERVICE COOPERATIVE</Text>
                    <Text style={S.coAddr}>Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas, Bulacan</Text>
                    <Text style={S.rptTitle}>Net Pay Report</Text>
                    <Text style={S.rptDate}>{fmtDate(dateFrom)} – {fmtDate(dateTo)}</Text>
                </View>
                <View style={S.meta}>
                    <Text>CLIENT: <Text style={S.metaBold}>{clientName}</Text></Text>
                </View>

                <View style={S.row}>
                    <View style={[S.th, { width: W.num }]}><Text style={S.thText}>#</Text></View>
                    <View style={[S.th, { width: W.code }]}><Text style={S.thText}>ECode</Text></View>
                    <View style={[S.th, { flex: 1 }]}><Text style={S.thText}>Name</Text></View>
                    <View style={[S.th, { width: W.period }]}><Text style={S.thText}>Period</Text></View>
                    <View style={[S.th, { width: W.net }]}><Text style={S.thText}>Net Pay</Text></View>
                    {chargeColumns.map((col) => (
                        <View key={col} style={[S.th, { width: W.charge }]}>
                            <Text style={S.thText}>{col}</Text>
                        </View>
                    ))}
                    <View style={[S.th, { width: W.final }]}><Text style={S.thText}>Final Pay</Text></View>
                    <View style={[S.th, { width: W.sig }]}><Text style={S.thText}>Signature</Text></View>
                </View>

                {rows.map((row, i) => {
                    const even = i % 2 === 0;
                    const bg = even ? S.tdEven : S.tdOdd;
                    return (
                        <View key={i} style={S.row}>
                            <View style={[S.td, bg, { width: W.num }]}><Text style={S.tdC}>{i + 1}</Text></View>
                            <View style={[S.td, bg, { width: W.code }]}><Text style={S.tdC}>{row.code}</Text></View>
                            <View style={[S.td, bg, { flex: 1 }]}><Text style={S.tdL}>{row.name}</Text></View>
                            <View style={[S.td, bg, { width: W.period }]}><Text style={S.tdC}>{row.period}</Text></View>
                            <View style={[S.td, bg, { width: W.net }]}><Text style={S.tdR}>{f2(row.netPay)}</Text></View>
                            {chargeColumns.map((col) => (
                                <View key={col} style={[S.td, bg, { width: W.charge }]}>
                                    <Text style={S.tdR}>{f2(row.charges[col])}</Text>
                                </View>
                            ))}
                            <View style={[S.td, bg, { width: W.final }]}><Text style={S.tdR}>{f2(row.finalPay)}</Text></View>
                            <View style={[S.td, bg, { width: W.sig }]}><Text style={S.tdC}> </Text></View>
                        </View>
                    );
                })}

                <View style={[S.row, S.gt]}>
                    <View style={[S.td, S.gt, { width: W.num + W.code }]}><Text style={S.gtLabel}> </Text></View>
                    <View style={[S.td, S.gt, { flex: 1 }]}><Text style={S.gtLabel}>TOTAL</Text></View>
                    <View style={[S.td, S.gt, { width: W.period }]}><Text style={S.gtLabel}> </Text></View>
                    <View style={[S.td, S.gt, { width: W.net }]}><Text style={S.gtAmt}>{f2(t.netPay)}</Text></View>
                    {chargeColumns.map((col) => (
                        <View key={col} style={[S.td, S.gt, { width: W.charge }]}>
                            <Text style={S.gtAmt}>{f2(t.charges[col])}</Text>
                        </View>
                    ))}
                    <View style={[S.td, S.gt, { width: W.final }]}><Text style={S.gtAmt}>{f2(t.finalPay)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.sig }]}><Text style={S.gtLabel}> </Text></View>
                </View>
            </Page>
        </Document>
    );
};

// ─── Screen table ─────────────────────────────────────────────────────────────

const Th = ({ children, right }) => (
    <th className={`bg-slate-800 text-white text-[8.5px] font-semibold uppercase tracking-wide px-2 py-1.5 border border-slate-600 whitespace-nowrap ${right ? "text-right" : "text-center"}`}>
        {children}
    </th>
);

const NetPayRow = ({ row, idx, chargeColumns }) => {
    const bg = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
    const td = "px-2 py-1 text-right text-[10px] border border-slate-200 whitespace-nowrap";
    const tdc = "px-2 py-1 text-center text-[9.5px] border border-slate-200 whitespace-nowrap font-mono text-slate-500";

    return (
        <tr className={bg}>
            <td className={`${tdc} font-semibold text-slate-400`}>{idx + 1}</td>
            <td className={tdc}>{row.code}</td>
            <td className="px-2 py-1 text-[10px] font-semibold border border-slate-200 whitespace-nowrap">{row.name}</td>
            <td className={tdc}>{row.period}</td>
            <td className={`${td} font-semibold text-slate-800`}>{f2(row.netPay)}</td>
            {chargeColumns.map((col) => (
                <td key={col} className={td}>{f2(row.charges[col])}</td>
            ))}
            <td className={`${td} font-bold text-slate-800 bg-blue-50`}>{f2(row.finalPay)}</td>
            <td className="px-8 py-1 border border-slate-200" />
        </tr>
    );
};

const TotalRow = ({ rows, chargeColumns }) => {
    const t = sumRows(rows, chargeColumns);
    const td = "px-2 py-1.5 text-right text-[10px] font-bold text-white border border-slate-600 whitespace-nowrap";
    return (
        <tr className="bg-slate-800 text-white">
            <td colSpan={4} className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border border-slate-600">Total</td>
            <td className={td}>{f2(t.netPay)}</td>
            {chargeColumns.map((col) => (
                <td key={col} className={td}>{f2(t.charges[col])}</td>
            ))}
            <td className={td}>{f2(t.finalPay)}</td>
            <td className="border border-slate-600" />
        </tr>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const NetPayReport = () => {
    const { clients } = useLoaderData();
    const [filter, setFilter] = useState({ clientId: "", dateFrom: "", dateTo: "" });
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [error, setError] = useState("");

    const set = (key) => (e) => setFilter((p) => ({ ...p, [key]: e.target.value }));

    const generate = async (e) => {
        e.preventDefault();
        if (!filter.clientId) { setError("Please select a client."); return; }
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                client: filter.clientId,
                from: filter.dateFrom,
                to: filter.dateTo,
                limit: 10000,
            });
            const { data } = await customFetch.get(`/payrolls?${params}`);
            const { rows, chargeColumns } = buildReport(data.payrolls || []);
            const clientName = clients.find((c) => c._id === filter.clientId)?.clientName ?? "";
            setReport({ rows, chargeColumns, clientName, dateFrom: filter.dateFrom, dateTo: filter.dateTo });
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
            const blob = await pdf(<NetPayPDF report={report} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `net-pay-report-${report.dateFrom}-to-${report.dateTo}.pdf`;
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

    const inputCls = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
    const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";

    return (
        <>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 mb-4">Net Pay Report</h1>
                <form onSubmit={generate} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap gap-4 items-end shadow-sm">
                    <div className="flex-1 min-w-52">
                        <label className={labelCls}>Client</label>
                        <ClientCombobox
                            clients={clients}
                            value={filter.clientId}
                            onChange={(id) => setFilter((p) => ({ ...p, clientId: id }))}
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
                        <input type="date" required value={filter.dateTo} onChange={set("dateTo")} className={inputCls} />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-60 transition-colors"
                    >
                        {loading ? "Generating…" : "Generate"}
                    </button>
                    {report && (
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
                        <p className="font-bold text-sm uppercase tracking-widest" style={{ fontFamily: "Georgia, serif" }}>
                            Yaman ng Lahi Labor Service Cooperative
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas, Bulacan</p>
                        <p className="font-bold text-sm mt-2">Net Pay Report</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {fmtDate(report.dateFrom)} To {fmtDate(report.dateTo)}
                        </p>
                    </div>
                    <p className="text-xs mb-3">CLIENT: <strong>{report.clientName}</strong></p>

                    <div className="overflow-x-auto bg-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                        <table className="border-collapse min-w-full">
                            <thead>
                                <tr>
                                    <Th>#</Th>
                                    <Th>ECode</Th>
                                    <Th>Name</Th>
                                    <Th>Period</Th>
                                    <Th right>Net Pay</Th>
                                    {report.chargeColumns.map((col) => (
                                        <Th key={col} right>{col}</Th>
                                    ))}
                                    <Th right>Final Pay</Th>
                                    <Th>Signature</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6 + report.chargeColumns.length} className="text-center py-10 text-slate-400 text-sm">
                                            No payroll records found for the selected period.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {report.rows.map((row, i) => (
                                            <NetPayRow key={i} row={row} idx={i} chargeColumns={report.chargeColumns} />
                                        ))}
                                        <TotalRow rows={report.rows} chargeColumns={report.chargeColumns} />
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-slate-400 text-right">
                        {report.rows.length} record{report.rows.length !== 1 ? "s" : ""}
                    </p>
                </div>
            )}
        </>
    );
};

export default NetPayReport;
