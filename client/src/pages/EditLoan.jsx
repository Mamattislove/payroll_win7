import { Link, redirect, useLoaderData, useNavigate, useRouteLoaderData } from "react-router-dom";
import { toast } from "react-toastify";
import { FiArrowLeft } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { canWrite } from "../../../utils/permissions";
import LoanForm from "../components/common/LoanForm";
import ErrorState, { ACTION_PRIMARY } from "../components/common/ErrorState";

export const loader = async ({ params }) => {
    try {
        const [{ data }, { data: ltData }] = await Promise.all([
            customFetch.get(`/loan-applications/${params.id}`),
            customFetch.get("/loan-types?limit=1000"),
        ]);
        return {
            loan: data.loanApplication,
            loanTypes: ltData.loanTypes || [],
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const EditLoan = () => {
    const { loan, loanTypes } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const navigate = useNavigate();

    // Read-only roles get sent to the view page rather than a dead form; the
    // loan itself is not secret, only changing it is.
    if (!canWrite("loanApplications", user?.role))
        return (
            <ErrorState
                inline
                code="403"
                title="You cannot edit loans"
                message="Your account can view loan records but not change them. Ask an administrator if you need this access."
            >
                <Link to={`/dashboard/loans/${loan._id}`} className={ACTION_PRIMARY}>
                    View this loan
                </Link>
            </ErrorState>
        );

    return (
        <div>
            <div className="mb-6 flex items-center gap-3">
                <Link
                    to={`/dashboard/loans/${loan._id}`}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <FiArrowLeft size={16} />
                    Back
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Edit Loan</h1>
                    <p className="text-slate-500 mt-1">
                        {loan.employee?.firstName} {loan.employee?.lastName} —{" "}
                        {loan.loanType?.loanTypeName}
                    </p>
                </div>
            </div>

            <div className="max-w-3xl">
                <LoanForm
                    loan={loan}
                    loanTypes={loanTypes}
                    onSaved={() => {
                        toast.success("Loan updated");
                        navigate(`/dashboard/loans/${loan._id}`);
                    }}
                    onCancel={() => navigate(`/dashboard/loans/${loan._id}`)}
                />
            </div>
        </div>
    );
};
export default EditLoan;
