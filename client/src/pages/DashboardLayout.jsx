import { useState } from "react";
import { Outlet, redirect, useLoaderData } from "react-router-dom";
import customFetch from "../../utils/customFetch";
import { Sidebar, Nav } from "../components";

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
                <Nav onMenuOpen={() => setSidebarOpen(true)} />

                <main className="flex-1 p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
export default DashboardLayout;
