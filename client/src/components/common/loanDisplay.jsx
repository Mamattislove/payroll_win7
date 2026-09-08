import { LOAN_STATUS } from "@shared/constants";

/*
 * Formatting shared by the loan list and the loan view page, so a peso figure
 * or a status pill looks the same wherever a loan is shown.
 */

export const fmt = (val) =>
    val !== undefined && val !== null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-PH") : "—");

export const statusBadge = (status) => {
    if (status === LOAN_STATUS.ONGOING)
        return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                {status}
            </span>
        );
    if (status === LOAN_STATUS.FULLY_PAID)
        return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                {status}
            </span>
        );
    // Amber rather than the neutral fallback: a stopped loan still owes money,
    // so it should not read like a finished one at a glance.
    if (status === LOAN_STATUS.STOPPED)
        return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 capitalize">
                {status}
            </span>
        );
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">
            {status}
        </span>
    );
};

// Deliberately not the InfoField in the components barrel: that one is built
// for form-style detail panels and has no empty fallback, and a loan detail
// with a blank value beside it reads as a rendering fault rather than a field
// nobody filled in.
export const LoanInfoField = ({ label, value }) => (
    <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
            {label}
        </p>
        <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
);
