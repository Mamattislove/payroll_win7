import { useEffect, useState } from "react";
import { Outlet, redirect, useLoaderData } from "react-router-dom";
import customFetch from "../../utils/customFetch";
import { Sidebar, Nav, CommandPalette } from "../components";

export const loader = async () => {
    try {
        const { data } = await customFetch.get("/users/current-user");
        return { user: data.user };
    } catch {
        return redirect("/login");
    }
};

const DashboardLayout = () => {
    const { user } = useLoaderData();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);

    // The palette's shortcut lives here rather than in the palette, because the
    // palette only exists while open — something outside it has to be listening
    // in order to open it. Escape rides along so it closes even if focus has
    // wandered out of the input.
    useEffect(() => {
        const onKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen((v) => !v);
            } else if (e.key === "Escape") {
                setPaletteOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <div className="flex min-h-screen bg-slate-50">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar
                user={user}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0">
                <Nav
                    user={user}
                    onMenuOpen={() => setSidebarOpen(true)}
                    onOpenPalette={() => setPaletteOpen(true)}
                />

                <main className="flex-1 p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>

            {paletteOpen && (
                <CommandPalette
                    role={user?.role}
                    onClose={() => setPaletteOpen(false)}
                />
            )}
        </div>
    );
};
export default DashboardLayout;
