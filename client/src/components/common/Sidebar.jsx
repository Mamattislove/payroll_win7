import { NavLink } from "react-router-dom";
import {
    IoCloseOutline,
    IoKeyOutline,
    IoLogOutOutline,
} from "react-icons/io5";
import customFetch from "../../../utils/customFetch";
import { visibleNavGroups } from "../../constants/navigation";

const Sidebar = ({ user, isOpen, onClose }) => {
    const visibleGroups = visibleNavGroups(user?.role);

    const handleLogout = async () => {
        await customFetch.get("/auth/logout");
        window.location.href = "/login";
    };

    // lg:h-screen is what gives the nav's own overflow-y-auto something to
    // scroll against. DashboardLayout is min-h-screen, so it grows with the
    // page; a stretched static sidebar grows with it, the nav never overflows,
    // and the whole page scrolls instead — carrying the sidebar off-screen on
    // exactly the long table pages where you still need it. lg:self-start opts
    // out of the flex stretch that would otherwise override that height and
    // defeat the sticky. Mobile keeps the fixed / inset-y-0 path, unaffected.
    return (
        <aside
            className={`fixed lg:sticky lg:top-0 lg:self-start lg:h-screen inset-y-0 left-0 z-30 w-60 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 lg:translate-x-0 ${
                isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
                <h1 className="font-bold text-base">
                    Yaman ng Lahi Labor Service Cooperative
                </h1>
                <button
                    className="lg:hidden text-slate-400 hover:text-white"
                    onClick={onClose}
                >
                    <IoCloseOutline className="text-xl" />
                </button>
            </div>

            <nav className="scrollbar-slim flex-1 overflow-y-auto py-4 px-3 space-y-5">
                {visibleGroups.map((group) => (
                    <div key={group.label}>
                        <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                            {group.label}
                        </p>
                        <ul className="space-y-0.5">
                            {group.links.map(
                                ({ to, icon: Icon, label, end }) => (
                                    <li key={to}>
                                        <NavLink
                                            to={to}
                                            end={end}
                                            onClick={onClose}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                                    isActive
                                                        ? "bg-slate-700 text-white"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                                                }`
                                            }
                                        >
                                            <Icon className="text-base shrink-0" />
                                            {label}
                                        </NavLink>
                                    </li>
                                ),
                            )}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="px-4 py-4 border-t border-slate-700 shrink-0">
                <div className="mb-2 px-2">
                    <p className="text-sm font-medium truncate">
                        {user?.username}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">
                        {user?.role}
                    </p>
                </div>
                <NavLink
                    to="/dashboard/change-password"
                    onClick={onClose}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                >
                    <IoKeyOutline className="text-base" />
                    Change Password
                </NavLink>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    <IoLogOutOutline className="text-base" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
