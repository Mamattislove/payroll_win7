import { useState } from "react";
import { FiDownload, FiX } from "react-icons/fi";
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
import {
    COMPENSATION_STATUS,
    EMPLOYMENT_STATUS,
    SSS_CONTRIBUTION_BASIS,
} from "../../../utils/constants";
import Overlay from "./wrappers/Overlay";
import ClientCombobox from "./common/ClientCombobox";
import DepartmentSelect from "./common/DepartmentSelect";
import logo from "../assets/ynl.png";

// ─── helpers ─────────────────────────────────────────────────────────────────

const f2 = (n) =>
    (+n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

// An overwrite of zero means "compute it", so it prints as a dash rather than
// a figure that reads like a deduction of nothing.
const fOverwrite = (n) => (+n > 0 ? f2(n) : "—");

// The three contribution bases share their values, so one short label set
// covers all of them and keeps the columns narrow.
const BASIS_LABEL = {
    [SSS_CONTRIBUTION_BASIS.BASIC_PAY]: "Basic",
    [SSS_CONTRIBUTION_BASIS.GROSS_PAY]: "Gross",
    [SSS_CONTRIBUTION_BASIS.BASIC_WITH_SIL]: "Basic + SIL",
    [SSS_CONTRIBUTION_BASIS.NO_DEDUCTION]: "None",
};
const fBasis = (v) => BASIS_LABEL[v] ?? (v || "—");

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

const today = () =>
    new Date().toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

// One row per compensation, sorted by department and then name, so a report
// across a whole client reads as one block per department.
function buildRows(compensations) {
    return compensations
        .map((c) => {
            const d = c.employeeDesignation;
            const emp = d?.employee;
            return {
                code: emp?.employeeCode || "—",
                name: emp ? `${emp.lastName}, ${emp.firstName}` : "—",
                department: d?.department?.departmentName || "—",
                position: d?.position?.positionName || "—",
                payrollPeriod: cap(c.payrollPeriod),
                monthlyRate: c.monthlyRate,
                dailyRate: c.dailyRate,
                sss: fBasis(c.sssContributionBasis),
                philhealth: fBasis(c.philhealthContributionBasis),
                pagibig: fBasis(c.pagibigContributionBasis),
                sssOw: c.sssOverwriteAmount,
                phOw: c.philhealthOverwriteAmount,
                piOw: c.pagibigOverwriteAmount,
                status: cap(c.activeStatus),
            };
        })
        .sort(
            (a, b) =>
                a.department.localeCompare(b.department) ||
                a.name.localeCompare(b.name),
        );
}

// Consecutive rows of one department, for the per-department headings.
function groupByDepartment(rows) {
    const groups = [];
    for (const row of rows) {
        const last = groups[groups.length - 1];
        if (last && last.department === row.department) last.rows.push(row);
        else groups.push({ department: row.department, rows: [row] });
    }
    return groups;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

// Landscape A4: 842pt less 60pt of margin. Name takes whatever is left.
const COLUMNS = [
    { key: "num", label: "#", width: 22, align: "center" },
    { key: "code", label: "Code", width: 52 },
    { key: "name", label: "Employee Name", flex: 1 },
    { key: "position", label: "Position", width: 92 },
    { key: "payrollPeriod", label: "Period", width: 56 },
    { key: "monthlyRate", label: "Monthly Rate", width: 62, align: "right", fmt: f2 },
    { key: "dailyRate", label: "Daily Rate", width: 52, align: "right", fmt: f2 },
    { key: "sss", label: "SSS Basis", width: 50 },
    { key: "philhealth", label: "PhilHealth Basis", width: 56 },
    { key: "pagibig", label: "Pag-IBIG Basis", width: 54 },
    { key: "sssOw", label: "SSS Overwrite", width: 48, align: "right", fmt: fOverwrite },
    { key: "phOw", label: "PHIC Overwrite", width: 48, align: "right", fmt: fOverwrite },
    { key: "piOw", label: "HDMF Overwrite", width: 48, align: "right", fmt: fOverwrite },
];
const STATUS_COLUMN = { key: "status", label: "Status", width: 42, align: "center" };

const S = StyleSheet.create({
    page: {
        fontFamily: "Helvetica",
        fontSize: 7.5,
        paddingTop: 22,
        paddingBottom: 30,
        paddingHorizontal: 30,
    },
    header: { textAlign: "center", marginBottom: 8 },
    logo: {
        width: 32,
        height: 32,
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
        padding: 3,
        justifyContent: "center",
    },
    thText: { fontFamily: "Helvetica-Bold", fontSize: 6.5 },
    td: {
        borderWidth: 0.5,
        borderColor: "#c8d3e0",
        borderStyle: "solid",
        paddingHorizontal: 3,
        paddingVertical: 2.5,
    },
    tdEven: { backgroundColor: "#ffffff" },
    tdOdd: { backgroundColor: "#f4f7fb" },
    cell: { fontSize: 7 },
    dept: {
        backgroundColor: "#e2e8f0",
        borderWidth: 0.5,
        borderColor: "#c8d3e0",
        borderStyle: "solid",
        paddingHorizontal: 4,
        paddingVertical: 3,
        flexDirection: "row",
        justifyContent: "space-between",
    },
    deptText: { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
    deptCount: { fontSize: 7, color: "#475569" },
    footer: {
        position: "absolute",
        bottom: 14,
        left: 30,
        right: 30,
        fontSize: 7,
        color: "#64748b",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    empty: { fontSize: 8, color: "#64748b", textAlign: "center", padding: 14 },
});

const cellStyle = (col) => (col.flex ? { flex: col.flex } : { width: col.width });
const textAlign = (col) => ({ textAlign: col.align ?? "left" });

const CompensationPDF = ({ report }) => {
    const { rows, clientName, departmentName, statusLabel, showStatus } = report;
    const columns = showStatus ? [...COLUMNS, STATUS_COLUMN] : COLUMNS;
    // With one department chosen every row belongs to it, so the headings
    // would only repeat what the meta line already says.
    const groups = departmentName
        ? [{ department: null, rows }]
        : groupByDepartment(rows);

    let n = 0;
    return (
        <Document>
            <Page size="A4" orientation="landscape" style={S.page}>
                <View style={S.header}>
                    <Image src={logo} style={S.logo} />
                    <Text style={S.coName}>
                        YAMAN NG LAHI LABOR SERVICE COOPERATIVE
                    </Text>
                    <Text style={S.coAddr}>
                        Lot 3 Unit 3 Arcadia Residence Borol 1st Balagtas,
                        Bulacan
                    </Text>
                    <Text style={S.rptTitle}>COMPENSATION REPORT</Text>
                    <Text style={S.rptDate}>As of {today()}</Text>
                </View>

                <View style={S.metaRow}>
                    <Text>
                        CLIENT: <Text style={S.metaBold}>{clientName}</Text>
                    </Text>
                    <Text>
                        {"   "}DEPARTMENT:{" "}
                        <Text style={S.metaBold}>{departmentName || "ALL"}</Text>
                    </Text>
                    <Text>
                        {"   "}EMPLOYEES:{" "}
                        <Text style={S.metaBold}>{statusLabel}</Text>
                    </Text>
                </View>

                <View style={S.row} fixed>
                    {columns.map((col) => (
                        <View key={col.key} style={[S.th, cellStyle(col)]}>
                            <Text style={[S.thText, textAlign(col)]}>
                                {col.label}
                            </Text>
                        </View>
                    ))}
                </View>

                {rows.length === 0 ? (
                    <Text style={S.empty}>
                        No compensations for this client and department.
                    </Text>
                ) : (
                    groups.map((g) => (
                        <View key={g.department ?? "all"}>
                            {g.department !== null && (
                                <View style={S.dept} wrap={false} minPresenceAhead={14}>
                                    <Text style={S.deptText}>{g.department}</Text>
                                    <Text style={S.deptCount}>
                                        {g.rows.length} employee
                                        {g.rows.length !== 1 ? "s" : ""}
                                    </Text>
                                </View>
                            )}
                            {g.rows.map((row) => {
                                n += 1;
                                const bg = n % 2 === 1 ? S.tdEven : S.tdOdd;
                                return (
                                    <View key={n} style={S.row} wrap={false}>
                                        {columns.map((col) => (
                                            <View
                                                key={col.key}
                                                style={[S.td, bg, cellStyle(col)]}
                                            >
                                                <Text style={[S.cell, textAlign(col)]}>
                                                    {col.key === "num"
                                                        ? n
                                                        : col.fmt
                                                          ? col.fmt(row[col.key])
                                                          : row[col.key]}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                );
                            })}
                        </View>
                    ))
                )}

                <View style={S.footer} fixed>
                    <Text>
                        Total: {rows.length} compensation
                        {rows.length !== 1 ? "s" : ""}
                    </Text>
                    <Text
                        render={({ pageNumber, totalPages }) =>
                            `Page ${pageNumber} of ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
};

// ─── Dialog ───────────────────────────────────────────────────────────────────

// "Active" means both the employee and the compensation are current: an
// active employee can still carry an old, inactive compensation from a
// previous posting, and that is not what they are paid on today.
const STATUS_OPTIONS = {
    active: {
        label: "ACTIVE",
        params: {
            employeeStatus: EMPLOYMENT_STATUS.ACTIVE,
            activeStatus: COMPENSATION_STATUS.ACTIVE,
        },
    },
    inactive: {
        label: "INACTIVE",
        params: { activeStatus: COMPENSATION_STATUS.INACTIVE },
    },
    all: { label: "ALL", params: {} },
};

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls =
    "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";

const CompensationReport = ({ isOpen, onClose, clients }) => {
    const [filter, setFilter] = useState({
        clientId: "",
        departmentId: "",
        departmentName: "",
        status: "active",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const download = async (e) => {
        e.preventDefault();
        if (!filter.clientId) {
            setError("Please select a client.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const status = STATUS_OPTIONS[filter.status];
            const { data } = await customFetch.get("/compensations", {
                params: {
                    client: filter.clientId,
                    ...(filter.departmentId && {
                        department: filter.departmentId,
                    }),
                    ...status.params,
                    limit: 10000,
                },
            });

            const clientName =
                clients.find((c) => c._id === filter.clientId)?.clientName ??
                "";
            const report = {
                rows: buildRows(data.compensations || []),
                clientName,
                departmentName: filter.departmentName,
                statusLabel: status.label,
                showStatus: filter.status === "all",
            };

            const blob = await pdf(<CompensationPDF report={report} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const slug = (s) =>
                s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            a.download = `compensation-report-${slug(clientName)}${
                filter.departmentName ? `-${slug(filter.departmentName)}` : ""
            }.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setError("Failed to build the report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Overlay isOpen={isOpen} onClose={onClose}>
            <form
                onSubmit={download}
                className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            Compensation Report
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Rates and contribution settings, per client and
                            department.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                <div>
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
                <div>
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
                    <label className={labelCls}>Employees</label>
                    <select
                        value={filter.status}
                        onChange={(e) =>
                            setFilter((p) => ({ ...p, status: e.target.value }))
                        }
                        className={inputCls}
                    >
                        <option value="active">Active only</option>
                        <option value="inactive">Inactive only</option>
                        <option value="all">All</option>
                    </select>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-60"
                    >
                        <FiDownload />
                        {loading ? "Building PDF…" : "Download PDF"}
                    </button>
                </div>
            </form>
        </Overlay>
    );
};

export default CompensationReport;
