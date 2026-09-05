import { useState } from "react";
import {
    redirect,
    useLoaderData,
    useSearchParams,
    useRevalidator,
} from "react-router-dom";
import { toast } from "react-toastify";
import { FiPlus, FiEdit2, FiTrash2, FiKey, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { Overlay, InputField, useConfirm, Pagination } from "../components";
import { USER_ROLES } from "../../../utils/constants";

const PAGE_SIZE = 25;

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const params = new URLSearchParams();
        params.set("page", url.searchParams.get("page") || "1");
        params.set("limit", String(PAGE_SIZE));
        for (const key of ["search", "role"]) {
            const v = url.searchParams.get(key);
            if (v) params.set(key, v);
        }

        const { data } = await customFetch.get(`/users?${params}`);
        return data;
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        // Non-admins are rejected by the API; send them back rather than
        // rendering an error page.
        if (error?.response?.status === 403) return redirect("/dashboard");
        throw error;
    }
};

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls =
    "text-[11px] font-semibold uppercase tracking-widest text-slate-400";

const ROLE_STYLES = {
    admin: "bg-red-50 text-red-700 border-red-200",
    hr: "bg-blue-50 text-blue-700 border-blue-200",
    viewer: "bg-slate-100 text-slate-600 border-slate-200",
    user: "bg-slate-100 text-slate-600 border-slate-200",
};

const RoleBadge = ({ role }) => (
    <span
        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            ROLE_STYLES[role] ?? "bg-slate-100 text-slate-600 border-slate-200"
        }`}
    >
        {role ?? "—"}
    </span>
);

const fmtDate = (v) =>
    v
        ? new Date(v).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "2-digit",
          })
        : "—";

const errorMessage = (error) => {
    const msg =
        error?.response?.data?.msg ??
        error?.response?.data?.message ??
        error.message;
    return Array.isArray(msg) ? msg.join(", ") : msg;
};

const Field = ({ label, children }) => (
    <div className="flex flex-col gap-1.5">
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

const ModalCard = ({ title, onClose, children }) => (
    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
            >
                <FiX size={18} />
            </button>
        </div>
        {children}
    </div>
);

const SubmitButton = ({ saving, children }) => (
    <button
        type="submit"
        disabled={saving}
        className="mt-2 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400"
    >
        {saving ? "Saving…" : children}
    </button>
);

/* ── Add user ─────────────────────────────────────────────────────────────── */

const AddUserModal = ({ onClose, onSaved }) => {
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = Object.fromEntries(new FormData(e.target));
            // Account creation goes through the admin-only register route,
            // which already validates the payload and hashes the password.
            await customFetch.post("/auth/register", body);
            toast.success("User created");
            onSaved();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalCard title="Add User" onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <InputField label="Username" name="username" required />
                <InputField
                    label="Email"
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                />
                <Field label="Department">
                    <input name="department" className={inputCls} />
                </Field>
                <Field label="Role">
                    <select name="role" defaultValue={USER_ROLES.USER} className={inputCls}>
                        {Object.values(USER_ROLES).map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </Field>
                <InputField
                    label="Password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                />
                <InputField
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                />
                <SubmitButton saving={saving}>Create user</SubmitButton>
            </form>
        </ModalCard>
    );
};

/* ── Edit user ────────────────────────────────────────────────────────────── */

const EditUserModal = ({ user, onClose, onSaved }) => {
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = Object.fromEntries(new FormData(e.target));
            await customFetch.patch(`/users/${user._id}`, body);
            toast.success("User updated");
            onSaved();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalCard title={`Edit ${user.username}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <InputField
                    label="Username"
                    name="username"
                    defaultValue={user.username ?? ""}
                />
                <InputField
                    label="Email"
                    name="email"
                    type="email"
                    defaultValue={user.email ?? ""}
                />
                <Field label="Department">
                    <input
                        name="department"
                        defaultValue={user.department ?? ""}
                        className={inputCls}
                    />
                </Field>
                <Field label="Role">
                    <select
                        name="role"
                        defaultValue={user.role}
                        className={inputCls}
                    >
                        {Object.values(USER_ROLES).map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </Field>
                <SubmitButton saving={saving}>Save changes</SubmitButton>
            </form>
        </ModalCard>
    );
};

/* ── Reset password ───────────────────────────────────────────────────────── */

const ResetPasswordModal = ({ user, onClose, onSaved }) => {
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = Object.fromEntries(new FormData(e.target));
            await customFetch.patch(`/users/${user._id}/password`, body);
            toast.success(`Password reset for ${user.username}`);
            onSaved();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalCard title={`Reset password — ${user.username}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-xs text-slate-500">
                    Set a temporary password and pass it to the user directly.
                    Minimum 8 characters.
                </p>
                <InputField
                    label="New Password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                />
                <InputField
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                />
                <SubmitButton saving={saving}>Reset password</SubmitButton>
            </form>
        </ModalCard>
    );
};

/* ── Page ─────────────────────────────────────────────────────────────────── */

const Users = () => {
    const { users, totalUsers, totalPages, currentPage } = useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();
    const { confirmModal, askConfirm } = useConfirm();

    const [modal, setModal] = useState(null);
    const [searchInput, setSearchInput] = useState(
        searchParams.get("search") || "",
    );

    const filterRole = searchParams.get("role") || "";
    const hasFilters = searchParams.get("search") || filterRole;

    const applyFilters = (updates) => {
        const params = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(updates)) {
            if (value) params.set(key, value);
            else params.delete(key);
        }
        params.set("page", "1");
        setSearchParams(params);
    };

    const setPage = (page) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", String(page));
        setSearchParams(params);
    };

    const closeAndRefresh = () => {
        setModal(null);
        revalidator.revalidate();
    };

    const handleDelete = (user) => {
        askConfirm(`Delete the account "${user.username}"?`, async () => {
            try {
                await customFetch.delete(`/users/${user._id}`);
                toast.success("User deleted");
                revalidator.revalidate();
            } catch (error) {
                toast.error(errorMessage(error));
            }
        });
    };

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Users</h1>
                    <p className="text-slate-500 mt-1">
                        {totalUsers} account{totalUsers === 1 ? "" : "s"} · only
                        an admin can create these
                    </p>
                </div>
                <button
                    onClick={() => setModal({ mode: "add" })}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white transition-colors hover:bg-slate-700"
                >
                    <FiPlus size={14} />
                    Add User
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Search</label>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            applyFilters({ search: searchInput });
                        }}
                    >
                        <input
                            type="text"
                            placeholder="Username, email or department…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className={`${inputCls} sm:w-64`}
                        />
                    </form>
                </div>
                <div className="flex flex-col gap-1">
                    <label className={labelCls}>Role</label>
                    <select
                        value={filterRole}
                        onChange={(e) => applyFilters({ role: e.target.value })}
                        className={`${inputCls} sm:w-auto`}
                    >
                        <option value="">All roles</option>
                        {Object.values(USER_ROLES).map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </div>
                {hasFilters && (
                    <button
                        onClick={() => {
                            setSearchInput("");
                            setSearchParams({});
                        }}
                        className="pb-2.5 text-xs text-slate-500 underline hover:text-slate-800"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">Username</th>
                            <th className="px-4 py-3 text-left">Email</th>
                            <th className="px-4 py-3 text-left">Department</th>
                            <th className="px-4 py-3 text-left">Role</th>
                            <th className="px-4 py-3 text-left">Added by</th>
                            <th className="px-4 py-3 text-left">Created</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    {hasFilters
                                        ? "No users match these filters."
                                        : "No users yet."}
                                </td>
                            </tr>
                        )}
                        {users.map((user) => (
                            <tr key={user._id} className="bg-white hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {user.username || "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {user.email}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {user.department || "—"}
                                </td>
                                <td className="px-4 py-3">
                                    <RoleBadge role={user.role} />
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                    {user.addedBy?.username || "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                    {fmtDate(user.createdAt)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() =>
                                                setModal({ mode: "edit", user })
                                            }
                                            className="text-blue-500 hover:text-blue-700"
                                            title="Edit user"
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() =>
                                                setModal({ mode: "password", user })
                                            }
                                            className="text-amber-500 hover:text-amber-700"
                                            title="Reset password"
                                        >
                                            <FiKey size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user)}
                                            className="text-red-400 hover:text-red-600"
                                            title="Delete user"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
            />

            <Overlay isOpen={!!modal} onClose={() => setModal(null)}>
                {modal?.mode === "add" && (
                    <AddUserModal
                        onClose={() => setModal(null)}
                        onSaved={closeAndRefresh}
                    />
                )}
                {modal?.mode === "edit" && (
                    <EditUserModal
                        user={modal.user}
                        onClose={() => setModal(null)}
                        onSaved={closeAndRefresh}
                    />
                )}
                {modal?.mode === "password" && (
                    <ResetPasswordModal
                        user={modal.user}
                        onClose={() => setModal(null)}
                        onSaved={closeAndRefresh}
                    />
                )}
            </Overlay>

            {confirmModal}
        </div>
    );
};

export default Users;
