import { Link, redirect, useLoaderData, useNavigate, useRouteLoaderData } from "react-router-dom";
import { toast } from "react-toastify";
import { FiArrowLeft } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { canWrite } from "../../../utils/permissions";
import LoanForm from "../components/common/LoanForm";
import ErrorState, { ACTION_PRIMARY } from "../components/common/ErrorState";

export const loader = async () => {
    try {
        const { data } = await customFetch.get("/loan-types?limit=1000");
        return { loanTypes: data.loanTypes || [] };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const AddLoan = () => {
    const { loanTypes } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const navigate = useNavigate();

    // This page only exists to create a loan, so a role that cannot create one
    // is told plainly rather than handed a form the API will reject on submit.
    if (!canWrite("loanApplications", user?.role))
        return (
            <ErrorState
                inline
                code="403"
                title="You cannot add loans"
                message="Your account can view loan records but not create them. Ask an administrator if you need this access."
            >
                <Link to="/dashboard/loans" className={ACTION_PRIMARY}>
                    Back to loans
                </Link>
            </ErrorState>
        );

    return (
        <div>
            <div className="mb-6 flex items-center gap-3">
                <Link
                    to="/dashboard/loans"
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <FiArrowLeft size={16} />
                    Back
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Add Loan</h1>
                    <p className="text-slate-500 mt-1">
                        Record a new loan application for an employee.
                    </p>
                </div>
            </div>

            <div className="max-w-3xl">
                <LoanForm
                    loan={null}
                    loanTypes={loanTypes}
                    onSaved={() => {
                        toast.success("Loan added");
                        navigate("/dashboard/loans");
                    }}
                    onCancel={() => navigate("/dashboard/loans")}
                />
            </div>
        </div>
    );
};
export default AddLoan;
