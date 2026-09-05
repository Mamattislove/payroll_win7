import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";
import ErrorState, {
    ACTION_PRIMARY,
    ACTION_SECONDARY,
} from "../components/common/ErrorState";
import NotFound from "./NotFound";

/*
 * What the user is told, by what the router handed us. The wording assumes the
 * reader is a payroll clerk rather than a developer: say what happened and what
 * to do about it, and leave the technical detail to the panel at the bottom.
 */
const STATUS_COPY = {
    401: {
        title: "You are signed out",
        message:
            "The session ended, either because it expired or because the account was signed in somewhere else. Sign in again to continue.",
    },
    403: {
        title: "You do not have access",
        message:
            "This account is not allowed to open that page. Ask an administrator to change the account's role if you need it.",
    },
    500: {
        title: "The server ran into a problem",
        message:
            "The request reached the server but it could not be completed. Try again in a moment, and pass on the detail below if it keeps happening.",
    },
};

const GENERIC = {
    title: "Something went wrong",
    message:
        "The page could not be displayed. Reloading usually clears it; if it does not, pass on the detail below to whoever maintains the system.",
};

/*
 * Each page is fetched on demand, so a tab left open while the server gets a
 * new build asks for a chunk whose filename no longer exists. It looks like a
 * crash and is fixed by reloading, so it is worth saying so plainly.
 */
const STALE_BUILD =
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

const STALE_COPY = {
    title: "The system was updated",
    message:
        "This tab is running an older version of the payroll system than the server is now serving. Reload the page to pick up the current one.",
};

const ErrorPage = () => {
    const error = useRouteError();

    // An unmatched URL reaches the router as a thrown 404 response. That is not
    // a fault worth alarming anyone about, so it reads as the not-found page.
    if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;

    // Null when a page threw an exception rather than the server answering, in
    // which case there is no status worth putting on the screen.
    const isResponse = isRouteErrorResponse(error);
    const status = isResponse ? error.status : null;
    const detail = isResponse
        ? error.data?.msg ||
          error.data?.message ||
          (typeof error.data === "string" ? error.data : "") ||
          error.statusText
        : error?.message || String(error ?? "");

    const stale = !isResponse && STALE_BUILD.test(detail);
    const copy = stale
        ? STALE_COPY
        : (STATUS_COPY[status] ?? (status >= 500 ? STATUS_COPY[500] : GENERIC));

    return (
        <ErrorState
            code={status}
            icon={<FiAlertTriangle size={22} />}
            title={copy.title}
            message={copy.message}
            detail={detail}
        >
            {status === 401 ? (
                <>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className={ACTION_SECONDARY}
                    >
                        Reload page
                    </button>
                    <Link to="/login" className={ACTION_PRIMARY}>
                        Sign in again
                    </Link>
                </>
            ) : (
                <>
                    <Link to="/dashboard" className={ACTION_SECONDARY}>
                        Back to dashboard
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className={ACTION_PRIMARY}
                    >
                        Reload page
                    </button>
                </>
            )}
        </ErrorState>
    );
};
export default ErrorPage;
