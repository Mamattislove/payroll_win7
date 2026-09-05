import { useState } from "react";
import { redirect, useLoaderData, useSearchParams } from "react-router-dom";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { Pagination } from "../components";
import { AUDIT_ACTIONS } from "../../../utils/constants";

const PAGE_SIZE = 25;

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const params = new URLSearchParams();
        params.set("page", url.searchParams.get("page") || "1");
        params.set("limit", String(PAGE_SIZE));
        for (const key of ["user", "action", "resource", "dateFrom", "dateTo", "search"]) {
            const v = url.searchParams.get(key);
            if (v) params.set(key, v);
        }

        const [{ data }, { data: filterData }] = await Promise.all([
            customFetch.get(`/audit-logs?${params}`),
            customFetch.get("/audit-logs/filters"),
        ]);

        return {
            ...data,
            users: filterData.users || [],
            resources: filterData.resources || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        // A non-admin hitting this route gets 403 — send them back to the
        // dashboard rather than showing an error page.
        if (error?.response?.status === 403) return redirect("/dashboard");
        throw error;
    }
};

const fmtWhen = (v) =>
    v
        ? new Date(v).toLocaleString("en-PH", {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
          })
        : "—";

const ACTION_STYLES = {
    create: "bg-emerald-50 text-emerald-700 border-emerald-200",
    update: "bg-blue-50 text-blue-700 border-blue-200",
    delete: "bg-red-50 text-red-700 border-red-200",
    login: "bg-slate-100 text-slate-600 border-slate-200",
    logout: "bg-slate-100 text-slate-600 border-slate-200",
    login_failed: "bg-amber-50 text-amber-700 border-amber-200",
};

const ActionBadge = ({ action }) => (
    <span
        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            ACTION_STYLES[action] ?? "bg-slate-100 text-slate-600 border-slate-200"
        }`}
    >
        {action?.replace("_", " ") ?? "—"}
    </span>
);

const inputCls =
    "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls =
    "text-[11px] font-semibold uppercase tracking-widest text-slate-400";

const LogRow = ({ log }) => {
    const [open, setOpen] = useState(false);
    const hasDetail = log.changes && Object.keys(log.changes).length > 0;

    return (
        <>
            <tr className={log.success ? "bg-white" : "bg-red-50/40"}>
                <td className="px-3 py-2 align-top">
                    {hasDetail && (
                        <button
                            onClick={() => setOpen((v) => !v)}
                            className="text-slate-400 hover:text-slate-700"
                            title={open ? "Hide details" : "Show details"}
                        >
                            {open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </button>
                    )}
                </td>
                <td className="px-3 py-2 align-top whitespace-nowrap text-xs text-slate-500 tabular-nums">
                    {fmtWhen(log.createdAt)}
                </td>
                <td className="px-3 py-2 align-top">
                    <span className="font-medium text-slate-800">
                        {log.username || "—"}
                    </span>
                    {log.role && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                            {log.role}
                        </span>
                    )}
                </td>
                <td className="px-3 py-2 align-top">
                    <ActionBadge action={log.action} />
                </td>
                <td className="px-3 py-2 align-top text-slate-700">
                    {log.resource || "—"}
                </td>
                <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-500 break-all">
                    {log.method} {log.path}
                </td>
                <td className="px-3 py-2 align-top text-right tabular-nums">
                    <span
                        className={
                            log.success
                                ? "text-slate-500"
                                : "font-semibold text-red-600"
                        }
                    >
                        {log.statusCode ?? "—"}
                    </span>
                </td>
            </tr>
            {open && hasDetail && (
                <tr className="bg-slate-50">
                    <td />
                    <td colSpan={6} className="px-3 pb-3">
                        <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-700">
                            {JSON.stringify(log.changes, null, 2)}
                        </pre>
                        {log.ip && (
                            <p className="mt-1 text-[10px] text-slate-400">
                                from {log.ip}
                            </p>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
};

const AuditLogs = () => {
    const { logs, totalLogs, totalPages, currentPage, users, resources } =
        useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchInput, setSearchInput] = useState(
        searchParams.get("search") || "",
    );

    // One setSearchParams call per change — two in the same handler would both
    // read this render's params and the second would drop the first.
    const applyFilters = (updates) => {
        const params = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(updates)) {
            if (value) params.set(key, value);
            else params.delete(key);
        }
        params.set("page", "1");
        setSearchParams(params);
    };

    const setPage = (page) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", String(page));
        setSearchParams(params);
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearchParams({});
    };

    const filterUser = searchParams.get("user") || "";
    const filterAction = searchParams.get("action") || "";
    const filterResource = searchParams.get("resource") || "";
    const filterFrom = searchParams.get("dateFrom") || "";
    const filterTo = searchParams.get("dateTo") || "";
    const hasFilters =
        filterUser ||
        filterAction ||
        filterResource ||
        filterFrom ||
        filterTo ||
        searchParams.get("search");

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
                <p className="text-slate-500 mt-1">
                    {totalLogs.toLocaleString()} recorded change
                    {totalLogs === 1 ? "" : "s"} · newest first
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>User</label>
                    <select
                        value={filterUser}
                        onChange={(e) => applyFilters({ user: e.target.value })}
                        className={`${inputCls} w-full sm:w-auto`}
                    >
                        <option value="">All users</option>
                        {users.map((u) => (
                            <option key={u._id} value={u._id}>
                                {u.username} ({u.role})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Action</label>
                    <select
                        value={filterAction}
                        onChange={(e) => applyFilters({ action: e.target.value })}
                        className={`${inputCls} w-full sm:w-auto`}
                    >
                        <option value="">All actions</option>
                        {Object.values(AUDIT_ACTIONS).map((a) => (
                            <option key={a} value={a}>
                                {a.replace("_", " ")}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Resource</label>
                    <select
                        value={filterResource}
                        onChange={(e) => applyFilters({ resource: e.target.value })}
                        className={`${inputCls} w-full sm:w-auto`}
                    >
                        <option value="">All resources</option>
                        {resources.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className={labelCls}>From</label>
                    <input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => applyFilters({ dateFrom: e.target.value })}
                        className={`${inputCls} w-full sm:w-auto`}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className={labelCls}>To</label>
                    <input
                        type="date"
                        value={filterTo}
                        onChange={(e) => applyFilters({ dateTo: e.target.value })}
                        className={`${inputCls} w-full sm:w-auto`}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Search</label>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            applyFilters({ search: searchInput });
                        }}
                    >
                        <input
                            type="text"
                            placeholder="User or path…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className={`${inputCls} w-full sm:w-48`}
                        />
                    </form>
                </div>

                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-slate-500 hover:text-slate-800 underline pb-2"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                            <th className="px-3 py-3 w-8" />
                            <th className="px-3 py-3 text-left">When</th>
                            <th className="px-3 py-3 text-left">User</th>
                            <th className="px-3 py-3 text-left">Action</th>
                            <th className="px-3 py-3 text-left">Resource</th>
                            <th className="px-3 py-3 text-left">Request</th>
                            <th className="px-3 py-3 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {logs.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    {hasFilters
                                        ? "No activity matches these filters."
                                        : "No activity recorded yet."}
                                </td>
                            </tr>
                        )}
                        {logs.map((log) => (
                            <LogRow key={log._id} log={log} />
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
            />
        </div>
    );
};

export default AuditLogs;
