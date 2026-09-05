import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v) =>
    v != null
        ? `PHP ${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "PHP 0.00";

const toDateShort = (v) =>
    v
        ? new Date(v).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "—";

// ─── colors ──────────────────────────────────────────────────────────────────

const C = {
    dark: "#0f172a",
    mid: "#475569",
    light: "#94a3b8",
    border: "#e2e8f0",
    bg: "#f8fafc",
    red: "#dc2626",
    white: "#ffffff",
    cut: "#cbd5e1",
};

// Letter = 612pt × 792pt  |  each half = 612pt × 384pt  |  cut bar = 24pt
const HALF_H = 384;
const CUT_H = 24;

// ─── styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    page: {
        fontFamily: "Helvetica",
        fontSize: 7.5,
        color: C.dark,
        lineHeight: 1.25,
        backgroundColor: C.white,
    },

    // ── each payslip half ─────────────────────────────────────────────────────
    half: {
        height: HALF_H,
        overflow: "hidden",
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 10,
        flexDirection: "column",
    },

    // ── header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingBottom: 6,
        borderBottom: `1.5pt solid ${C.dark}`,
        marginBottom: 7,
    },
    headerTitle: {
        fontSize: 13,
        fontFamily: "Helvetica-Bold",
        letterSpacing: 1.2,
    },
    headerSub: { fontSize: 6, color: C.mid, marginTop: 1 },
    headerRight: { alignItems: "flex-end" },
    headerPeriod: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
    headerDate: { fontSize: 6, color: C.mid, marginTop: 1 },

    // ── employee info row ─────────────────────────────────────────────────────
    infoBox: {
        flexDirection: "row",
        backgroundColor: C.bg,
        border: `0.5pt solid ${C.border}`,
        borderRadius: 2,
        padding: "5 8",
        marginBottom: 7,
    },
    infoCell: { flex: 1, paddingRight: 8 },
    infoLabel: {
        fontSize: 5.5,
        color: C.light,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        marginBottom: 1,
    },
    infoValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

    // ── two-column earnings / deductions ─────────────────────────────────────
    twoCol: { flexDirection: "row", gap: 7, flex: 1, overflow: "hidden", marginBottom: 6 },
    col: { flex: 1 },

    sectionHead: {
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: C.dark,
        padding: "2.5 6",
    },
    sectionTitle: {
        fontSize: 5.5,
        fontFamily: "Helvetica-Bold",
        color: C.white,
        letterSpacing: 0.6,
    },
    sectionTotal: { fontSize: 5.5, fontFamily: "Helvetica-Bold", color: C.white },

    subHead: {
        backgroundColor: "#f1f5f9",
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderBottom: `0.3pt solid ${C.border}`,
    },
    subHeadText: {
        fontSize: 5.5,
        fontFamily: "Helvetica-Bold",
        color: C.mid,
        letterSpacing: 0.4,
    },

    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 1.8,
        paddingHorizontal: 6,
        borderBottom: `0.3pt solid ${C.border}`,
    },
    rowLabel: { fontSize: 6.5, color: C.mid, flex: 1, paddingRight: 3 },
    rowValue: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
    rowValueRed: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.red, textAlign: "right" },

    // ── summary bar (4 cells in a row) ────────────────────────────────────────
    summaryBar: {
        flexDirection: "row",
        border: `0.5pt solid ${C.border}`,
        borderRadius: 2,
        overflow: "hidden",
    },
    summaryCell: {
        flex: 1,
        padding: "4 6",
        borderRight: `0.5pt solid ${C.border}`,
        alignItems: "center",
    },
    summaryCellFinal: {
        flex: 1,
        padding: "4 6",
        backgroundColor: C.dark,
        alignItems: "center",
    },
    summaryCellLabel: { fontSize: 5.5, color: C.mid, marginBottom: 1.5 },
    summaryCellValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
    summaryCellLabelDark: { fontSize: 5.5, color: "#94a3b8", marginBottom: 1.5 },
    summaryCellValueDark: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.white },

    // ── footer ────────────────────────────────────────────────────────────────
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        borderTop: `0.3pt solid ${C.border}`,
        paddingTop: 4,
        marginTop: 5,
    },
    footerText: { fontSize: 5.5, color: C.light },

    // ── cut line ──────────────────────────────────────────────────────────────
    cutBar: {
        height: CUT_H,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        gap: 6,
    },
    cutDash: { flex: 1, borderTop: `0.7pt dashed ${C.cut}` },
    cutText: {
        fontSize: 6,
        color: C.cut,
        fontFamily: "Helvetica-Bold",
        letterSpacing: 1.5,
    },
});

// ─── sub-components ──────────────────────────────────────────────────────────

const SectionHead = ({ title, total }) => (
    <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {total != null && <Text style={s.sectionTotal}>{fmt(total)}</Text>}
    </View>
);

const SubHead = ({ label }) => (
    <View style={s.subHead}>
        <Text style={s.subHeadText}>{label}</Text>
    </View>
);

const DataRow = ({ label, value, red }) => (
    <View style={s.row}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={red ? s.rowValueRed : s.rowValue}>{value}</Text>
    </View>
);

const CutLine = () => (
    <View style={s.cutBar}>
        <View style={s.cutDash} />
        <Text style={s.cutText}>CUT HERE</Text>
        <View style={s.cutDash} />
    </View>
);

// ─── single payslip half ─────────────────────────────────────────────────────

const PayrollHalf = ({ payroll: p }) => {
    if (!p) return <View style={s.half} />;

    const desig = p.compensation?.employeeDesignation;
    const emp = desig?.employee;
    const name = emp ? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() : "—";

    const earningsTotal =
        (p.regularPay || 0) +
        (p.regularOTPay || 0) +
        (p.holidayRestDayPay || 0) +
        (p.holidayRestDayOTPay || 0) +
        (p.nightDifferentialPay || 0) +
        (p.leavePay || 0) +
        (p.earning || []).reduce((a, r) => a + (r.amount || 0), 0) +
        (p.allowances || []).reduce((a, r) => a + (r.amount || 0), 0);

    const deductionsTotal =
        (p.absences || 0) +
        (p.late || 0) +
        (p.undertime || 0) +
        (p.sssContribution || 0) +
        (p.philhealthContribution || 0) +
        (p.pagibigContribution || 0) +
        (p.withholdingTax || 0) +
        (p.deductions || []).reduce((a, r) => a + (r.amount || 0), 0) +
        (p.loans || []).reduce((a, r) => a + (r.amount || 0), 0) +
        (p.savings || []).reduce((a, r) => a + (r.amount || 0), 0) +
        (p.charges || []).reduce((a, r) => a + (r.amount || 0), 0);

    const hasExtra = (p.earning || []).length > 0 || (p.allowances || []).length > 0;
    const hasOther =
        (p.deductions || []).length > 0 ||
        (p.loans || []).length > 0 ||
        (p.savings || []).length > 0 ||
        (p.charges || []).length > 0;
    const hasAbsDed = (p.absences || 0) > 0 || (p.late || 0) > 0 || (p.undertime || 0) > 0;

    return (
        <View style={s.half}>
            {/* Header */}
            <View style={s.header}>
                <View>
                    <Text style={s.headerTitle}>PAYROLL SLIP</Text>
                    <Text style={s.headerSub}>Generated {toDateShort(new Date())}</Text>
                </View>
                <View style={s.headerRight}>
                    <Text style={s.headerPeriod}>
                        {toDateShort(p.payrollFrom)} – {toDateShort(p.payrollTo)}
                    </Text>
                    <Text style={s.headerDate}>
                        Payroll Date: {toDateShort(p.payrollDate)}
                    </Text>
                </View>
            </View>

            {/* Employee Info */}
            <View style={s.infoBox}>
                <View style={[s.infoCell, { flex: 2 }]}>
                    <Text style={s.infoLabel}>Employee</Text>
                    <Text style={s.infoValue}>{name}</Text>
                </View>
                <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Code</Text>
                    <Text style={s.infoValue}>{emp?.employeeCode || "—"}</Text>
                </View>
                <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Position</Text>
                    <Text style={s.infoValue}>{desig?.position?.positionName || "—"}</Text>
                </View>
                <View style={s.infoCell}>
                    <Text style={s.infoLabel}>Department</Text>
                    <Text style={s.infoValue}>{desig?.department?.departmentName || "—"}</Text>
                </View>
            </View>

            {/* Earnings | Deductions */}
            <View style={s.twoCol}>
                {/* Earnings */}
                <View style={s.col}>
                    <SectionHead title="EARNINGS" total={earningsTotal} />
                    <SubHead label="ATTENDANCE" />
                    <DataRow label="Regular Pay" value={fmt(p.regularPay)} />
                    {(p.regularOTPay || 0) > 0 && (
                        <DataRow label="Regular OT" value={fmt(p.regularOTPay)} />
                    )}
                    {(p.holidayRestDayPay || 0) > 0 && (
                        <DataRow label="Holiday / RD Pay" value={fmt(p.holidayRestDayPay)} />
                    )}
                    {(p.holidayRestDayOTPay || 0) > 0 && (
                        <DataRow label="Holiday OT" value={fmt(p.holidayRestDayOTPay)} />
                    )}
                    {(p.nightDifferentialPay || 0) > 0 && (
                        <DataRow label="Night Differential" value={fmt(p.nightDifferentialPay)} />
                    )}
                    {(p.leavePay || 0) > 0 && (
                        <DataRow label="Leave With Pay" value={fmt(p.leavePay)} />
                    )}
                    {hasExtra && <SubHead label="ADDITIONAL" />}
                    {(p.earning || []).map((r, i) => (
                        <DataRow key={`e${i}`} label={r.name || "Earning"} value={fmt(r.amount)} />
                    ))}
                    {(p.allowances || []).map((r, i) => (
                        <DataRow key={`a${i}`} label={r.name || "Allowance"} value={fmt(r.amount)} />
                    ))}
                </View>

                {/* Deductions */}
                <View style={s.col}>
                    <SectionHead title="DEDUCTIONS" total={deductionsTotal} />
                    {hasAbsDed && <SubHead label="ATTENDANCE" />}
                    {(p.absences || 0) > 0 && (
                        <DataRow label="Absences" value={fmt(p.absences)} red />
                    )}
                    {(p.late || 0) > 0 && (
                        <DataRow label="Late" value={fmt(p.late)} red />
                    )}
                    {(p.undertime || 0) > 0 && (
                        <DataRow label="Undertime" value={fmt(p.undertime)} red />
                    )}
                    <SubHead label="GOVERNMENT" />
                    {(p.sssContribution || 0) > 0 && (
                        <DataRow label="SSS" value={fmt(p.sssContribution)} />
                    )}
                    {(p.philhealthContribution || 0) > 0 && (
                        <DataRow label="PhilHealth" value={fmt(p.philhealthContribution)} />
                    )}
                    {(p.pagibigContribution || 0) > 0 && (
                        <DataRow label="Pag-IBIG" value={fmt(p.pagibigContribution)} />
                    )}
                    {(p.withholdingTax || 0) > 0 && (
                        <DataRow label="W/Tax" value={fmt(p.withholdingTax)} />
                    )}
                    {hasOther && <SubHead label="OTHER" />}
                    {(p.deductions || []).map((r, i) => (
                        <DataRow
                            key={`d${i}`}
                            label={r.deductionRecord?.name || "Deduction"}
                            value={fmt(r.amount)}
                        />
                    ))}
                    {(p.loans || []).map((r, i) => (
                        <DataRow
                            key={`l${i}`}
                            label={r.loan?.loanName || "Loan"}
                            value={fmt(r.amount)}
                        />
                    ))}
                    {(p.savings || []).map((r, i) => (
                        <DataRow key={`s${i}`} label="Savings" value={fmt(r.amount)} />
                    ))}
                    {(p.charges || []).map((r, i) => (
                        <DataRow key={`c${i}`} label={r.name || "Charge"} value={fmt(r.amount)} />
                    ))}
                </View>
            </View>

            {/* Summary bar */}
            <View style={s.summaryBar}>
                <View style={s.summaryCell}>
                    <Text style={s.summaryCellLabel}>Gross Pay</Text>
                    <Text style={s.summaryCellValue}>{fmt(p.grossPay)}</Text>
                </View>
                <View style={s.summaryCell}>
                    <Text style={s.summaryCellLabel}>Total Deductions</Text>
                    <Text style={[s.summaryCellValue, { color: C.red }]}>
                        -{fmt(p.totalDeductions)}
                    </Text>
                </View>
                <View style={s.summaryCell}>
                    <Text style={s.summaryCellLabel}>Net Salary</Text>
                    <Text style={s.summaryCellValue}>{fmt(p.netSalary)}</Text>
                </View>
                <View style={s.summaryCellFinal}>
                    <Text style={s.summaryCellLabelDark}>FINAL PAY</Text>
                    <Text style={s.summaryCellValueDark}>{fmt(p.finalPay)}</Text>
                </View>
            </View>

            {/* Footer */}
            <View style={s.footer}>
                <Text style={s.footerText}>
                    {name} · {toDateShort(p.payrollFrom)} – {toDateShort(p.payrollTo)}
                </Text>
                <Text style={s.footerText}>
                    Computer-generated document. No signature required.
                </Text>
            </View>
        </View>
    );
};

// ─── exports ─────────────────────────────────────────────────────────────────

// Single payslip — half-Letter page (8.5" × 5.5")
export const PayrollPDF = ({ payroll }) => (
    <Document>
        <Page size={[612, HALF_H]} style={s.page}>
            <PayrollHalf payroll={payroll} />
        </Page>
    </Document>
);

// Bulk payslips — 2-up on Letter (8.5" × 11"), cut line in the middle
export const BulkPayrollPDF = ({ payrolls }) => {
    const pairs = [];
    for (let i = 0; i < payrolls.length; i += 2) {
        pairs.push([payrolls[i], payrolls[i + 1] ?? null]);
    }
    return (
        <Document>
            {pairs.map(([p1, p2], idx) => (
                <Page key={idx} size="LETTER" style={s.page}>
                    <PayrollHalf payroll={p1} />
                    <CutLine />
                    <PayrollHalf payroll={p2} />
                </Page>
            ))}
        </Document>
    );
};
