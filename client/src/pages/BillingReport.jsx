import { useState } from "react";
import { redirect, useLoaderData } from "react-router-dom";
import { FiDownload } from "react-icons/fi";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import customFetch from "../../utils/customFetch";
import { DAY_TYPES } from "../../../utils/constants";
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

const f4 = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const f2 = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const LEGAL_TYPES = new Set([
    DAY_TYPES.LEGAL_HOLIDAY, DAY_TYPES.LEGAL_REGULAR_PAY,
    DAY_TYPES.LEGAL_3X_PAY, DAY_TYPES.DOUBLE_HOLIDAY,
]);
const RD_LG_TYPES = new Set([
    DAY_TYPES.LEGAL_RD_2X_PAY, DAY_TYPES.LEGAL_RD_REGULAR_PAY, DAY_TYPES.LEGAL_RD_3X_PAY,
]);
const LEAVE_TYPES = new Set([DAY_TYPES.LEAVE_WITH_PAY, DAY_TYPES.LEAVE_HALFDAY]);

function aggregate(atts) {
    const zero = () => ({ days: 0, otHrs: 0, amt: 0, otAmt: 0 });
    const reg = zero(), rdsh = zero(), legal = zero(), rdSh = zero(), rdLg = zero();
    let nsdRegHrs = 0, nsdOtHrs = 0, nsdRegAmt = 0, nsdOtAmt = 0, leaveSil = 0, total = 0;

    for (const a of atts) {
        const rp = a.regularHoursPay ?? 0;
        const op = a.overtimeHoursPay ?? 0;
        const np = a.nightPremiumPay ?? 0;
        const np2 = a.overtimeNightPremiumPay ?? 0;
        total += rp + op + np + np2;
        nsdRegHrs += a.nightPremiumHours ?? 0;
        nsdOtHrs  += a.overtimeNightPremiumHours ?? 0;
        nsdRegAmt += np;
        nsdOtAmt  += np2;

        const ot = a.overtimeHours ?? 0;
        const dt = a.dayType;
        if (dt === DAY_TYPES.REGULAR) {
            reg.days++; reg.otHrs += ot; reg.amt += rp; reg.otAmt += op;
        } else if (dt === DAY_TYPES.SPECIAL_HOLIDAY) {
            rdsh.days++; rdsh.otHrs += ot; rdsh.amt += rp; rdsh.otAmt += op;
        } else if (LEGAL_TYPES.has(dt)) {
            legal.days++; legal.otHrs += ot; legal.amt += rp; legal.otAmt += op;
        } else if (dt === DAY_TYPES.SPECIAL_AND_REST_DAY) {
            rdSh.days++; rdSh.otHrs += ot; rdSh.amt += rp; rdSh.otAmt += op;
        } else if (RD_LG_TYPES.has(dt)) {
            rdLg.days++; rdLg.otHrs += ot; rdLg.amt += rp; rdLg.otAmt += op;
        } else if (LEAVE_TYPES.has(dt)) {
            leaveSil += rp;
        }
    }

    return { reg, rdsh, legal, rdSh, rdLg, nsd: { regHrs: nsdRegHrs, otHrs: nsdOtHrs, regAmt: nsdRegAmt, otAmt: nsdOtAmt }, leaveSil, total };
}

function buildRows(attendances) {
    const map = new Map();
    for (const att of attendances) {
        const key = att.compensation?._id;
        if (!map.has(key)) {
            const emp = att.compensation?.employeeDesignation?.employee;
            map.set(key, {
                code: emp?.employeeCode ?? "—",
                name: emp ? `${emp.lastName}, ${emp.firstName}` : "—",
                atts: [],
            });
        }
        map.get(key).atts.push(att);
    }
    return [...map.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ code, name, atts }) => ({ code, name, ...aggregate(atts) }));
}

// ─── PDF document ─────────────────────────────────────────────────────────────

const C = { code: 34, name: 108, pair: 42, leave: 40, allow: 40, total: 54 };

const S = StyleSheet.create({
    page:       { fontFamily: "Helvetica", fontSize: 7, paddingTop: 18, paddingBottom: 18, paddingHorizontal: 18 },
    header:     { textAlign: "center", marginBottom: 7, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#c8d3e0", borderBottomStyle: "solid" },
    logo:       { width: 44, height: 44, objectFit: "contain", alignSelf: "center", marginBottom: 3 },
    coName:     { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
    coAddr:     { fontSize: 7, color: "#64748b", marginBottom: 1 },
    rptTitle:   { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 1 },
    rptDate:    { fontSize: 7, color: "#64748b" },
    meta:       { fontSize: 7.5, marginBottom: 5, flexDirection: "row" },
    metaBold:   { fontFamily: "Helvetica-Bold" },
    row:        { flexDirection: "row" },
    // Fixed (code/name/leave/allow/total) header cell
    thF: {
        backgroundColor: "#1e3a5f", color: "#ffffff",
        borderWidth: 0.5, borderColor: "#4a6f9f", borderStyle: "solid",
        padding: 3, justifyContent: "center", alignItems: "center",
    },
    thFText:    { fontFamily: "Helvetica-Bold", fontSize: 6, textAlign: "center" },
    // Group header cell (has sub-labels inside)
    thG: {
        backgroundColor: "#1e3a5f", color: "#ffffff",
        borderWidth: 0.5, borderColor: "#4a6f9f", borderStyle: "solid",
        padding: 3, alignItems: "center",
    },
    thGLabel:   { fontFamily: "Helvetica-Bold", fontSize: 5, textAlign: "center", marginBottom: 3 },
    thSubRow:   { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#4a6f9f", borderTopStyle: "solid", paddingTop: 2, width: "100%" },
    thSubText:  { fontSize: 5, color: "#93c5fd", textAlign: "center" },
    // Data cells
    td: {
        borderWidth: 0.5, borderColor: "#c8d3e0", borderStyle: "solid",
        paddingHorizontal: 2, paddingVertical: 2,
    },
    tdEven:     { backgroundColor: "#ffffff" },
    tdOdd:      { backgroundColor: "#f4f7fb" },
    tdCount:    { fontSize: 6.5, color: "#64748b", textAlign: "right" },
    tdAmt:      { fontSize: 7, color: "#0f172a", fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 1.5 },
    tdCode:     { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#64748b", textAlign: "center" },
    tdName:     { fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "left" },
    tdSingle:   { fontSize: 7, color: "#0f172a", textAlign: "right" },
    tdTotalBg:  { backgroundColor: "#e8f2ff" },
    tdTotalAmt: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#1e3a5f", textAlign: "right" },
    rowBorder:  { borderBottomWidth: 1, borderBottomColor: "#8fa3be", borderBottomStyle: "solid" },
    // Grand total
    gt:         { backgroundColor: "#1e3a5f" },
    gtLabel:    { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 7 },
    gtAmt:      { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 7, textAlign: "right" },
});

const DualCell = ({ count, amount, width, even }) => (
    <View style={[S.td, even ? S.tdEven : S.tdOdd, { width }]}>
        <Text style={S.tdCount}>{count}</Text>
        <Text style={S.tdAmt}>{amount}</Text>
    </View>
);

const GROUPS = [
    ["Regular Days",              "Days",      "OT Hrs"],
    ["Rest Day / Special Holiday","Reg. Days", "OT Hrs."],
    ["Legal Holiday",             "Reg. Days", "OT Hrs."],
    ["Rest Day + Special Holiday","Reg. Days", "OT Hrs."],
    ["Rest Day + Legal Holiday",  "Reg. Days", "OT Hrs."],
    ["NSD",                       "Reg Hrs.",  "OT Hrs."],
];

const BillingReportPDF = ({ report }) => {
    const { rows, clientName, dateFrom, dateTo } = report;
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const P = C.pair;

    return (
        <Document>
            <Page size={[936, 612]} style={S.page}>
                {/* Header */}
                <View style={S.header}>
                    <Image src={logo} style={S.logo} />
                    <Text style={S.coName}>YAMAN NG LAHI LABOR SERVICE COOPERATIVE</Text>
                    <Text style={S.coAddr}>Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas, Bulacan</Text>
                    <Text style={S.rptTitle}>Billing Report</Text>
                    <Text style={S.rptDate}>Date Covered: {fmtDate(dateFrom)} – {fmtDate(dateTo)}</Text>
                </View>
                <View style={S.meta}>
                    <Text>CLIENT: <Text style={S.metaBold}>{clientName}</Text></Text>
                </View>

                {/* Table header */}
                <View style={S.row}>
                    <View style={[S.thF, { width: C.code }]}><Text style={S.thFText}>Code</Text></View>
                    <View style={[S.thF, { flex: 1 }]}><Text style={S.thFText}>Employee Name</Text></View>
                    {GROUPS.map(([label, subA, subB]) => (
                        <View key={label} style={[S.thG, { width: P * 2 }]}>
                            <Text style={S.thGLabel}>{label}</Text>
                            <View style={[S.thSubRow]}>
                                <Text style={[S.thSubText, { width: P }]}>{subA}</Text>
                                <Text style={[S.thSubText, { width: P }]}>{subB}</Text>
                            </View>
                        </View>
                    ))}
                    <View style={[S.thF, { width: C.leave }]}><Text style={S.thFText}>{"Leave/SIL\nAbs/Adj"}</Text></View>
                    <View style={[S.thF, { width: C.allow }]}><Text style={S.thFText}>Allowance</Text></View>
                    <View style={[S.thF, { width: C.total }]}><Text style={S.thFText}>Total</Text></View>
                </View>

                {/* Data rows */}
                {rows.map((row, i) => {
                    const even = i % 2 === 0;
                    const bg = even ? S.tdEven : S.tdOdd;
                    return (
                        <View key={i} style={[S.row, S.rowBorder]}>
                            <View style={[S.td, bg, { width: C.code }]}><Text style={S.tdCode}>{row.code}</Text></View>
                            <View style={[S.td, bg, { flex: 1 }]}><Text style={S.tdName}>{row.name}</Text></View>
                            <DualCell even={even} width={P} count={f4(row.reg.days)}    amount={f2(row.reg.amt)} />
                            <DualCell even={even} width={P} count={f4(row.reg.otHrs)}   amount={f2(row.reg.otAmt)} />
                            <DualCell even={even} width={P} count={f4(row.rdsh.days)}   amount={f2(row.rdsh.amt)} />
                            <DualCell even={even} width={P} count={f4(row.rdsh.otHrs)}  amount={f2(row.rdsh.otAmt)} />
                            <DualCell even={even} width={P} count={f4(row.legal.days)}  amount={f2(row.legal.amt)} />
                            <DualCell even={even} width={P} count={f4(row.legal.otHrs)} amount={f2(row.legal.otAmt)} />
                            <DualCell even={even} width={P} count={f4(row.rdSh.days)}   amount={f2(row.rdSh.amt)} />
                            <DualCell even={even} width={P} count={f4(row.rdSh.otHrs)}  amount={f2(row.rdSh.otAmt)} />
                            <DualCell even={even} width={P} count={f4(row.rdLg.days)}   amount={f2(row.rdLg.amt)} />
                            <DualCell even={even} width={P} count={f4(row.rdLg.otHrs)}  amount={f2(row.rdLg.otAmt)} />
                            <DualCell even={even} width={P} count={f4(row.nsd.regHrs)}  amount={f2(row.nsd.regAmt)} />
                            <DualCell even={even} width={P} count={f4(row.nsd.otHrs)}   amount={f2(row.nsd.otAmt)} />
                            <View style={[S.td, bg, { width: C.leave }]}><Text style={S.tdSingle}>{f2(row.leaveSil)}</Text></View>
                            <View style={[S.td, bg, { width: C.allow }]}><Text style={S.tdSingle}>0.00</Text></View>
                            <View style={[S.td, bg, S.tdTotalBg, { width: C.total }]}><Text style={S.tdTotalAmt}>{f2(row.total)}</Text></View>
                        </View>
                    );
                })}

                {/* Grand total */}
                <View style={[S.row, S.gt]}>
                    <View style={[S.td, S.gt, { flex: 1 }]}><Text style={S.gtLabel}>GRAND TOTAL</Text></View>
                    <View style={[S.td, S.gt, { width: P * 12 }]} />
                    <View style={[S.td, S.gt, { width: C.leave }]} />
                    <View style={[S.td, S.gt, { width: C.allow }]} />
                    <View style={[S.td, S.gt, { width: C.total }]}><Text style={S.gtAmt}>{f2(grandTotal)}</Text></View>
                </View>
            </Page>
        </Document>
    );
};

// ─── Screen table components ───────────────────────────────────────────────────

const Th = ({ children, rowSpan, colSpan }) => (
    <th
        rowSpan={rowSpan}
        colSpan={colSpan}
        className="bg-slate-800 text-white text-[9px] font-semibold uppercase tracking-wider px-2 py-1.5 border border-slate-600 text-center whitespace-nowrap"
    >
        {children}
    </th>
);

const ThSub = ({ children }) => (
    <th className="bg-slate-700 text-slate-200 text-[8.5px] font-medium uppercase tracking-wide px-2 py-1 border border-slate-600 text-center whitespace-nowrap">
        {children}
    </th>
);

const EmpRow = ({ row, idx }) => {
    const bg = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
    const td = "px-2 py-0.5 text-right text-[10px] border border-slate-200";
    const tdAmt = `${td} text-slate-700`;
    const gs = "border-l-2 border-l-slate-300";

    return (
        <>
            <tr className={bg}>
                <td className="px-2 text-center text-[9.5px] font-mono text-slate-500 font-semibold border border-slate-200 whitespace-nowrap" rowSpan={2}>{row.code}</td>
                <td className="px-2 text-[10px] font-semibold border border-slate-200 whitespace-nowrap" rowSpan={2}>{row.name}</td>
                <td className={td}>{f4(row.reg.days)}</td>
                <td className={td}>{f4(row.reg.otHrs)}</td>
                <td className={`${td} ${gs}`}>{f4(row.rdsh.days)}</td>
                <td className={td}>{f4(row.rdsh.otHrs)}</td>
                <td className={`${td} ${gs}`}>{f4(row.legal.days)}</td>
                <td className={td}>{f4(row.legal.otHrs)}</td>
                <td className={`${td} ${gs}`}>{f4(row.rdSh.days)}</td>
                <td className={td}>{f4(row.rdSh.otHrs)}</td>
                <td className={`${td} ${gs}`}>{f4(row.rdLg.days)}</td>
                <td className={td}>{f4(row.rdLg.otHrs)}</td>
                <td className={`${td} ${gs}`}>{f4(row.nsd.regHrs)}</td>
                <td className={td}>{f4(row.nsd.otHrs)}</td>
                <td className={`${td} ${gs}`} rowSpan={2}>{f2(row.leaveSil)}</td>
                <td className={td} rowSpan={2}>0.00</td>
                <td className={`${td} ${gs} bg-blue-50 font-bold text-slate-800`} rowSpan={2}>{f2(row.total)}</td>
            </tr>
            <tr className={`${bg} border-b-2 border-b-slate-300`}>
                <td className={tdAmt}>{f2(row.reg.amt)}</td>
                <td className={tdAmt}>{f2(row.reg.otAmt)}</td>
                <td className={`${tdAmt} ${gs}`}>{f2(row.rdsh.amt)}</td>
                <td className={tdAmt}>{f2(row.rdsh.otAmt)}</td>
                <td className={`${tdAmt} ${gs}`}>{f2(row.legal.amt)}</td>
                <td className={tdAmt}>{f2(row.legal.otAmt)}</td>
                <td className={`${tdAmt} ${gs}`}>{f2(row.rdSh.amt)}</td>
                <td className={tdAmt}>{f2(row.rdSh.otAmt)}</td>
                <td className={`${tdAmt} ${gs}`}>{f2(row.rdLg.amt)}</td>
                <td className={tdAmt}>{f2(row.rdLg.otAmt)}</td>
                <td className={`${tdAmt} ${gs}`}>{f2(row.nsd.regAmt)}</td>
                <td className={tdAmt}>{f2(row.nsd.otAmt)}</td>
            </tr>
        </>
    );
};

const GrandTotal = ({ rows }) => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    return (
        <tr className="bg-slate-800 text-white font-bold text-[10px]">
            <td colSpan={2} className="px-3 py-2 border border-slate-600 uppercase tracking-wider text-[9px]">Grand Total</td>
            <td colSpan={12} className="border border-slate-600" />
            <td className="border border-slate-600" />
            <td className="border border-slate-600" />
            <td className="px-2 py-2 text-right border border-slate-600">{f2(total)}</td>
        </tr>
    );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

// Employees paid for this period who have no timekeeping, and so are missing
// from the bill entirely. Shown on screen only — the printed bill stays a clean
// client document.
const UnbilledNotice = ({ unbilled = [] }) => {
    const [open, setOpen] = useState(false);
    if (unbilled.length === 0) return null;

    const total = unbilled.reduce((s, u) => s + u.amount, 0);

    return (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">
                {unbilled.length} employee{unbilled.length === 1 ? "" : "s"} paid for this
                period {unbilled.length === 1 ? "is" : "are"} not on this bill
            </p>
            <p className="mt-1 text-xs text-amber-800">
                They have no attendance on file, so there is nothing to bill them for.
                Their payroll came to{" "}
                <strong>₱{f2(total)}</strong>. Key their timekeeping before sending this
                bill, or that labour goes out unbilled.
            </p>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-2 text-xs font-semibold text-amber-900 underline underline-offset-2"
            >
                {open ? "Hide" : "Show"} the list
            </button>
            {open && (
                <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-amber-900">
                    {unbilled.map((u, i) => (
                        <li key={i} className="flex justify-between gap-4 py-0.5 tabular-nums">
                            <span>{u.code} — {u.name}</span>
                            <span>₱{f2(u.amount)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const BillingReport = () => {
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
                dateFrom: filter.dateFrom,
                dateTo: filter.dateTo,
                limit: 10000,
            });
            // The bill is built from attendance, so an employee with no
            // timekeeping simply does not appear on it. Pull the payrolls for
            // the same window too: anyone paid for this period but missing from
            // the bill is labour that went out the door unbilled, and silently
            // omitting them is how a cutoff gets under-billed.
            const payrollParams = new URLSearchParams({
                client: filter.clientId,
                from: filter.dateFrom,
                to: filter.dateTo,
                limit: 10000,
            });
            const [{ data }, { data: payrollData }] = await Promise.all([
                customFetch.get(`/attendances?${params}`),
                customFetch.get(`/payrolls?${payrollParams}`),
            ]);
            const attendances = data.attendances || [];
            const rows = buildRows(attendances);

            const billed = new Set(
                attendances.map((a) => String(a.compensation?._id ?? a.compensation)),
            );
            const unbilled = (payrollData.payrolls || [])
                .filter((p) => !billed.has(String(p.compensation?._id ?? p.compensation)))
                .map((p) => {
                    const emp = p.compensation?.employeeDesignation?.employee;
                    return {
                        code: emp?.employeeCode ?? "—",
                        name: emp ? `${emp.lastName}, ${emp.firstName}` : "—",
                        amount:
                            (p.regularPay || 0) + (p.regularOTPay || 0) +
                            (p.holidayRestDayPay || 0) + (p.holidayRestDayOTPay || 0) +
                            (p.nightDifferentialPay || 0) + (p.leavePay || 0),
                    };
                })
                .sort((a, b) => b.amount - a.amount);

            const clientName = clients.find((c) => c._id === filter.clientId)?.clientName ?? "";
            setReport({ rows, unbilled, clientName, dateFrom: filter.dateFrom, dateTo: filter.dateTo });
        } catch {
            setError("Failed to load attendance data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        if (!report) return;
        setPdfLoading(true);
        try {
            const blob = await pdf(<BillingReportPDF report={report} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `billing-report-${report.dateFrom}-to-${report.dateTo}.pdf`;
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
                <h1 className="text-2xl font-bold text-slate-800 mb-4">Billing Report</h1>
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
                        <p className="font-bold text-sm mt-2">Billing Report</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Date Covered: {fmtDate(report.dateFrom)} – {fmtDate(report.dateTo)}
                        </p>
                    </div>
                    <p className="text-xs mb-3">CLIENT: <strong>{report.clientName}</strong></p>

                    <UnbilledNotice unbilled={report.unbilled} />

                    <div className="overflow-x-auto bg-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                        <table className="border-collapse min-w-full">
                            <thead>
                                <tr>
                                    <Th rowSpan={2}>Code</Th>
                                    <Th rowSpan={2}>Employee Name</Th>
                                    <Th colSpan={2}>Regular Days</Th>
                                    <Th colSpan={2}>Rest Day / Special Holiday</Th>
                                    <Th colSpan={2}>Legal Holiday</Th>
                                    <Th colSpan={2}>Rest Day + Special Holiday</Th>
                                    <Th colSpan={2}>Rest Day + Legal Holiday</Th>
                                    <Th colSpan={2}>NSD</Th>
                                    <Th rowSpan={2}>Leave / SIL{"\n"}Abs / Adj</Th>
                                    <Th rowSpan={2}>Allowance</Th>
                                    <Th rowSpan={2}>Total</Th>
                                </tr>
                                <tr>
                                    <ThSub>Days</ThSub><ThSub>OT Hrs</ThSub>
                                    <ThSub>Reg. Days</ThSub><ThSub>OT Hrs.</ThSub>
                                    <ThSub>Reg. Days</ThSub><ThSub>OT Hrs.</ThSub>
                                    <ThSub>Reg. Days</ThSub><ThSub>OT Hrs.</ThSub>
                                    <ThSub>Reg. Days</ThSub><ThSub>OT Hrs.</ThSub>
                                    <ThSub>Reg Hrs.</ThSub><ThSub>OT Hrs.</ThSub>
                                </tr>
                            </thead>
                            <tbody>
                                {report.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={17} className="text-center py-10 text-slate-400 text-sm">
                                            No attendance records found for the selected period.
                                        </td>
                                    </tr>
                                ) : (
                                    report.rows.map((row, i) => <EmpRow key={i} row={row} idx={i} />)
                                )}
                                {report.rows.length > 0 && <GrandTotal rows={report.rows} />}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};

export default BillingReport;
