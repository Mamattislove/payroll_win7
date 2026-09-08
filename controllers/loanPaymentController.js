import { StatusCodes } from "http-status-codes";
import LoanPayment from "../models/LoanPayment.js";
import LoanApplication from "../models/LoanApplication.js";
import { NotFoundError } from "../errors/customErrors.js";
import { recomputePayrollTotals } from "../utils/recomputePayroll.js";
import { LOAN_STATUS } from "../utils/constants.js";

const r2 = (n) => Math.round(n * 100) / 100;

export const getAllLoanPayments = async (req, res) => {
    const { page = 1, limit = 10, loan } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const query = {};
    if (loan) query.loan = loan;
    const totalLoanPayments = await LoanPayment.countDocuments(query);
    const loanPayments = await LoanPayment.find(query)
        .populate("loan", "loanCategory loanType loanPayable")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    res.status(StatusCodes.OK).json({ totalLoanPayments, totalPages: Math.ceil(totalLoanPayments / limitNum), currentPage: pageNum, loanPayments });
};

export const getLoanPayment = (req, res) => {
    res.status(StatusCodes.OK).json({ loanPayment: req.loanPayment });
};

export const createLoanPayment = async (req, res) => {
    const loanPayment = await LoanPayment.create(req.body);

    if (loanPayment.loan && loanPayment.amount) {
        const loan = await LoanApplication.findById(loanPayment.loan);
        if (loan) {
            loan.loanPayable = r2(Math.max(0, (loan.loanPayable || 0) - loanPayment.amount));
            await loan.save();
        }
    }

    if (loanPayment.payroll) await recomputePayrollTotals(loanPayment.payroll);
    res.status(StatusCodes.CREATED).json({ loanPayment });
};

export const deleteLoanPayment = async (req, res) => {
    const loanPayment = await LoanPayment.findByIdAndDelete(req.params.loanPaymentId);
    if (!loanPayment) throw new NotFoundError(`No loan payment with id ${req.params.loanPaymentId}`);

    if (loanPayment.loan && loanPayment.amount) {
        const updated = await LoanApplication.findByIdAndUpdate(
            loanPayment.loan,
            { $inc: { loanPayable: r2(loanPayment.amount) } },
            { new: true },
        );
        // Reversing a payment can take a loan back below its balance, so a
        // loan that was closed off reopens. Only revive one that was closed by
        // being paid off -- a loan someone stopped by hand stays stopped, or
        // deleting a payment would quietly restart the deductions they paused.
        if (updated && updated.loanPayable > 0 && updated.loanStatus === LOAN_STATUS.FULLY_PAID) {
            await LoanApplication.findByIdAndUpdate(updated._id, {
                loanStatus: LOAN_STATUS.ONGOING,
            });
        }
    }

    if (loanPayment.payroll) await recomputePayrollTotals(loanPayment.payroll);
    res.status(StatusCodes.OK).json({ msg: "loan payment deleted" });
};
