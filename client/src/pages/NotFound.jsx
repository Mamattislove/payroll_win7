import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import ErrorState, {
    ACTION_PRIMARY,
    ACTION_SECONDARY,
} from "../components/common/ErrorState";

/**
 * Shown for any address that matches no route.
 *
 * `inDashboard` is set by the catch-all inside the dashboard, where this
 * renders in the layout's <main> so the sidebar stays and the user is one
 * click from anywhere. Outside the dashboard nobody is signed in yet, so the
 * way out is the login page instead.
 */
const NotFound = ({ inDashboard = false }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    return (
        <ErrorState
            inline={inDashboard}
            code="404"
            icon={<FiSearch size={22} />}
            title="Page not found"
            message="That address does not match any page in the payroll system. Check the spelling, or use the menu to get where you were going."
            detail={pathname}
        >
            <button
                type="button"
                onClick={() => navigate(-1)}
                className={ACTION_SECONDARY}
            >
                Go back
            </button>
            <Link
                to={inDashboard ? "/dashboard" : "/login"}
                className={ACTION_PRIMARY}
            >
                {inDashboard ? "Back to dashboard" : "Go to sign in"}
            </Link>
        </ErrorState>
    );
};
export default NotFound;
