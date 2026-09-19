import { useLocation } from "react-router-dom";
import { IoMenuOutline, IoSearchOutline } from "react-icons/io5";
import { matchNavLink } from "../../constants/navigation";

// One header for both breakpoints. It used to be lg:hidden — a hamburger and a
// fixed title, which left the desktop with no header at all and nowhere to put
// anything global. Sticky rather than fixed, matching the sidebar, so the page
// keeps its ordinary single scrollbar.
//
// It deliberately carries no links: the sidebar already has all thirty, one
// click away, and repeating them here would only fit as dropdowns — slower to
// use than the list already on screen. What the bar adds is where you are, and
// a way to get anywhere without looking for it.

// Mac reads ⌘K, everyone else Ctrl+K. Checked once at module load; nothing here
// changes platform mid-session.
const IS_MAC =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const Nav = ({ onMenuOpen, onOpenPalette, user }) => {
    const { pathname } = useLocation();
    const current = matchNavLink(pathname, user?.role);

    return (
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
            <button
                onClick={onMenuOpen}
                className="lg:hidden text-slate-600 hover:text-slate-900"
                aria-label="Open navigation"
            >
                <IoMenuOutline className="text-2xl" />
            </button>

            <div className="min-w-0 flex items-baseline gap-2">
                {current?.group && (
                    <>
                        <span className="hidden sm:inline text-xs text-slate-400">
                            {current.group}
                        </span>
                        <span className="hidden sm:inline text-xs text-slate-300">
                            /
                        </span>
                    </>
                )}
                <h1 className="font-semibold text-slate-800 truncate">
                    {current?.label ?? "Payroll System"}
                </h1>
            </div>

            <button
                type="button"
                onClick={onOpenPalette}
                className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
                <IoSearchOutline className="text-sm" />
                <span className="hidden sm:inline">Jump to page</span>
                <kbd className="hidden sm:inline font-sans text-[10px] border border-slate-300 rounded px-1 py-px">
                    {IS_MAC ? "⌘" : "Ctrl"} K
                </kbd>
            </button>
        </header>
    );
};

export default Nav;
