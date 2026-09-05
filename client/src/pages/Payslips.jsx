import { useState } from "react";
import { redirect, useLoaderData, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { pdf } from "@react-pdf/renderer";
import { FiDownload } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { BulkCompactPayslipPDF } from "../components/PayslipCompactPDF";
import { BulkPayslipReceiptPDF } from "../components/PayslipReceiptPDF";
import { ClientCombobox } from "../components";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const client = url.searchParams.get("client") || "";

        // Lightweight: just distinct pay periods + counts, no populated payroll
        // records. Full records for a period are fetched on demand when the
        // user actually downloads that period's PDFs (see handleDownload) —
        // pulling every payroll record up front (each with 6 nested populate
        // chains) is what made this page slow once payrolls grew past a
        // handful of records.
        const params = new URLSearchParams();
        if (client) params.set("client", client);

        const [{ data }, { data: clientData }] = await Promise.all([
            customFetch.get(`/payrolls/periods?${params}`),
            customFetch.get("/clients?limit=1000"),
        ]);

        return {
            periods: data.periods || [],
            clients: clientData.clients || [],
            client,
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const toDateStr = (v) =>
    v
        ? new Date(v).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "—";

const slugify = (s) =>
    s
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

const Payslips = () => {
    const { periods, clients, client } = useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [downloadingKey, setDownloadingKey] = useState(null);

    const clientName = clients.find((c) => c._id === client)?.clientName ?? "";

    const groups = periods.map((p) => ({
        from: p.payrollFrom?.slice(0, 10) ?? "",
        to: p.payrollTo?.slice(0, 10) ?? "",
        count: p.count,
    }));

    const applyClient = (id) => {
        const params = new URLSearchParams(searchParams);
        if (id) params.set("client", id);
        else params.delete("client");
        setSearchParams(params);
    };

    // "plain" = six payslips a sheet. "receipt" = three a sheet, each with the
    // acknowledgment the employee signs and hands back below a tear line.
    const handleDownload = async (group, format = "plain") => {
        const key = `${group.from}|${group.to}|${format}`;
        setDownloadingKey(key);
        try {
            // The client filter has to go to the API as well as the period —
            // group.count is already the filtered count, so it doubles as the
            // page size for this client's slice of the period.
            const { data } = await customFetch.get("/payrolls", {
                params: {
                    payrollFrom: group.from,
                    payrollTo: group.to,
                    limit: group.count,
                    ...(client && { client }),
                },
            });
            const payrolls = data.payrolls || [];
            if (payrolls.length === 0) {
                toast.error("No payroll records found for this selection.");
                return;
            }

            // Each slip prints the days behind the pay, so the timekeeping for
            // the whole period comes down in one request and is handed to the
            // document as a map keyed by compensation.
            const attendance = {};
            try {
                const { data: att } = await customFetch.get("/attendances", {
                    params: {
                        dateFrom: group.from.slice(0, 10),
                        dateTo: group.to.slice(0, 10),
                        limit: 100000,
                        sort: "asc",
                        ...(client && { client }),
                    },
                });
                for (const row of att.attendances || []) {
                    const key = String(row.compensation?._id ?? row.compensation);
                    (attendance[key] ??= []).push(row);
                }
            } catch {
                // The pay figures are on the payroll record itself, so a slip
                // is still correct without the day table. Print it rather than
                // failing the whole download.
                toast.info("Timekeeping could not be loaded; slips will print without the day breakdown.");
            }

            const Doc =
                format === "receipt" ? BulkPayslipReceiptPDF : BulkCompactPayslipPDF;
            const blob = await pdf(
                <Doc payrolls={payrolls} attendance={attendance} />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const suffix = format === "receipt" ? "-with-receipt" : "";
            a.download = clientName
                ? `payslips-${slugify(clientName)}-${group.from}-to-${group.to}${suffix}.pdf`
                : `payroll-${group.from}-to-${group.to}${suffix}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(`Downloaded ${payrolls.length} payroll slip(s).`);
        } catch {
            toast.error("Failed to generate PDF.");
        } finally {
            setDownloadingKey(null);
        }
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Payslips</h1>
                <p className="text-slate-500 mt-1">
                    {groups.length} payroll period{groups.length !== 1 ? "s" : ""}
                    {clientName && (
                        <>
                            {" for "}
                            <span className="font-medium text-slate-700">
                                {clientName}
                            </span>
                        </>
                    )}
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1 w-72">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Client
                    </label>
                    <ClientCombobox
                        clients={clients}
                        value={client}
                        onChange={applyClient}
                    />
                </div>
                <p className="pb-2.5 text-xs text-slate-400">
                    Pick a client to download that client&apos;s payslips only.
                </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Pay Period</th>
                            <th className="px-4 py-3 text-center">Employees</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {groups.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    {clientName
                                        ? `No payroll has been processed for ${clientName} yet.`
                                        : "No payroll records found."}
                                </td>
                            </tr>
                        )}
                        {groups.map((group, idx) => {
                            const key = `${group.from}|${group.to}`;
                            // which of the two buttons on this row is busy, if any
                            const isLoading = downloadingKey?.startsWith(`${key}|`)
                                ? downloadingKey.split("|")[2]
                                : null;
                            return (
                                <tr key={key} className="bg-white hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-400 w-10">
                                        {idx + 1}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">
                                        {toDateStr(group.from)}
                                        <span className="mx-2 text-slate-400">–</span>
                                        {toDateStr(group.to)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-600">
                                        {group.count}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="inline-flex items-center gap-2">
                                            <button
                                                onClick={() => handleDownload(group, "plain")}
                                                disabled={!!downloadingKey}
                                                title="Six payslips to a sheet"
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <FiDownload className="w-3.5 h-3.5" />
                                                {isLoading === "plain" ? "Generating…" : "Payslips"}
                                            </button>
                                            <button
                                                onClick={() => handleDownload(group, "receipt")}
                                                disabled={!!downloadingKey}
                                                title="Three to a sheet, each with an acknowledgment receipt to sign"
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <FiDownload className="w-3.5 h-3.5" />
                                                {isLoading === "receipt" ? "Generating…" : "With receipt"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Payslips;
