import { useState } from "react";
import customFetch from "../../../utils/customFetch";
import { LOAN_STATUS } from "@shared/constants";
import EmployeeCombobox from "./EmployeeCombobox";

const inputCls =
    "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 w-full";
const labelCls =
    "text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1 block";

const BLANK = {
    employee: "",
    loanType: "",
    loanAmount: "",
    loanPayable: "",
    monthlyAmortization: "",
    firstMonthAmortization: "",
    dateGranted: "",
    loanTermFrom: "",
    loanTermTo: "",
    checkNumber: "",
    remarks: "",
    loanStatus: "",
};

const toDateInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

/**
 * The loan form, shared by the add and edit pages so the two cannot drift.
 *
 * Pass `loan` to edit an existing one and the form switches to PATCH, locks
 * the employee and loan type (changing either would make it a different loan
 * rather than a correction) and exposes the status field.
 *
 * @param {object|null} loan - the loan being edited, or null to create one
 * @param {Array} loanTypes - options for the loan type select
 * @param {Function} onSaved - called after a successful save
 * @param {Function} onCancel - called when the user backs out
 */
const LoanForm = ({ loan, loanTypes, onSaved, onCancel }) => {
    const isEdit = !!loan;
    const [form, setForm] = useState(
        isEdit
            ? {
                  employee: loan.employee?._id || "",
                  loanType: loan.loanType?._id || "",
                  loanAmount: loan.loanAmount ?? "",
                  loanPayable: loan.loanPayable ?? "",
                  monthlyAmortization: loan.monthlyAmortization ?? "",
                  firstMonthAmortization: toDateInput(loan.firstMonthAmortization),
                  dateGranted: toDateInput(loan.dateGranted),
                  loanTermFrom: toDateInput(loan.loanTermFrom),
                  loanTermTo: toDateInput(loan.loanTermTo),
                  checkNumber: loan.checkNumber || "",
                  remarks: loan.remarks || "",
                  loanStatus: loan.loanStatus || "",
              }
            : { ...BLANK },
    );
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            const payload = { ...form };
            Object.keys(payload).forEach((k) => {
                if (payload[k] === "") delete payload[k];
            });
            if (isEdit) {
                await customFetch.patch(`/loan-applications/${loan._id}`, payload);
            } else {
                await customFetch.post("/loan-applications", payload);
            }
            onSaved();
        } catch (err) {
            setError(err?.response?.data?.msg || "An error occurred.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-slate-200"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-5">
                <div className="sm:col-span-2">
                    <label className={labelCls}>Employee *</label>
                    <EmployeeCombobox
                        value={form.employee}
                        onChange={(val) => setForm((f) => ({ ...f, employee: val }))}
                        disabled={isEdit}
                        initialEmployee={loan?.employee}
                    />
                </div>

                <div>
                    <label className={labelCls}>Loan Type *</label>
                    <select
                        value={form.loanType}
                        onChange={set("loanType")}
                        className={inputCls}
                        required
                        disabled={isEdit}
                    >
                        <option value="">Select Loan Type</option>
                        {loanTypes.map((lt) => (
                            <option key={lt._id} value={lt._id}>
                                {lt.loanTypeName}
                            </option>
                        ))}
                    </select>
                </div>

                {isEdit && (
                    <div>
                        <label className={labelCls}>Status</label>
                        <select
                            value={form.loanStatus}
                            onChange={set("loanStatus")}
                            className={inputCls}
                        >
                            {Object.values(LOAN_STATUS).map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label className={labelCls}>Loan Amount *</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.loanAmount}
                        onChange={set("loanAmount")}
                        className={inputCls}
                        placeholder="0.00"
                    />
                </div>

                <div>
                    <label className={labelCls}>Loan Payable (Balance)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.loanPayable}
                        onChange={set("loanPayable")}
                        className={inputCls}
                        placeholder="0.00"
                    />
                </div>

                <div>
                    <label className={labelCls}>Monthly Amortization *</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.monthlyAmortization}
                        onChange={set("monthlyAmortization")}
                        className={inputCls}
                        placeholder="0.00"
                        required
                    />
                </div>

                <div>
                    <label className={labelCls}>First Month Amortization *</label>
                    <input
                        type="date"
                        value={form.firstMonthAmortization}
                        onChange={set("firstMonthAmortization")}
                        className={inputCls}
                        required
                    />
                </div>

                <div>
                    <label className={labelCls}>Date Granted</label>
                    <input
                        type="date"
                        value={form.dateGranted}
                        onChange={set("dateGranted")}
                        className={inputCls}
                    />
                </div>

                <div>
                    <label className={labelCls}>Loan Term From</label>
                    <input
                        type="date"
                        value={form.loanTermFrom}
                        onChange={set("loanTermFrom")}
                        className={inputCls}
                    />
                </div>

                <div>
                    <label className={labelCls}>Loan Term To</label>
                    <input
                        type="date"
                        value={form.loanTermTo}
                        onChange={set("loanTermTo")}
                        className={inputCls}
                    />
                </div>

                <div>
                    <label className={labelCls}>Check Number</label>
                    <input
                        type="text"
                        value={form.checkNumber}
                        onChange={set("checkNumber")}
                        className={inputCls}
                        placeholder="Check #"
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className={labelCls}>Remarks</label>
                    <textarea
                        value={form.remarks}
                        onChange={set("remarks")}
                        rows={2}
                        className={inputCls}
                        placeholder="Optional notes..."
                    />
                </div>

                {error && (
                    <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Loan"}
                </button>
            </div>
        </form>
    );
};
export default LoanForm;
