import { useState } from "react";
import {
    Link,
    redirect,
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
} from "react-router-dom";
import { toast } from "react-toastify";
import { FiArrowLeft, FiEdit2, FiPause, FiPlay } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { LOAN_STATUS } from "../../../utils/constants";
import { canWrite } from "../../../utils/permissions";
import { useConfirm } from "../components";
import {
    fmt,
    fmtDate,
    statusBadge,
    LoanInfoField,
} from "../components/common/loanDisplay";

export const loader = async ({ params }) => {
    try {
        // Payments come down with the loan rather than after it, so the page
        // arrives complete instead of showing a total that fills in late.
        const [{ data }, { data: paymentData }] = await Promise.all([
            customFetch.get(`/loan-applications/${params.id}`),
            customFetch.get(`/loan-payments?loan=${params.id}&limit=500`),
        ]);
        return {
            loan: data.loanApplication,
            payments: paymentData.loanPayments || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const ViewLoan = () => {
    const { loan, payments } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const revalidator = useRevalidator();
    const { confirmModal, askConfirm } = useConfirm();
    const [toggling, setToggling] = useState(false);
    const mayEdit = canWrite("loanApplications", user?.role);

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // A fully paid loan has nothing left to stop, so the toggle is only
    // offered while there is still a balance being collected.
    const isStopped = loan.loanStatus === LOAN_STATUS.STOPPED;
    const canToggle =
        mayEdit &&
        (loan.loanStatus === LOAN_STATUS.ONGOING || isStopped);

    const toggleStatus = () => {
        const next = isStopped ? LOAN_STATUS.ONGOING : LOAN_STATUS.STOPPED;
        askConfirm(
            isStopped
                ? "Resume this loan? It will be deducted again from the next payroll."
                : "Stop this loan? The balance stays, but it will not be deducted from payroll until you resume it.",
            async () => {
                setToggling(true);
                try {
                    await customFetch.patch(`/loan-applications/${loan._id}`, {
                        loanStatus: next,
                    });
                    toast.success(isStopped ? "Loan resumed" : "Loan stopped");
                    revalidator.revalidate();
                } catch (err) {
                    toast.error(
                        err?.response?.data?.msg ||
                            err?.response?.data?.message ||
                            "Could not change the loan status.",
                    );
                } finally {
                    setToggling(false);
                }
            },
        );
    };

    return (
        <div>
            {confirmModal}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <Link
                        to="/dashboard/loans"
                        className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        <FiArrowLeft size={16} />
                        Back
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {loan.employee?.firstName} {loan.employee?.lastName}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {loan.employee?.employeeCode || "—"} —{" "}
                            {loan.loanType?.loanTypeName}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canToggle && (
                        <button
                            type="button"
                            onClick={toggleStatus}
                            disabled={toggling}
                            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                                isStopped
                                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            }`}
                        >
                            {isStopped ? <FiPlay size={14} /> : <FiPause size={14} />}
                            {isStopped ? "Resume Loan" : "Stop Loan"}
                        </button>
                    )}
                    {mayEdit && (
                        <Link
                            to={`/dashboard/loans/${loan._id}/edit`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            <FiEdit2 size={14} />
                            Edit Loan
                        </Link>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                    {[
                        { label: "Loan Amount", value: fmt(loan.loanAmount) },
                        { label: "Total Paid", value: fmt(totalPaid) },
                        { label: "Balance", value: fmt(loan.loanPayable) },
                    ].map(({ label, value }) => (
                        <div key={label} className="px-4 py-4 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">
                                {label}
                            </p>
                            <p className="text-lg font-semibold text-slate-800 mt-0.5">
                                {value}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-4">
                    Loan Details
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
                    <LoanInfoField label="Loan Name" value={loan.loanName} />
                    <LoanInfoField label="Check Number" value={loan.checkNumber} />
                    <LoanInfoField label="Status" value={statusBadge(loan.loanStatus)} />
                    <LoanInfoField
                        label="Date Granted"
                        value={fmtDate(loan.dateGranted)}
                    />
                    <LoanInfoField
                        label="Loan Term"
                        value={
                            loan.loanTermFrom || loan.loanTermTo
                                ? `${fmtDate(loan.loanTermFrom)} – ${fmtDate(loan.loanTermTo)}`
                                : null
                        }
                    />
                    <LoanInfoField
                        label="Monthly Amortization"
                        value={fmt(loan.monthlyAmortization)}
                    />
                    <LoanInfoField
                        label="First Month Amortization"
                        value={fmtDate(loan.firstMonthAmortization)}
                    />
                    {loan.remarks && (
                        <LoanInfoField label="Remarks" value={loan.remarks} />
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-5 pt-5 pb-2">
                    Payments ({payments.length})
                </p>
                {payments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">
                        No payments recorded.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">#</th>
                                    <th className="px-4 py-3 text-left">Date of Payment</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payments.map((p, i) => (
                                    <tr key={p._id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {fmtDate(p.dateOfPayment)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                                            {fmt(p.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
export default ViewLoan;
