import {
    Link,
    redirect,
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
    useSearchParams,
} from "react-router-dom";
import { FiEdit2, FiEye, FiPlus, FiTrash2 } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { LOAN_STATUS } from "../../../utils/constants";
import { canWrite } from "../../../utils/permissions";
import { ClientCombobox, useConfirm, Pagination } from "../components";
import EmployeeCombobox from "../components/common/EmployeeCombobox";
import { fmt, statusBadge } from "../components/common/loanDisplay";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const employee = url.searchParams.get("employee") || "";
        const loanType = url.searchParams.get("loanType") || "";
        const loanStatus = url.searchParams.get("loanStatus") || "";
        const client = url.searchParams.get("client") || "";

        const params = new URLSearchParams({ page, limit: "20" });
        if (employee) params.set("employee", employee);
        if (loanType) params.set("loanType", loanType);
        if (loanStatus) params.set("loanStatus", loanStatus);
        if (client) params.set("client", client);

        // The employee combobox below now searches employees server-side
        // instead of the whole collection being preloaded here. Clients are a
        // short list, so that one is preloaded and filtered in the browser.
        const [{ data }, { data: ltData }, { data: cliData }] = await Promise.all([
            customFetch.get(`/loan-applications?${params}`),
            customFetch.get("/loan-types?limit=1000"),
            customFetch.get("/clients?limit=1000"),
        ]);
        return {
            ...data,
            loanTypes: ltData.loanTypes || [],
            clients: cliData.clients || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

export const action = async () => null;

// ── page ─────────────────────────────────────────────────────────────────────
const Loans = () => {
    const {
        loanApplications,
        totalLoanApplications,
        totalPages,
        currentPage,
        loanTypes,
        clients,
    } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();
    const { confirmModal, askConfirm } = useConfirm();

    // Loans are readable by anyone signed in; only some roles may change them.
    const mayEdit = canWrite("loanApplications", user?.role);

    const setParam = (key) => (e) => {
        const params = Object.fromEntries(searchParams);
        delete params.page;
        if (e.target.value) params[key] = e.target.value;
        else delete params[key];
        setSearchParams(params);
    };

    const setPage = (page) => {
        const params = Object.fromEntries(searchParams);
        setSearchParams({ ...params, page });
    };

    const handleDelete = (loan) => {
        askConfirm(
            `Delete loan for ${loan.employee?.firstName} ${loan.employee?.lastName} (${loan.loanType?.loanTypeName})?`,
            async () => {
                await customFetch.delete(`/loan-applications/${loan._id}`);
                revalidator.revalidate();
            },
        );
    };

    return (
        <div>
            {confirmModal}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Loan Applications
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Total: {totalLoanApplications}
                    </p>
                </div>
                {mayEdit && (
                    <Link
                        to="/dashboard/loans/add"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <FiPlus /> Add Loan
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Client
                    </label>
                    <div className="w-full sm:w-56">
                        <ClientCombobox
                            clients={clients}
                            value={searchParams.get("client") || ""}
                            onChange={(val) => {
                                const params = Object.fromEntries(searchParams);
                                delete params.page;
                                if (val) params.client = val;
                                else delete params.client;
                                setSearchParams(params);
                            }}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Employee
                    </label>
                    <div className="w-full sm:w-56">
                        <EmployeeCombobox
                            value={searchParams.get("employee") || ""}
                            onChange={(val) => {
                                const params = Object.fromEntries(searchParams);
                                delete params.page;
                                if (val) params.employee = val;
                                else delete params.employee;
                                setSearchParams(params);
                            }}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Loan Type
                    </label>
                    <select
                        value={searchParams.get("loanType") || ""}
                        onChange={setParam("loanType")}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                        <option value="">All Types</option>
                        {loanTypes.map((lt) => (
                            <option key={lt._id} value={lt._id}>
                                {lt.loanTypeName}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        Status
                    </label>
                    <select
                        value={searchParams.get("loanStatus") || ""}
                        onChange={setParam("loanStatus")}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                        <option value="">All Status</option>
                        {Object.values(LOAN_STATUS).map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
                {(searchParams.get("client") ||
                    searchParams.get("employee") ||
                    searchParams.get("loanType") ||
                    searchParams.get("loanStatus")) && (
                    <button
                        onClick={() => setSearchParams({})}
                        className="text-xs text-slate-500 hover:text-slate-800 underline pb-2.5"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200">
                {/* Mobile card view */}
                <div className="sm:hidden divide-y divide-slate-100">
                    {loanApplications.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">
                            No loan applications found.
                        </p>
                    )}
                    {loanApplications.map((loan) => (
                        <div key={loan._id} className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {loan.employee?.firstName}{" "}
                                        {loan.employee?.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {loan.loanType?.loanTypeName || "—"}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    {statusBadge(loan.loanStatus)}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                <div className="bg-slate-50 rounded p-2">
                                    <p className="text-slate-400">Amount</p>
                                    <p className="font-medium text-slate-700">
                                        {fmt(loan.loanAmount)}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded p-2">
                                    <p className="text-slate-400">Balance</p>
                                    <p className="font-medium text-slate-700">
                                        {fmt(loan.loanPayable)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Link
                                    to={`/dashboard/loans/${loan._id}`}
                                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                                    title="View loan"
                                >
                                    <FiEye size={14} />
                                </Link>
                                {mayEdit && (
                                    <>
                                        <Link
                                            to={`/dashboard/loans/${loan._id}/edit`}
                                            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={14} />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(loan)}
                                            className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                                            title="Delete"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">#</th>
                                <th className="px-4 py-3 text-left">
                                    Employee
                                </th>
                                <th className="px-4 py-3 text-left">
                                    Loan Type
                                </th>
                                <th className="px-4 py-3 text-right">
                                    Loan Amount
                                </th>
                                <th className="px-4 py-3 text-right">
                                    Amortization
                                </th>
                                <th className="px-4 py-3 text-right">
                                    Balance
                                </th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-center">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loanApplications.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-4 py-8 text-center text-slate-400"
                                    >
                                        No loan applications found.
                                    </td>
                                </tr>
                            )}
                            {loanApplications.map((loan, idx) => (
                                <tr
                                    key={loan._id}
                                    className="bg-white hover:bg-slate-50"
                                >
                                    <td className="px-4 py-3 text-slate-500">
                                        {(currentPage - 1) * 20 + idx + 1}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">
                                        {loan.employee?.firstName}{" "}
                                        {loan.employee?.lastName}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {loan.loanType?.loanTypeName || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">
                                        {fmt(loan.loanAmount)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">
                                        {fmt(loan.monthlyAmortization)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">
                                        {fmt(loan.loanPayable)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {statusBadge(loan.loanStatus)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Link
                                                to={`/dashboard/loans/${loan._id}`}
                                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="View loan"
                                            >
                                                <FiEye size={14} />
                                            </Link>
                                            {mayEdit && (
                                                <>
                                                    <Link
                                                        to={`/dashboard/loans/${loan._id}/edit`}
                                                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </Link>
                                                    <button
                                                        onClick={() =>
                                                            handleDelete(loan)
                                                        }
                                                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
            />
        </div>
    );
};

export default Loans;
