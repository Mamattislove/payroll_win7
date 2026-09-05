import { Form, redirect, useNavigation } from "react-router-dom";
import { toast } from "react-toastify";
import { InputField } from "../components";
import customFetch from "../../utils/customFetch";
import logo from "../assets/ynl.png";

export const action = async ({ request }) => {
    try {
        const formData = await request.formData();
        const data = Object.fromEntries(formData);
        await customFetch.post("/auth/login", data);
        toast.success("Login successful");
        return redirect("/dashboard");
    } catch (error) {
        toast.error(
            error?.response?.data?.msg ||
                error?.response?.data?.message ||
                "Login failed",
        );
        return error;
    }
};

// Sampled from the logo so the accent rule and hairlines stay in step with it.
const ACCENT =
    "linear-gradient(90deg,#E0A82E 0%,#C0392B 34%,#5E2233 67%,#4A7C7E 100%)";

const Login = () => {
    const navigation = useNavigation();
    const isSubmitting = navigation.state !== "idle";

    return (
        <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.1fr_1fr]">
            {/* ── Brand panel — desktop only ──────────────────────────── */}
            <aside className="relative hidden overflow-hidden bg-linear-to-br from-amber-50 via-white to-teal-50/60 px-10 lg:flex lg:items-center lg:justify-end xl:px-14">
                {/* Concentric rings echoing the circle of figures in the mark */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-32 -top-32 size-112 rounded-full border border-amber-200/60"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-40 -right-28 size-128 rounded-full border border-teal-200/50"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 size-136 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200/50"
                />

                <div className="relative flex w-full max-w-md flex-col items-center">
                    <img
                        src={logo}
                        alt=""
                        className="w-56 select-none xl:w-64"
                        draggable="false"
                    />

                    <div
                        aria-hidden="true"
                        className="mt-10 h-px w-24"
                        style={{ background: ACCENT }}
                    />

                    <h2 className="mt-8 text-center font-serif text-3xl leading-tight tracking-tight text-slate-800 xl:text-4xl">
                        YAMAN NG LAHI
                    </h2>
                    <h3 className="text-center font-serif text-3xl leading-tight tracking-tight text-slate-800 xl:text-2xl">
                        LABOR SERVICE COOPERATIVE
                    </h3>
                    <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-slate-500">
                        Lot 3 Unit 3 Arcadia Residence Borol 1st, Balagtas,
                        Bulacan
                    </p>
                </div>
            </aside>

            {/* ── Form panel ──────────────────────────────────────────── */}
            <main className="relative flex min-h-screen items-center justify-center px-6 py-14 sm:px-10 lg:justify-start lg:px-14">
                <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: ACCENT }}
                />

                <div className="w-full max-w-sm">
                    <img
                        src={logo}
                        alt=""
                        className="mx-auto mb-8 w-24 select-none lg:hidden"
                        draggable="false"
                    />

                    <header className="mb-9">
                        <h1 className="font-serif text-3xl tracking-tight text-slate-900">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Sign in to continue to the payroll system.
                        </p>
                    </header>

                    <Form method="post" className="flex flex-col gap-5">
                        <InputField
                            label="Username"
                            type="text"
                            name="username"
                            placeholder="Enter your username"
                            autoComplete="username"
                            autoFocus
                            required
                            disabled={isSubmitting}
                        />
                        <InputField
                            label="Password"
                            type="password"
                            name="password"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            required
                            disabled={isSubmitting}
                        />

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-sm font-medium tracking-wide text-white transition-all duration-150 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:active:scale-100"
                        >
                            {isSubmitting && (
                                <span
                                    aria-hidden="true"
                                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                                />
                            )}
                            {isSubmitting ? "Signing in…" : "Sign in"}
                        </button>
                    </Form>

                    <p className="mt-10 text-center text-xs text-slate-400">
                        © {new Date().getFullYear()} · Yaman ng Lahi Labor
                        Service Coorperative
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Login;
