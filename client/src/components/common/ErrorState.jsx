import logo from "../../assets/ynl.png";

// Shared by the buttons and links the error screens offer, so a 404 and a
// failed loader put the same pair of controls in front of the user.
export const ACTION_PRIMARY =
    "rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700";
export const ACTION_SECONDARY =
    "rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50";

/**
 * The shell the error screens share: a status code, a heading, a sentence
 * explaining what happened, an optional technical detail, and whatever actions
 * the caller passes as children.
 *
 * `inline` renders it as a block that drops into the dashboard's <main>, so a
 * mistyped address keeps the sidebar and nav and the user can click straight
 * back out. Without it the state takes over the screen, which is what the
 * router needs when the layout itself is the thing that failed.
 */
const ErrorState = ({
    code,
    title,
    message,
    detail,
    icon,
    inline = false,
    children,
}) => {
    const panel = (
        <div className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            {icon && (
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    {icon}
                </div>
            )}

            {code && (
                <p className="font-serif text-5xl tracking-tight text-slate-800 sm:text-6xl">
                    {code}
                </p>
            )}

            <h1 className="mt-3 text-xl font-bold text-slate-800 sm:text-2xl">
                {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {message}
            </p>

            {detail && (
                <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-left font-mono text-xs break-words text-slate-500">
                    {detail}
                </p>
            )}

            {children && (
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    {children}
                </div>
            )}
        </div>
    );

    if (inline) return <div className="py-6">{panel}</div>;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-14">
            <img
                src={logo}
                alt=""
                className="mb-8 w-20 select-none"
                draggable="false"
            />
            {panel}
        </div>
    );
};
export default ErrorState;
