import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import logo from "../assets/ynl.png";
import { employeeName, sortPayslipsByName } from "./payslipOrder";
import { f2, isoDay, sum, buildSlipModel } from "./payslipData";

// Compact payslip — a reproduction of the pre-printed cooperative slip, six to
// a Letter sheet (2 across, 3 down). Each slip pairs the pay breakdown on the
// left with the day-by-day timekeeping it was built from on the right, so an
// employee can check the money against their own record of the days.

// ─── helpers ─────────────────────────────────────────────────────────────────

const C = {
    ink: "#000000",
    rule: "#666666",
    faint: "#999999",
};

// Letter 612 x 792. Three rows of two, with a small outer margin.
const PAGE_PAD = 14;
const SLIP_W = (612 - PAGE_PAD * 2) / 2;
const SLIP_H = (792 - PAGE_PAD * 2) / 3;
const TABLE_W = 116;

const s = StyleSheet.create({
    page: {
        fontFamily: "Helvetica",
        paddingTop: PAGE_PAD,
        paddingBottom: PAGE_PAD,
        paddingHorizontal: PAGE_PAD,
        flexDirection: "row",
        flexWrap: "wrap",
    },
    slip: {
        width: SLIP_W,
        height: SLIP_H,
        borderWidth: 0.5,
        borderColor: C.rule,
        borderStyle: "solid",
        paddingVertical: 5,
        paddingHorizontal: 6,
        flexDirection: "column",
    },
    empty: { width: SLIP_W, height: SLIP_H },

    // Masthead spans the whole slip so the logo and company name sit on the
    // slip's centre line, not the centre of the left-hand column.
    header: { alignItems: "center", marginBottom: 3 },
    logo: { width: 15, height: 15, objectFit: "contain" },
    coName: { fontFamily: "Helvetica-Bold", fontSize: 5.4, textAlign: "center" },
    coAddr: { fontSize: 3.5, textAlign: "center" },

    // body: payslip on the left, the days it was built from on the right
    body: { flexDirection: "row", flex: 1 },
    left: { flex: 1, paddingRight: 4 },

    slipLabel: { fontFamily: "Helvetica-Bold", fontSize: 4.8, marginBottom: 0.8 },
    meta: { fontSize: 4.4, marginBottom: 0.8 },

    colsHead: { flexDirection: "row", marginTop: 2, marginBottom: 1 },
    headEarn: { fontFamily: "Helvetica-Bold", fontSize: 4.8, width: "48%" },
    headDed: { fontFamily: "Helvetica-Bold", fontSize: 4.8 },

    cols: { flexDirection: "row", flex: 1 },
    colEarn: { width: "48%", paddingRight: 3 },
    colDed: { flex: 1 },

    line: { flexDirection: "row", justifyContent: "space-between", marginBottom: 0.7 },
    lineLabel: { fontSize: 4.3 },
    lineLabelBold: { fontSize: 4.6, fontFamily: "Helvetica-Bold" },
    lineAmt: { fontSize: 4.3, textAlign: "right" },
    lineAmtBold: { fontSize: 4.6, fontFamily: "Helvetica-Bold", textAlign: "right" },

    // right: the day table
    table: { width: TABLE_W },
    tRow: { flexDirection: "row" },
    tHeadTop: { fontSize: 3.6, fontFamily: "Helvetica-Bold", textAlign: "center" },
    tHead: { fontSize: 3.6, fontFamily: "Helvetica-Bold", textAlign: "center" },
    tCell: { fontSize: 3.9, textAlign: "center" },
    tCellDay: { fontSize: 3.9, textAlign: "center" },
    tRule: {
        borderBottomWidth: 0.5,
        borderBottomColor: C.rule,
        borderBottomStyle: "solid",
        marginBottom: 1,
        paddingBottom: 0.8,
    },
    tTotal: {
        borderTopWidth: 0.5,
        borderTopColor: C.rule,
        borderTopStyle: "solid",
        paddingTop: 0.8,
        marginTop: 0.8,
    },
    tTotalText: { fontSize: 3.9, fontFamily: "Helvetica-Bold", textAlign: "center" },
});

// Column widths inside the day table, summing to TABLE_W.
const COL = { day: 18, reg: 26, ot: 24, rnd: 24, ond: 24 };

const Line = ({ label, value, bold }) => (
    <View style={s.line}>
        <Text style={bold ? s.lineLabelBold : s.lineLabel}>{label}</Text>
        <Text style={bold ? s.lineAmtBold : s.lineAmt}>{f2(value)}</Text>
    </View>
);

const DayTable = ({ rows }) => (
    <View style={s.table}>
        <View style={s.tRow}>
            <Text style={[s.tHeadTop, { width: COL.day }]}> </Text>
            <Text style={[s.tHeadTop, { width: COL.reg }]}>REG</Text>
            <Text style={[s.tHeadTop, { width: COL.ot }]}>OT</Text>
            <Text style={[s.tHeadTop, { width: COL.rnd }]}>REG</Text>
            <Text style={[s.tHeadTop, { width: COL.ond }]}>OT</Text>
        </View>
        <View style={[s.tRow, s.tRule]}>
            <Text style={[s.tHead, { width: COL.day }]}>Day</Text>
            <Text style={[s.tHead, { width: COL.reg }]}>DAYS</Text>
            <Text style={[s.tHead, { width: COL.ot }]}>HRS</Text>
            <Text style={[s.tHead, { width: COL.rnd }]}>ND</Text>
            <Text style={[s.tHead, { width: COL.ond }]}>ND</Text>
        </View>

        {rows.map((r) => (
            <View key={r.day} style={s.tRow}>
                <Text style={[s.tCellDay, { width: COL.day }]}>{r.day}</Text>
                <Text style={[s.tCell, { width: COL.reg }]}>{f2(r.regularHours)}</Text>
                <Text style={[s.tCell, { width: COL.ot }]}>{f2(r.overtimeHours)}</Text>
                <Text style={[s.tCell, { width: COL.rnd }]}>{f2(r.nightPremiumHours)}</Text>
                <Text style={[s.tCell, { width: COL.ond }]}>{f2(r.overtimeNightPremiumHours)}</Text>
            </View>
        ))}

        <View style={[s.tRow, s.tTotal]}>
            <Text style={[s.tTotalText, { width: COL.day }]}>Tot</Text>
            <Text style={[s.tTotalText, { width: COL.reg }]}>{f2(sum(rows, "regularHours"))}</Text>
            <Text style={[s.tTotalText, { width: COL.ot }]}>{f2(sum(rows, "overtimeHours"))}</Text>
            <Text style={[s.tTotalText, { width: COL.rnd }]}>{f2(sum(rows, "nightPremiumHours"))}</Text>
            <Text style={[s.tTotalText, { width: COL.ond }]}>{f2(sum(rows, "overtimeNightPremiumHours"))}</Text>
        </View>
    </View>
);

const Slip = ({ payroll, attendance = [] }) => {
    if (!payroll) return <View style={s.empty} />;

    const m = buildSlipModel(payroll, attendance);
    const name = employeeName(m.employee);
    const e = m.earnings;

    return (
        <View style={s.slip}>
            <View style={s.header}>
                <Image src={logo} style={s.logo} />
                <Text style={s.coName}>YAMAN NG LAHI LABOR SERVICE COOPERATIVE</Text>
                <Text style={s.coAddr}>
                    Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas, Bulacan
                </Text>
            </View>

            <View style={s.body}>
                <View style={s.left}>
                    <Text style={s.slipLabel}>PAYSLIP:</Text>
                    <Text style={s.meta}>Employee Name: {name}</Text>
                    <Text style={s.meta}>Employee Code: {m.employeeCode}</Text>
                    <Text style={s.meta}>
                        Payroll Period: {m.period}
                    </Text>

                    <View style={s.colsHead}>
                        <Text style={s.headEarn}>EARNINGS:</Text>
                        <Text style={s.headDed}>DEDUCTIONS:</Text>
                    </View>

                    <View style={s.cols}>
                        <View style={s.colEarn}>
                            <Line label="REG PAY" value={e.regPay} />
                            <Line label="OT PAY" value={e.otPay} />
                            <Line label="HOL/RD PAY" value={e.holRdPay} />
                            <Line label="HOL/RD PAY OT" value={e.holRdPayOt} />
                            <Line label="NIGHT DIFF" value={e.nightDiff} />
                            <Line label="NIGHT DIFF OT" value={e.nightDiffOt} />
                            <Line label="LEAVE/SIL/ABS/ADJ" value={e.leaveSil} />
                            <Line label="GROSS PAY" value={e.gross} bold />
                            <Line label="ALLW" value={e.allowances} />
                            <Line label="NET PAY" value={m.netPay} bold />
                        </View>

                        <View style={s.colDed}>
                            {m.deductions.map((d, i) => (
                                <Line key={i} label={d.label} value={d.value} />
                            ))}
                            <Line label="TOTAL:" value={m.totalDeductions} bold />
                        </View>
                    </View>
                </View>

                <DayTable rows={m.days} />
            </View>
        </View>
    );
};

const SLIPS_PER_PAGE = 6;

/**
 * @param {Array}  payrolls   payroll records, each with compensation populated
 * @param {Object} attendance map of compensation id -> that employee's rows
 */
export const BulkCompactPayslipPDF = ({ payrolls = [], attendance = {} }) => {
    // Sorted here rather than at the call site so the document holds the
    // property whatever order it is handed.
    const ordered = sortPayslipsByName(payrolls);

    const pages = [];
    for (let i = 0; i < ordered.length; i += SLIPS_PER_PAGE) {
        pages.push(ordered.slice(i, i + SLIPS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);

    const rowsFor = (p) => {
        const id = String(p?.compensation?._id ?? p?.compensation ?? "");
        const all = attendance[id] || [];
        // The map holds every row fetched for the period; keep only the days
        // this payroll actually covers, so a wider fetch cannot bleed across.
        const from = isoDay(p.payrollFrom);
        const to = isoDay(p.payrollTo);
        return all.filter((a) => {
            const d = isoDay(a.attendanceDate);
            return d >= from && d <= to;
        });
    };

    return (
        <Document>
            {pages.map((group, idx) => (
                <Page key={idx} size="LETTER" style={s.page}>
                    {group.map((p, i) => (
                        <Slip key={i} payroll={p} attendance={rowsFor(p)} />
                    ))}
                </Page>
            ))}
        </Document>
    );
};

export const CompactPayslipPDF = ({ payroll, attendance = [] }) => (
    <Document>
        <Page size="LETTER" style={s.page}>
            <Slip payroll={payroll} attendance={attendance} />
        </Page>
    </Document>
);

export default BulkCompactPayslipPDF;
