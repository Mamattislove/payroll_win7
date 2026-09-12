import { useState } from "react";
import { Link, useNavigate, useRouteLoaderData } from "react-router-dom";
import { toast } from "react-toastify";
import { FiArrowLeft, FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import customFetch from "../../utils/customFetch";

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";
const labelCls =
    "text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1 block";

const MIN_LENGTH = 8;

const BLANK = { currentPassword: "", newPassword: "", confirmPassword: "" };

const PasswordField = ({ label, name, value, onChange, autoComplete, hint }) => {
    const [shown, setShown] = useState(false);
    return (
        <div>
            <label className={labelCls}>{label}</label>
            <div className="relative">
                <input
                    type={shown ? "text" : "password"}
                    name={name}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    required
                    className={`${inputCls} pr-10`}
                />
                <button
                    type="button"
                    onClick={() => setShown((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={shown ? "Hide password" : "Show password"}
                >
                    {shown ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
            </div>
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
    );
};

const ChangePassword = () => {
    const { user } = useRouteLoaderData("dashboard");
    const navigate = useNavigate();
    const [form, setForm] = useState(BLANK);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const set = (e) =>
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    // Checked here only to spare a round trip; the API enforces the same rules,
    // since anything validated purely in the browser is not enforced at all.
    const tooShort =
        form.newPassword.length > 0 && form.newPassword.length < MIN_LENGTH;
    const mismatch =
        form.confirmPassword.length > 0 &&
        form.newPassword !== form.confirmPassword;
    const unchanged =
        form.newPassword.length > 0 &&
        form.newPassword === form.currentPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSaving(true);
        try {
            await customFetch.patch("/users/current-user/password", form);
            toast.success("Password changed");
            setForm(BLANK);
            navigate("/dashboard");
        } catch (err) {
            const msg =
                err?.response?.data?.msg ||
                err?.response?.data?.message ||
                "Could not change the password.";
            setError(Array.isArray(msg) ? msg.join(", ") : msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-center gap-3">
                <Link
                    to="/dashboard"
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <FiArrowLeft size={16} />
                    Back
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Change Password
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Signed in as {user?.username}
                    </p>
                </div>
            </div>

            <form
                onSubmit={handleSubmit}
                className="max-w-md bg-white rounded-xl border border-slate-200"
            >
                <div className="flex flex-col gap-4 px-6 py-5">
                    <PasswordField
                        label="Current Password"
                        name="currentPassword"
                        value={form.currentPassword}
                        onChange={set}
                        autoComplete="current-password"
                    />
                    <PasswordField
                        label="New Password"
                        name="newPassword"
                        value={form.newPassword}
                        onChange={set}
                        autoComplete="new-password"
                        hint={`At least ${MIN_LENGTH} characters.`}
                    />
                    <PasswordField
                        label="Confirm New Password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={set}
                        autoComplete="new-password"
                    />

                    {(tooShort || mismatch || unchanged || error) && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error ||
                                (tooShort
                                    ? `The new password must be at least ${MIN_LENGTH} characters.`
                                    : unchanged
                                      ? "The new password must be different from the current one."
                                      : "The new password and its confirmation do not match.")}
                        </p>
                    )}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                    <Link
                        to="/dashboard"
                        className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving || tooShort || mismatch || unchanged}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        <FiLock size={14} />
                        {saving ? "Saving…" : "Change Password"}
                    </button>
                </div>
            </form>
        </div>
    );
};
export default ChangePassword;
