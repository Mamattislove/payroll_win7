import { useState } from "react";
import { redirect, useLoaderData } from "react-router-dom";
import { FiDownload, FiFileText } from "react-icons/fi";
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

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (s) =>
    new Date(`${s}T00:00:00Z`).toLocaleDateString("en-PH", {
        month: "short", day: "2-digit", year: "numeric", timeZone: "UTC",
    });

const f2 = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f4 = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const r2 = (n) => Math.round(n * 100) / 100;

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

function buildRows(payrolls) {
    return payrolls
        .map((p) => {
            const emp = p.compensation?.employeeDesignation?.employee;
            const dailyRate = p.compensation?.dailyRate;
            const basicPay  = p.regularPay || 0;
            // daysWorked is banked on the payroll when it is generated, counted
            // off the attendance hours. Records written before that field
            // existed carry no count, so fall back to the old pay-divided-by-
            // rate inference rather than printing a bare zero.
            const days      = p.daysWorked || (dailyRate ? basicPay / dailyRate : 0);
            const otHolSun  = (p.regularOTPay || 0) + (p.holidayRestDayPay || 0) + (p.holidayRestDayOTPay || 0);
            const nd        = p.nightDifferentialPay || 0;
            // Paid leave belongs in the Leave/SIL column alongside any earning
            // records — it is pay for days not worked, not part of basic pay.
            const leaveSil  = (p.earning || []).reduce((s, e) => s + (e.amount || 0), 0)
                            + (p.leavePay || 0);
            const gross     = p.grossPay || 0;
            const sss       = p.sssContribution || 0;
            const ph        = p.philhealthContribution || 0;
            const hdmf      = p.pagibigContribution || 0;
            const sssLoan   = (p.loans || [])
                .filter((l) => /sss/i.test(l.loan?.loanType?.loanTypeName || ""))
                .reduce((s, l) => s + (l.amount || 0), 0);
            const hdmfLoan  = (p.loans || [])
                .filter((l) => /hdmf|pag.?ibig/i.test(l.loan?.loanType?.loanTypeName || ""))
                .reduce((s, l) => s + (l.amount || 0), 0);
            const tax       = p.withholdingTax || 0;
            // totalDeductions already contains the government contributions and
            // loan payments that get their own columns. Subtract them back out,
            // or the same pesos print twice and the row stops footing:
            // gross - (every deduction column) must equal netPay.
            const deductions = r2(
                (p.totalDeductions || 0) - sss - ph - hdmf - tax - sssLoan - hdmfLoan,
            );
            const allowances = (p.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
            const netPay    = p.netSalary || p.finalPay || 0;

            return {
                // Payrolls brought over from the previous system carry the
                // totals it calculated, with no component records behind
                // them, so their columns do not always foot. Marked rather
                // than corrected: those figures are what was actually paid.
                imported: !!p.legacyPayslipId,
                code: emp?.employeeCode || "—",
                name: emp ? `${emp.lastName}, ${emp.firstName}` : "—",
                dailyRate,
                basicPay, days, otHolSun, nd, leaveSil, gross,
                sss, ph, hdmf, sssLoan, hdmfLoan, tax,
                deductions, allowances, netPay,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

function sumRows(rows) {
    return rows.reduce(
        (acc, r) => {
            acc.basicPay   += r.basicPay;
            acc.days       += r.days;
            acc.otHolSun   += r.otHolSun;
            acc.nd         += r.nd;
            acc.leaveSil   += r.leaveSil;
            acc.gross      += r.gross;
            acc.sss        += r.sss;
            acc.ph         += r.ph;
            acc.hdmf       += r.hdmf;
            acc.sssLoan    += r.sssLoan;
            acc.hdmfLoan   += r.hdmfLoan;
            acc.tax        += r.tax;
            acc.deductions += r.deductions;
            acc.allowances += r.allowances;
            acc.netPay     += r.netPay;
            return acc;
        },
        { basicPay: 0, days: 0, otHolSun: 0, nd: 0, leaveSil: 0, gross: 0, sss: 0, ph: 0, hdmf: 0, sssLoan: 0, hdmfLoan: 0, tax: 0, deductions: 0, allowances: 0, netPay: 0 },
    );
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

const W = {
    num: 16, code: 26, rate: 34,
    basic: 40, days: 26, ot: 40, nd: 26, leave: 40, gross: 42,
    sss: 32, ph: 36, hdmf: 26, sssLoan: 34, hdmfLoan: 34,
    tax: 26, ded: 42, allw: 28, net: 44, sig: 70,
};

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
    importedNote: { fontSize: 6, marginTop: 6, color: "#92400e" },
    tdC:      { fontSize: 5.5, textAlign: "center", color: "#64748b" },
    gt:       { backgroundColor: "#1e3a5f" },
    gtLabel:  { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6 },
    gtAmt:    { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6, textAlign: "right" },
});

const JournalPDF = ({ report }) => {
    const { rows, clientName, dateFrom, dateTo } = report;
    const t = sumRows(rows);

    return (
        <Document>
            <Page size={[936, 612]} style={S.page}>
                <View style={S.header}>
                    <Image src={logo} style={S.logo} />
                    <Text style={S.coName}>YAMAN NG LAHI LABOR SERVICE COOPERATIVE</Text>
                    <Text style={S.coAddr}>Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas, Bulacan</Text>
                    <Text style={S.rptTitle}>Payroll Journal Report</Text>
                    <Text style={S.rptDate}>Date Covered: {fmtDate(dateFrom)} – {fmtDate(dateTo)}</Text>
                </View>
                <View style={S.meta}>
                    <Text>CLIENT: <Text style={S.metaBold}>{clientName}</Text></Text>
                </View>

                {/* Header */}
                <View style={S.row}>
                    {[
                        ["#",              W.num,  false],
                        ["EMP\nCODE",      W.code, false],
                        ["NAME",           0,      true ],
                        ["DAILY\nRATE",    W.rate, false],
                        ["BASIC\nPAY",     W.basic,false],
                        ["DAYS",           W.days, false],
                        ["OT+HOL\n+SUN",   W.ot,   false],
                        ["ND",             W.nd,   false],
                        ["LEAVE/SIL\nABS/ADJ",W.leave,false],
                        ["ALLW",           W.allw, false],
                        ["GROSS",          W.gross,false],
                        ["SSS",            W.sss,  false],
                        ["Phil\nHealth",   W.ph,   false],
                        ["HDMF",           W.hdmf, false],
                        ["SSS\nLOAN",      W.sssLoan,false],
                        ["HDMF\nLOAN",     W.hdmfLoan,false],
                        ["TAX",            W.tax,  false],
                        ["DEDUC-\nTIONS",  W.ded,  false],
                        ["NET PAY",        W.net,  false],
                        ["Signature",      W.sig,  false],
                    ].map(([label, w, flex]) => (
                        <View key={label} style={[S.th, flex ? { flex: 1 } : { width: w }]}>
                            <Text style={S.thText}>{label}</Text>
                        </View>
                    ))}
                </View>

                {/* Data rows */}
                {rows.map((row, i) => {
                    const even = i % 2 === 0;
                    const bg = even ? S.tdEven : S.tdOdd;
                    return (
                        <View key={i} style={S.row}>
                            <View style={[S.td, bg, { width: W.num  }]}><Text style={S.tdC}>{i + 1}</Text></View>
                            <View style={[S.td, bg, { width: W.code }]}><Text style={S.tdC}>{row.code}{row.imported ? "*" : ""}</Text></View>
                            <View style={[S.td, bg, { flex: 1       }]}><Text style={S.tdL}>{row.name}</Text></View>
                            <View style={[S.td, bg, { width: W.rate }]}><Text style={S.tdR}>{f2(row.dailyRate)}</Text></View>
                            <View style={[S.td, bg, { width: W.basic}]}><Text style={S.tdR}>{f2(row.basicPay)}</Text></View>
                            <View style={[S.td, bg, { width: W.days }]}><Text style={S.tdR}>{f4(row.days)}</Text></View>
                            <View style={[S.td, bg, { width: W.ot   }]}><Text style={S.tdR}>{f2(row.otHolSun)}</Text></View>
                            <View style={[S.td, bg, { width: W.nd   }]}><Text style={S.tdR}>{f2(row.nd)}</Text></View>
                            <View style={[S.td, bg, { width: W.leave}]}><Text style={S.tdR}>{f2(row.leaveSil)}</Text></View>
                            <View style={[S.td, bg, { width: W.allw }]}><Text style={S.tdR}>{f2(row.allowances)}</Text></View>
                            <View style={[S.td, bg, { width: W.gross}]}><Text style={S.tdR}>{f2(row.gross)}</Text></View>
                            <View style={[S.td, bg, { width: W.sss  }]}><Text style={S.tdR}>{f2(row.sss)}</Text></View>
                            <View style={[S.td, bg, { width: W.ph   }]}><Text style={S.tdR}>{f2(row.ph)}</Text></View>
                            <View style={[S.td, bg, { width: W.hdmf }]}><Text style={S.tdR}>{f2(row.hdmf)}</Text></View>
                            <View style={[S.td, bg, { width: W.sssLoan }]}><Text style={S.tdR}>{f2(row.sssLoan)}</Text></View>
                            <View style={[S.td, bg, { width: W.hdmfLoan}]}><Text style={S.tdR}>{f2(row.hdmfLoan)}</Text></View>
                            <View style={[S.td, bg, { width: W.tax  }]}><Text style={S.tdR}>{f2(row.tax)}</Text></View>
                            <View style={[S.td, bg, { width: W.ded  }]}><Text style={S.tdR}>{f2(row.deductions)}</Text></View>
                            <View style={[S.td, bg, { width: W.net  }]}><Text style={S.tdR}>{f2(row.netPay)}</Text></View>
                            <View style={[S.td, bg, { width: W.sig  }]}><Text style={S.tdC}> </Text></View>
                        </View>
                    );
                })}

                {/* Totals */}
                <View style={[S.row, S.gt]}>
                    <View style={[S.td, S.gt, { width: W.num + W.code }]}><Text style={S.gtLabel}> </Text></View>
                    <View style={[S.td, S.gt, { flex: 1 }]}><Text style={S.gtLabel}>TOTAL</Text></View>
                    <View style={[S.td, S.gt, { width: W.rate }]}><Text style={S.gtLabel}> </Text></View>
                    <View style={[S.td, S.gt, { width: W.basic}]}><Text style={S.gtAmt}>{f2(t.basicPay)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.days }]}><Text style={S.gtAmt}>{f4(t.days)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.ot   }]}><Text style={S.gtAmt}>{f2(t.otHolSun)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.nd   }]}><Text style={S.gtAmt}>{f2(t.nd)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.leave}]}><Text style={S.gtAmt}>{f2(t.leaveSil)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.allw }]}><Text style={S.gtAmt}>{f2(t.allowances)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.gross}]}><Text style={S.gtAmt}>{f2(t.gross)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.sss  }]}><Text style={S.gtAmt}>{f2(t.sss)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.ph   }]}><Text style={S.gtAmt}>{f2(t.ph)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.hdmf }]}><Text style={S.gtAmt}>{f2(t.hdmf)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.sssLoan }]}><Text style={S.gtAmt}>{f2(t.sssLoan)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.hdmfLoan}]}><Text style={S.gtAmt}>{f2(t.hdmfLoan)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.tax  }]}><Text style={S.gtAmt}>{f2(t.tax)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.ded  }]}><Text style={S.gtAmt}>{f2(t.deductions)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.net  }]}><Text style={S.gtAmt}>{f2(t.netPay)}</Text></View>
                    <View style={[S.td, S.gt, { width: W.sig  }]}><Text style={S.gtLabel}> </Text></View>
                </View>

                {/* The printed journal is the accounting record, so the reason
                    some rows do not add across belongs on the page itself. */}
                {rows.some((r) => r.imported) && (
                    <Text style={S.importedNote}>
                        * {rows.filter((r) => r.imported).length} row(s) imported from the
                        previous system. Their totals are the figures actually paid; the
                        column breakdown behind them was not imported, so those rows may
                        not add across.
                    </Text>
                )}
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

const JournalRow = ({ row, idx }) => {
    const bg = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
    const td  = "px-2 py-1 text-right text-[10px] border border-slate-200 whitespace-nowrap";
    const tdc = "px-2 py-1 text-center text-[9.5px] border border-slate-200 whitespace-nowrap font-mono text-slate-500";

    return (
        <tr className={bg}>
            <td className={`${tdc} font-semibold text-slate-400`}>{idx + 1}</td>
            <td className={tdc}>
                {row.code}
                {row.imported && <span title="Imported from the previous system">*</span>}
            </td>
            <td className="px-2 py-1 text-[10px] font-semibold border border-slate-200 whitespace-nowrap">{row.name}</td>
            <td className={td}>{f2(row.dailyRate)}</td>
            <td className={td}>{f2(row.basicPay)}</td>
            <td className={td}>{f4(row.days)}</td>
            <td className={td}>{f2(row.otHolSun)}</td>
            <td className={td}>{f2(row.nd)}</td>
            <td className={td}>{f2(row.leaveSil)}</td>
            <td className={td}>{f2(row.allowances)}</td>
            <td className={`${td} font-semibold text-slate-800`}>{f2(row.gross)}</td>
            <td className={td}>{f2(row.sss)}</td>
            <td className={td}>{f2(row.ph)}</td>
            <td className={td}>{f2(row.hdmf)}</td>
            <td className={td}>{f2(row.sssLoan)}</td>
            <td className={td}>{f2(row.hdmfLoan)}</td>
            <td className={td}>{f2(row.tax)}</td>
            <td className={td}>{f2(row.deductions)}</td>
            <td className={`${td} font-bold text-slate-800 bg-blue-50`}>{f2(row.netPay)}</td>
            <td className="px-8 py-1 border border-slate-200" />
        </tr>
    );
};

const TotalRow = ({ rows }) => {
    const t = sumRows(rows);
    const td = "px-2 py-1.5 text-right text-[10px] font-bold text-white border border-slate-600 whitespace-nowrap";
    return (
        <tr className="bg-slate-800 text-white">
            <td colSpan={4} className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border border-slate-600">Total</td>
            <td className={td}>{f2(t.basicPay)}</td>
            <td className={td}>{f4(t.days)}</td>
            <td className={td}>{f2(t.otHolSun)}</td>
            <td className={td}>{f2(t.nd)}</td>
            <td className={td}>{f2(t.leaveSil)}</td>
            <td className={td}>{f2(t.allowances)}</td>
            <td className={td}>{f2(t.gross)}</td>
            <td className={td}>{f2(t.sss)}</td>
            <td className={td}>{f2(t.ph)}</td>
            <td className={td}>{f2(t.hdmf)}</td>
            <td className={td}>{f2(t.sssLoan)}</td>
            <td className={td}>{f2(t.hdmfLoan)}</td>
            <td className={td}>{f2(t.tax)}</td>
            <td className={td}>{f2(t.deductions)}</td>
            <td className={td}>{f2(t.netPay)}</td>
            <td className="border border-slate-600" />
        </tr>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const PayrollJournal = () => {
    const { clients } = useLoaderData();
    const [filter, setFilter]       = useState({ clientId: "", dateFrom: "", dateTo: "" });
    const [report, setReport]       = useState(null);
    const [loading, setLoading]     = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [error, setError]         = useState("");

    const set = (key) => (e) => setFilter((p) => ({ ...p, [key]: e.target.value }));

    const generate = async (e) => {
        e.preventDefault();
        if (!filter.clientId) { setError("Please select a client."); return; }
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                client:  filter.clientId,
                from:    filter.dateFrom,
                to:      filter.dateTo,
                limit:   10000,
            });
            const { data } = await customFetch.get(`/payrolls?${params}`);
            const rows = buildRows(data.payrolls || []);
            const clientName = clients.find((c) => c._id === filter.clientId)?.clientName ?? "";
            setReport({ rows, clientName, dateFrom: filter.dateFrom, dateTo: filter.dateTo });
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
            const blob = await pdf(<JournalPDF report={report} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `payroll-journal-${report.dateFrom}-to-${report.dateTo}.pdf`;
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

    // Exported as CSV rather than a real .xlsx: Excel opens it natively and it
    // costs the bundle nothing, which matters for an on-premise install.
    // Amounts are written raw (no thousands separators, no peso sign) so Excel
    // reads them as numbers and can total them.
    const downloadExcel = () => {
        if (!report) return;

        const headers = [
            "#", "Emp Code", "Name", "Daily Rate", "Basic Pay", "Days",
            "OT+Hol+Sun", "Night Diff", "Leave/SIL Abs/Adj", "Allowance",
            "Gross", "SSS", "PhilHealth", "HDMF", "SSS Loan", "HDMF Loan",
            "Tax", "Deductions", "Net Pay",
        ];

        const n = (v) => Math.round((Number(v) || 0) * 100) / 100;
        const body = report.rows.map((r, i) => [
            i + 1, r.code + (r.imported ? "*" : ""), r.name, n(r.dailyRate), n(r.basicPay), n(r.days),
            n(r.otHolSun), n(r.nd), n(r.leaveSil), n(r.allowances),
            n(r.gross), n(r.sss), n(r.ph), n(r.hdmf), n(r.sssLoan),
            n(r.hdmfLoan), n(r.tax), n(r.deductions), n(r.netPay),
        ]);

        const t = sumRows(report.rows);
        const totals = [
            "", "", "TOTAL", "", n(t.basicPay), n(t.days), n(t.otHolSun),
            n(t.nd), n(t.leaveSil), n(t.allowances), n(t.gross), n(t.sss),
            n(t.ph), n(t.hdmf), n(t.sssLoan), n(t.hdmfLoan), n(t.tax),
            n(t.deductions), n(t.netPay),
        ];

        // A field is quoted only when it contains a comma, quote or newline —
        // employee names carry commas ("DELA CRUZ, JUAN") so this is required.
        const cell = (v) => {
            const s = v == null ? "" : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const lines = [
            ["Payroll Journal Report"],
            ["Client", report.clientName],
            ["Period", `${report.dateFrom} to ${report.dateTo}`],
            [],
            headers,
            ...body,
            totals,
        ].map((row) => row.map(cell).join(","));

        // The BOM makes Excel read the file as UTF-8; without it surnames like
        // PEÑA come out mangled.
        const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-journal-${report.dateFrom}-to-${report.dateTo}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const inputCls = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
    const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";

    return (
        <>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 mb-4">Payroll Journal Report</h1>
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
                    {report && (
                        <button
                            type="button"
                            onClick={downloadExcel}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <FiFileText className="text-base" />
                            Download Excel
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
                        <p className="font-bold text-sm mt-2">Payroll Journal Report</p>
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
                                    <Th>EMP Code</Th>
                                    <Th>Name</Th>
                                    <Th right>Daily Rate</Th>
                                    <Th right>Basic Pay</Th>
                                    <Th right>Days</Th>
                                    <Th right>OT+HOL+SUN</Th>
                                    <Th right>ND</Th>
                                    <Th right>Leave/SIL Abs/Adj</Th>
                                    <Th right>Allowance</Th>
                                    <Th right>Gross</Th>
                                    <Th right>SSS</Th>
                                    <Th right>PhilHealth</Th>
                                    <Th right>HDMF</Th>
                                    <Th right>SSS Loan</Th>
                                    <Th right>HDMF Loan</Th>
                                    <Th right>Tax</Th>
                                    <Th right>Deductions</Th>
                                    <Th right>Net Pay</Th>
                                    <Th>Signature</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={19} className="text-center py-10 text-slate-400 text-sm">
                                            No payroll records found for the selected period.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {report.rows.map((row, i) => <JournalRow key={i} row={row} idx={i} />)}
                                        <TotalRow rows={report.rows} />
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        {report.rows.some((r) => r.imported) && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                <span className="font-semibold">*</span>{" "}
                                {report.rows.filter((r) => r.imported).length} row(s) were
                                imported from the previous system. Their totals are the
                                figures actually paid, but the column breakdown behind them
                                was not imported, so those rows may not add across.
                            </p>
                        )}
                        <p className="text-xs text-slate-400 sm:text-right shrink-0">
                            {report.rows.length} record{report.rows.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default PayrollJournal;
