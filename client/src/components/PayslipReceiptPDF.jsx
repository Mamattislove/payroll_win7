import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import logo from "../assets/ynl.png";
import { employeeName, sortPayslipsByName } from "./payslipOrder";
import { f2, isoDay, buildSlipModel } from "./payslipData";

// Payslip with the acknowledgment receipt beneath it, four to a Letter sheet.
// The sheet cuts into four slips; each slip tears along the dashed line into
// the employee's payslip and the receipt they sign and hand back.
//
// Laid out two across and two down rather than four stacked: a slip has to
// carry the payslip and the eleven-line receipt one above the other, which
// needs roughly 200pt of height. Four full-width rows would leave 191pt each
// and overflow, while a 2x2 grid gives 382pt with room to spare.

const C = { rule: "#666666", cut: "#999999" };

// Letter 612 x 792, four slips in a 2 x 2 grid.
const PAGE_PAD = 14;
const SLIP_W = (612 - PAGE_PAD * 2) / 2;
const SLIP_H = (792 - PAGE_PAD * 2) / 2;
const DAY_TABLE_W = 116;

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
        paddingHorizontal: 8,
        flexDirection: "column",
    },

    // masthead, centred on the slip's own axis
    header: { alignItems: "center", marginBottom: 2 },
    logo: { width: 15, height: 15, objectFit: "contain" },
    coName: { fontFamily: "Helvetica-Bold", fontSize: 6, textAlign: "center" },
    coAddr: { fontSize: 4, textAlign: "center" },

    body: { flexDirection: "row" },
    left: { flex: 1, paddingRight: 6 },

    slipLabel: { fontFamily: "Helvetica-Bold", fontSize: 5.2, marginBottom: 1 },
    meta: { fontSize: 5, marginBottom: 1 },

    colsHead: { flexDirection: "row", marginTop: 2, marginBottom: 1 },
    headEarn: { fontFamily: "Helvetica-Bold", fontSize: 5.2, width: "47%" },
    headDed: { fontFamily: "Helvetica-Bold", fontSize: 5.2 },
    cols: { flexDirection: "row" },
    colEarn: { width: "47%", paddingRight: 4 },
    colDed: { flex: 1 },

    line: { flexDirection: "row", justifyContent: "space-between", marginBottom: 0.8 },
    lbl: { fontSize: 4.8 },
    lblB: { fontSize: 5.1, fontFamily: "Helvetica-Bold" },
    amt: { fontSize: 4.8, textAlign: "right" },
    amtB: { fontSize: 5.1, fontFamily: "Helvetica-Bold", textAlign: "right" },

    // day table
    table: { width: DAY_TABLE_W },
    tRow: { flexDirection: "row" },
    tHead: { fontSize: 4.2, fontFamily: "Helvetica-Bold", textAlign: "center" },
    tCell: { fontSize: 4.4, textAlign: "center" },
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
    tTotalText: { fontSize: 4.4, fontFamily: "Helvetica-Bold", textAlign: "center" },

    // tear line between the payslip and the receipt
    cut: {
        borderTopWidth: 0.7,
        borderTopColor: C.cut,
        borderTopStyle: "dashed",
        marginVertical: 3,
    },

    // acknowledgment receipt
    ackTitle: {
        fontFamily: "Helvetica-Bold",
        fontSize: 5.6,
        textAlign: "center",
        marginBottom: 2,
    },
    ackBody: { flexDirection: "row" },
    ackLeft: { width: "42%", paddingRight: 8, justifyContent: "center" },
    ackRight: { flex: 1 },
    ackPartHead: {
        fontFamily: "Helvetica-Bold",
        fontSize: 5.2,
        textAlign: "center",
        marginBottom: 1,
    },
    ackMetaLabel: { fontSize: 4.8, marginBottom: 0.3 },
    ackMetaValue: { fontSize: 5, fontFamily: "Helvetica-Bold", marginBottom: 1.5 },
});

const COL = { day: 18, reg: 26, ot: 24, rnd: 24, ond: 24 };

const Line = ({ label, value, bold }) => (
    <View style={s.line}>
        <Text style={bold ? s.lblB : s.lbl}>{label}</Text>
        <Text style={bold ? s.amtB : s.amt}>{f2(value)}</Text>
    </View>
);

const DayTable = ({ days, totals }) => (
    <View style={s.table}>
        <View style={s.tRow}>
            <Text style={[s.tHead, { width: COL.day }]}> </Text>
            <Text style={[s.tHead, { width: COL.reg }]}>REG</Text>
            <Text style={[s.tHead, { width: COL.ot }]}>OT</Text>
            <Text style={[s.tHead, { width: COL.rnd }]}>REG</Text>
            <Text style={[s.tHead, { width: COL.ond }]}>OT</Text>
        </View>
        <View style={[s.tRow, s.tRule]}>
            <Text style={[s.tHead, { width: COL.day }]}>Day</Text>
            <Text style={[s.tHead, { width: COL.reg }]}>DAYS</Text>
            <Text style={[s.tHead, { width: COL.ot }]}>HRS</Text>
            <Text style={[s.tHead, { width: COL.rnd }]}>ND</Text>
            <Text style={[s.tHead, { width: COL.ond }]}>ND</Text>
        </View>
        {days.map((r) => (
            <View key={r.day} style={s.tRow}>
                <Text style={[s.tCell, { width: COL.day }]}>{r.day}</Text>
                <Text style={[s.tCell, { width: COL.reg }]}>{f2(r.regularHours)}</Text>
                <Text style={[s.tCell, { width: COL.ot }]}>{f2(r.overtimeHours)}</Text>
                <Text style={[s.tCell, { width: COL.rnd }]}>{f2(r.nightPremiumHours)}</Text>
                <Text style={[s.tCell, { width: COL.ond }]}>{f2(r.overtimeNightPremiumHours)}</Text>
            </View>
        ))}
        <View style={[s.tRow, s.tTotal]}>
            <Text style={[s.tTotalText, { width: COL.day }]}>Tot</Text>
            <Text style={[s.tTotalText, { width: COL.reg }]}>{f2(totals.regularHours)}</Text>
            <Text style={[s.tTotalText, { width: COL.ot }]}>{f2(totals.overtimeHours)}</Text>
            <Text style={[s.tTotalText, { width: COL.rnd }]}>{f2(totals.nightPremiumHours)}</Text>
            <Text style={[s.tTotalText, { width: COL.ond }]}>{f2(totals.overtimeNightPremiumHours)}</Text>
        </View>
    </View>
);

const Slip = ({ payroll, attendance = [] }) => {
    if (!payroll) return <View style={{ width: SLIP_W, height: SLIP_H }} />;

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
                    <Text style={s.meta}>Payroll Period: {m.period}</Text>

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

                <DayTable days={m.days} totals={m.totals} />
            </View>

            <View style={s.cut} />

            <Text style={s.ackTitle}>ACKNOWLEDGMENT RECEIPT</Text>
            <View style={s.ackBody}>
                <View style={s.ackLeft}>
                    <Text style={s.ackMetaLabel}>Employee Name:</Text>
                    <Text style={s.ackMetaValue}>{name}</Text>
                    <Text style={s.ackMetaLabel}>Employee Code:</Text>
                    <Text style={s.ackMetaValue}>{m.employeeCode}</Text>
                    <Line label="NET PAY" value={m.netPay} bold />
                    <Line label="PARTICULARS:" value={m.particularsTotal} bold />
                    <Line label="FINAL PAY" value={m.finalPay} bold />
                </View>

                <View style={s.ackRight}>
                    <Text style={s.ackPartHead}>PARTICULARS</Text>
                    {m.particulars.map((r, i) => (
                        <Line key={i} label={r.label} value={r.value} />
                    ))}
                </View>
            </View>
        </View>
    );
};

const SLIPS_PER_PAGE = 4;

/**
 * @param {Array}  payrolls   payroll records, each with compensation populated
 * @param {Object} attendance map of compensation id -> that employee's rows
 */
export const BulkPayslipReceiptPDF = ({ payrolls = [], attendance = {} }) => {
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
        // this payroll covers, so a wider fetch cannot bleed across.
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

export default BulkPayslipReceiptPDF;
