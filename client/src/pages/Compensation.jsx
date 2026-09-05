import { useState, useEffect } from "react";
import {
    redirect,
    useLoaderData,
    useSearchParams,
    useRevalidator,
} from "react-router-dom";
import { toast } from "react-toastify";
import { FiPlus, FiEdit2, FiEye, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { fetchAllPages } from "../../utils/fetchAllPages";
import { Overlay, Pagination } from "../components";
import {
    CONTRACT_TYPES,
    PAYROLL_PERIODS,
    COMPENSATION_STATUS,
    SSS_CONTRIBUTION_BASIS,
    PHILHEALTH_CONTRIBUTION_BASIS,
    PAGIBIG_CONTRIBUTION_BASIS,
    PAYROLL_EMPLOYMENT_TYPE,
    EMPLOYMENT_STATUS,
    DAYS,
} from "../../../utils/constants";
import {
    formatDays,
    formatRestDays,
    normalizeWeeklySchedule,
} from "@shared/weeklySchedule";

const PAGE_SIZE = 20;

// The employee/compensation join, hasComp filter, search, and pagination all
// happen server-side now (see employeeController.getEmployeesWithCompensation)
// instead of pulling entire collections into the browser on every load.
export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || "1";
        const search = url.searchParams.get("search") || "";
        const hasComp = url.searchParams.get("hasComp") || "";
        const status = url.searchParams.get("status") || "";
        const client = url.searchParams.get("client") || "";

        const [{ data }, clients, departments, positions] = await Promise.all([
            customFetch.get("/employees/with-compensation", {
                params: { page, limit: PAGE_SIZE, search, hasComp, status, client },
            }),
            fetchAllPages("/clients", {}, "clients"),
            fetchAllPages("/departments", {}, "departments"),
            fetchAllPages("/positions", {}, "positions"),
        ]);

        return {
            employees: data.employees,
            totalEmployees: data.totalEmployees,
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            clients,
            departments,
            positions,
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

// ─── shared UI ────────────────────────────────────────────────────────────────

const inputCls =
    "w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 bg-white";
const labelCls = "block text-xs text-slate-500 mb-0.5";

const Field = ({ label, children }) => (
    <div>
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

const ModalSection = ({ title, children }) => (
    <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mb-3">
            {title}
        </p>
        <div className="flex flex-col gap-3">{children}</div>
    </div>
);

const fmt = (val) =>
    val != null
        ? `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

// Contract and hire dates are stored at UTC midnight — render them in UTC so
// they do not slip a day for viewers east of Greenwich.
const fmtDate = (v) =>
    v
        ? new Date(v).toLocaleDateString("en-PH", {
              timeZone: "UTC",
              year: "numeric",
              month: "short",
              day: "2-digit",
          })
        : null;

// A table cell with a bold value and a muted detail line beneath it.
const Cell = ({ main, sub, className = "", subClassName = "" }) => (
    <td className={`px-3 py-2.5 align-top ${className}`}>
        <p className="text-slate-800 leading-snug">{main || "—"}</p>
        {sub && (
            <p className={`text-[11px] text-slate-400 mt-0.5 leading-snug ${subClassName}`}>
                {sub}
            </p>
        )}
    </td>
);

const CompBadge = ({ compensation }) => {
    if (!compensation)
        return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                None
            </span>
        );
    if (compensation.activeStatus === COMPENSATION_STATUS.ACTIVE)
        return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Active
            </span>
        );
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
            Inactive
        </span>
    );
};

const toDate = (val) => (val ? val.slice(0, 10) : "");

const ViewField = ({ label, value, capitalize }) => (
    <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        <p className={`text-sm text-slate-800 ${capitalize ? "capitalize" : ""}`}>{value || "—"}</p>
    </div>
);

// ─── component ────────────────────────────────────────────────────────────────

const Compensation = () => {
    const {
        employees,
        totalEmployees,
        totalPages,
        currentPage,
        clients,
        departments,
        positions,
    } = useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();

    const search = searchParams.get("search") || "";
    const hasComp = searchParams.get("hasComp") || "";
    const status = searchParams.get("status") || "";

    const [searchInput, setSearchInput] = useState(search);
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [monthlyRateInput, setMonthlyRateInput] = useState("");
    // Designations for the employee currently open in the modal, fetched on
    // demand instead of preloading every designation up front.
    const [modalDesignations, setModalDesignations] = useState([]);

    // Designation step: controlled selects + sub-modal quick-create
    const [desigForm, setDesigForm] = useState({
        client: "",
        department: "",
        position: "",
    });
    const [extraClients, setExtraClients] = useState([]);
    const [extraDepts, setExtraDepts] = useState([]);
    const [extraPositions, setExtraPositions] = useState([]);
    const [subModal, setSubModal] = useState(null); // "client" | "department" | "position" | null
    const [subForm, setSubForm] = useState({});
    const [subSaving, setSubSaving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams);
            if (searchInput) {
                params.set("search", searchInput);
            } else {
                params.delete("search");
            }
            params.set("page", "1");
            setSearchParams(params);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        if (modal?.step === "compensation") {
            const existing = modal?.compensation?.monthlyRate;
            setMonthlyRateInput(existing != null ? String(existing) : "");
        }
    }, [modal?.step, modal?.compensation?._id]);

    const computedDailyRate =
        monthlyRateInput !== "" && !isNaN(Number(monthlyRateInput))
            ? Math.round((Number(monthlyRateInput) / 26) * 100) / 100
            : null;

    const handleFilter = (key, value) => {
        const params = new URLSearchParams(searchParams);
        if (value) params.set(key, value);
        else params.delete(key);
        params.set("page", "1");
        setSearchParams(params);
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearchParams({ page: "1" });
    };

    const setPage = (page) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", page);
        setSearchParams(params);
    };

    const fetchDesignationsFor = async (employeeId) => {
        const { data } = await customFetch.get("/employee-designations", {
            params: { employee: employeeId, limit: 100 },
        });
        return data.employeeDesignations || [];
    };

    // The employee list only carries a slim projection of each compensation
    // (see employeeController.getEmployeesWithCompensation) for list-page
    // performance — monthlyRate and most other fields aren't included there,
    // so the Edit/View modals fetch the full record by id instead.
    const fetchFullCompensation = async (compensationId) => {
        const { data } = await customFetch.get(`/compensations/${compensationId}`);
        return data.compensation;
    };

    const openAdd = async (employee) => {
        setDesigForm({ client: "", department: "", position: "" });
        setExtraClients([]);
        setExtraDepts([]);
        setExtraPositions([]);
        setSubModal(null);
        setSubForm({});
        setModalDesignations([]);
        setModal({ mode: "add", step: "loading", employee });
        try {
            const desigs = await fetchDesignationsFor(employee._id);
            setModalDesignations(desigs);
            setModal({
                mode: "add",
                step: desigs.length ? "compensation" : "designation",
                employee,
            });
        } catch (err) {
            toast.error(err?.response?.data?.msg || err.message);
            setModal(null);
        }
    };
    const openEdit = async (employee) => {
        setModalDesignations([]);
        setModal({
            mode: "edit",
            step: "loading",
            employee,
            compensation: employee.compensation,
        });
        try {
            const [desigs, fullCompensation] = await Promise.all([
                fetchDesignationsFor(employee._id),
                fetchFullCompensation(employee.compensation._id),
            ]);
            setModalDesignations(desigs);
            setModal({
                mode: "edit",
                step: "compensation",
                employee,
                compensation: fullCompensation,
            });
        } catch (err) {
            toast.error(err?.response?.data?.msg || err.message);
            setModal(null);
        }
    };
    const closeModal = () => setModal(null);

    const [viewItem, setViewItem] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);

    const openView = async (employee) => {
        setViewItem({ employee, compensation: null });
        setViewLoading(true);
        try {
            const fullCompensation = await fetchFullCompensation(employee.compensation._id);
            setViewItem({ employee, compensation: fullCompensation });
        } catch (err) {
            toast.error(err?.response?.data?.msg || err.message);
            setViewItem(null);
        } finally {
            setViewLoading(false);
        }
    };
    const closeView = () => setViewItem(null);

    const SUB_DEFAULTS = {
        client: {
            clientName: "",
            clientSince: "",
            clientAddress: "",
            clientEmail: "",
            clientTelephone: "",
            contactPerson: "",
            contactPersonNumber: "",
            contactPersonEmail: "",
        },
        department: { departmentName: "", departmentDesc: "" },
        position: { positionName: "", positionDesc: "" },
    };

    const openSubModal = (type) => {
        setSubForm(SUB_DEFAULTS[type]);
        setSubModal(type);
    };

    const handleSubModalSubmit = async (e) => {
        e.preventDefault();
        setSubSaving(true);
        try {
            const body = Object.fromEntries(
                Object.entries(subForm).filter(([, v]) => v !== ""),
            );
            if (subModal === "client") {
                const { data } = await customFetch.post("/clients", body);
                setExtraClients((prev) => [...prev, data.client]);
                setDesigForm((f) => ({ ...f, client: data.client._id }));
            } else if (subModal === "department") {
                const { data } = await customFetch.post("/departments", body);
                setExtraDepts((prev) => [...prev, data.department]);
                setDesigForm((f) => ({
                    ...f,
                    department: data.department._id,
                }));
            } else if (subModal === "position") {
                const { data } = await customFetch.post("/positions", body);
                setExtraPositions((prev) => [...prev, data.position]);
                setDesigForm((f) => ({ ...f, position: data.position._id }));
            }
            toast.success(
                `${subModal.charAt(0).toUpperCase() + subModal.slice(1)} created`,
            );
            setSubModal(null);
            revalidator.revalidate();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err.message);
        } finally {
            setSubSaving(false);
        }
    };

    const handleDesignationSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await customFetch.post("/employee-designations", {
                employee: modal.employee._id,
                client: desigForm.client,
                department: desigForm.department,
                position: desigForm.position,
            });
            toast.success("Department / Position saved — now add compensation");
            setModal((prev) => ({
                ...prev,
                step: "compensation",
                newDesignation: data.employeeDesignation,
            }));
            revalidator.revalidate();
        } catch (error) {
            toast.error(
                error?.response?.data?.msg ||
                    error?.response?.data?.message ||
                    error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const formData = new FormData(e.target);
            const raw = Object.fromEntries(formData);

            // Strip empty strings and convert number fields
            const body = {};
            const numberFields = [
                "monthlyRate",
                "sssOverwriteAmount",
                "philhealthOverwriteAmount",
                "pagibigOverwriteAmount",
            ];
            for (const [key, value] of Object.entries(raw)) {
                if (key === "weeklySchedule") continue; // multi-value
                if (value === "") continue;
                body[key] = numberFields.includes(key) ? Number(value) : value;
            }

            // Checkbox group: Object.fromEntries keeps only the last ticked
            // box, so collect every value. Sent even when empty, otherwise
            // the empty-string skip above would silently keep the old days.
            if (e.target.querySelector('[name="weeklySchedule"]')) {
                body.weeklySchedule = formData.getAll("weeklySchedule");
            }

            if (modal.mode === "add") {
                body.employee = modal.employee._id;
                await customFetch.post("/compensations", body);
                toast.success("Compensation added");
            } else {
                await customFetch.patch(
                    `/compensations/${modal.compensation._id}`,
                    body,
                );
                toast.success("Compensation updated");
            }
            closeModal();
            revalidator.revalidate();
        } catch (error) {
            toast.error(
                error?.response?.data?.msg ||
                    error?.response?.data?.message ||
                    error.message,
            );
        } finally {
            setSaving(false);
        }
    };

    const clientFilter = searchParams.get("client") || "";
    const hasFilters = search || hasComp || status || clientFilter;
    const comp = modal?.compensation;

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Compensation
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Total: {totalEmployees}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
                <input
                    type="text"
                    placeholder="Search by name or code..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 w-full sm:w-60"
                />
                <select
                    value={hasComp}
                    onChange={(e) => handleFilter("hasComp", e.target.value)}
                    className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 bg-white"
                >
                    <option value="">All Employees</option>
                    <option value="yes">Has Compensation</option>
                    <option value="no">No Compensation</option>
                </select>
                <select
                    value={clientFilter}
                    onChange={(e) => handleFilter("client", e.target.value)}
                    className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 bg-white"
                >
                    <option value="">All Clients</option>
                    {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                            {c.clientName}
                        </option>
                    ))}
                </select>
                <select
                    value={status}
                    onChange={(e) => handleFilter("status", e.target.value)}
                    className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 bg-white"
                >
                    <option value="">All Statuses</option>
                    <option value={EMPLOYMENT_STATUS.ACTIVE}>
                        Active Only
                    </option>
                    <option value={EMPLOYMENT_STATUS.INACTIVE}>
                        Inactive Only
                    </option>
                </select>
                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200">
                {/* Mobile card view */}
                <div className="sm:hidden divide-y divide-slate-100">
                    {employees.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400">
                            No employees found.
                        </p>
                    )}
                    {employees.map((emp) => (
                        <div
                            key={emp._id}
                            className="p-4 flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate">
                                    {emp.firstName}
                                    {emp.middleName
                                        ? ` ${emp.middleName}`
                                        : ""}{" "}
                                    {emp.lastName}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {emp.employeeCode || "—"}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-sm font-semibold text-slate-700">
                                        {fmt(emp.compensation?.dailyRate)}/day
                                    </span>
                                    <span className="text-xs text-slate-400 capitalize">
                                        {emp.compensation?.payrollPeriod || "—"}
                                    </span>
                                </div>
                                <div className="mt-1.5">
                                    <CompBadge
                                        compensation={emp.compensation}
                                    />
                                </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                                {emp.compensation ? (
                                    <>
                                        <button
                                            onClick={() => openView(emp)}
                                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        >
                                            <FiEye size={12} /> View
                                        </button>
                                        <button
                                            onClick={() => openEdit(emp)}
                                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        >
                                            <FiEdit2 size={12} /> Edit
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => openAdd(emp)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
                                    >
                                        <FiPlus size={12} /> Add
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                                <th className="px-3 py-3 text-left">#</th>
                                <th className="px-3 py-3 text-left">Employee Name</th>
                                <th className="px-3 py-3 text-left">ECode</th>
                                <th className="px-3 py-3 text-left">Deployed at</th>
                                <th className="px-3 py-3 text-left">Department</th>
                                <th className="px-3 py-3 text-left">Rate</th>
                                <th className="px-3 py-3 text-left">Contract</th>
                                <th className="px-3 py-3 text-left">Payroll Period</th>
                                <th className="px-3 py-3 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {employees.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-8 text-center text-slate-400"
                                    >
                                        No employees found.
                                    </td>
                                </tr>
                            )}
                            {employees.map((emp, idx) => {
                                const comp = emp.compensation;
                                const hired = fmtDate(emp.employedSince);
                                const start = fmtDate(comp?.startContract);
                                const end = fmtDate(comp?.endContract);
                                const rate =
                                    comp?.dailyRate != null
                                        ? `${fmt(comp.dailyRate)}/day`
                                        : fmt(comp?.monthlyRate);

                                return (
                                    <tr
                                        key={emp._id}
                                        className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}
                                    >
                                        <td className="px-3 py-2.5 align-top text-slate-400">
                                            {(currentPage - 1) * PAGE_SIZE + idx + 1}
                                        </td>

                                        <Cell
                                            className="font-medium min-w-48"
                                            main={`${emp.lastName}, ${emp.firstName}${emp.middleName ? " " + emp.middleName : ""}`}
                                            sub={
                                                hired
                                                    ? `Employed ${hired} – ${emp.employmentStatus === "active" ? "Present" : "Inactive"}`
                                                    : null
                                            }
                                        />

                                        <td className="px-3 py-2.5 align-top text-slate-600 whitespace-nowrap">
                                            {emp.employeeCode || "—"}
                                        </td>

                                        <Cell
                                            className="min-w-56"
                                            main={emp.client?.clientName}
                                            sub={emp.client?.clientAddress}
                                        />

                                        <Cell
                                            className="min-w-40"
                                            main={emp.department?.departmentName}
                                            sub={emp.position?.positionName}
                                        />

                                        <Cell
                                            className="capitalize whitespace-nowrap"
                                            main={comp?.contractType}
                                            sub={comp ? rate : null}
                                            subClassName="tabular-nums"
                                        />

                                        <Cell
                                            className="whitespace-nowrap"
                                            main={start ?? "No Contract"}
                                            sub={end ? `End: ${end}` : null}
                                        />

                                        <Cell
                                            className="capitalize whitespace-nowrap"
                                            main={comp?.payrollPeriod}
                                            sub={comp?.employmentType}
                                            subClassName="uppercase tracking-wide"
                                        />

                                        <td className="px-3 py-2.5 align-top">
                                            <div className="flex items-center gap-1.5">
                                                {comp ? (
                                                    <>
                                                        <button
                                                            onClick={() => openView(emp)}
                                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                                        >
                                                            <FiEye size={13} />
                                                            View
                                                        </button>
                                                        <button
                                                            onClick={() => openEdit(emp)}
                                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                                        >
                                                            <FiEdit2 size={13} />
                                                            Edit
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => openAdd(emp)}
                                                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                                                    >
                                                        <FiPlus size={13} />
                                                        Add
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
            />

            {/* Add / Edit Modal */}
            <Overlay isOpen={!!modal}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
                    {/* ── Step indicator (add mode only) ── */}
                    {modal?.mode === "add" && (
                        <div className="flex items-center gap-2 mb-5">
                            <div
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                                    modal.step === "designation"
                                        ? "bg-slate-900 text-white"
                                        : "bg-green-100 text-green-700"
                                }`}
                            >
                                <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        modal.step === "designation"
                                            ? "bg-white text-slate-900"
                                            : "bg-green-600 text-white"
                                    }`}
                                >
                                    {modal.step === "designation" ? "1" : "✓"}
                                </span>
                                Dept / Position
                            </div>
                            <div className="flex-1 h-px bg-slate-200" />
                            <div
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                                    modal.step === "compensation"
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 text-slate-400"
                                }`}
                            >
                                <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        modal.step === "compensation"
                                            ? "bg-white text-slate-900"
                                            : "bg-slate-300 text-slate-500"
                                    }`}
                                >
                                    2
                                </span>
                                Compensation
                            </div>
                        </div>
                    )}

                    <h2 className="text-lg font-semibold text-slate-800 mb-1">
                        {modal?.mode === "edit"
                            ? "Edit Compensation"
                            : modal?.step === "designation"
                              ? "Assign Department / Position"
                              : "Add Compensation"}
                    </h2>
                    <p className="text-sm text-slate-500 mb-5">
                        {modal?.employee.firstName} {modal?.employee.lastName}
                    </p>

                    {modal?.step === "loading" && (
                        <p className="text-sm text-slate-400 py-8 text-center">
                            Loading…
                        </p>
                    )}

                    {/* ── Step 1: Designation ── */}
                    {modal?.step === "designation" && (
                        <form
                            onSubmit={handleDesignationSubmit}
                            className="flex flex-col gap-4"
                        >
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                This employee has no department / position
                                assignment yet. Set one up before adding
                                compensation.
                            </p>

                            {/* Client */}
                            <Field label="Client">
                                <div className="flex gap-1.5">
                                    <select
                                        value={desigForm.client}
                                        onChange={(e) =>
                                            setDesigForm((f) => ({
                                                ...f,
                                                client: e.target.value,
                                            }))
                                        }
                                        className={`${inputCls} flex-1`}
                                        required
                                    >
                                        <option value="">
                                            — Select Client —
                                        </option>
                                        {[
                                            ...clients,
                                            ...extraClients.filter(
                                                (ec) =>
                                                    !clients.some(
                                                        (c) => c._id === ec._id,
                                                    ),
                                            ),
                                        ].map((c) => (
                                            <option key={c._id} value={c._id}>
                                                {c.clientName}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => openSubModal("client")}
                                        className="flex items-center justify-center w-8 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100"
                                        title="Add new client"
                                    >
                                        <FiPlus size={14} />
                                    </button>
                                </div>
                            </Field>

                            {/* Department */}
                            <Field label="Department">
                                <div className="flex gap-1.5">
                                    <select
                                        value={desigForm.department}
                                        onChange={(e) =>
                                            setDesigForm((f) => ({
                                                ...f,
                                                department: e.target.value,
                                            }))
                                        }
                                        className={`${inputCls} flex-1`}
                                        required
                                    >
                                        <option value="">
                                            — Select Department —
                                        </option>
                                        {[
                                            ...departments,
                                            ...extraDepts.filter(
                                                (ed) =>
                                                    !departments.some(
                                                        (d) => d._id === ed._id,
                                                    ),
                                            ),
                                        ].map((d) => (
                                            <option key={d._id} value={d._id}>
                                                {d.departmentName}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openSubModal("department")
                                        }
                                        className="flex items-center justify-center w-8 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100"
                                        title="Add new department"
                                    >
                                        <FiPlus size={14} />
                                    </button>
                                </div>
                            </Field>

                            {/* Position */}
                            <Field label="Position">
                                <div className="flex gap-1.5">
                                    <select
                                        value={desigForm.position}
                                        onChange={(e) =>
                                            setDesigForm((f) => ({
                                                ...f,
                                                position: e.target.value,
                                            }))
                                        }
                                        className={`${inputCls} flex-1`}
                                        required
                                    >
                                        <option value="">
                                            — Select Position —
                                        </option>
                                        {[
                                            ...positions,
                                            ...extraPositions.filter(
                                                (ep) =>
                                                    !positions.some(
                                                        (p) => p._id === ep._id,
                                                    ),
                                            ),
                                        ].map((p) => (
                                            <option key={p._id} value={p._id}>
                                                {p.positionName}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => openSubModal("position")}
                                        className="flex items-center justify-center w-8 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100"
                                        title="Add new position"
                                    >
                                        <FiPlus size={14} />
                                    </button>
                                </div>
                            </Field>

                            <div className="flex gap-3 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                                >
                                    {saving ? "Saving..." : "Next →"}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── Step 2: Compensation ── */}
                    {modal?.step === "compensation" && (
                        <form
                            onSubmit={handleSubmit}
                            className="flex flex-col gap-6"
                        >
                            {/* ── Contract & Rate ── */}
                            <ModalSection title="Contract & Rate">
                                <Field label="Employee Designation (Client / Dept / Position)">
                                    {(() => {
                                        const empDesignations = [
                                            ...modalDesignations,
                                            ...(modal?.newDesignation &&
                                            !modalDesignations.some(
                                                (ed) =>
                                                    ed._id ===
                                                    modal.newDesignation._id,
                                            )
                                                ? [modal.newDesignation]
                                                : []),
                                        ];
                                        // A compensation with no designation is meaningless (it's what
                                        // orphans this record), so default to the newly-created / current
                                        // designation, falling back to the first available one — never
                                        // leave it on a blank "None" that could be submitted as-is.
                                        const defaultVal =
                                            modal?.newDesignation?._id ??
                                            comp?.employeeDesignation?._id ??
                                            comp?.employeeDesignation ??
                                            empDesignations[0]?._id ??
                                            "";
                                        // Locked on edit — reassigning an existing compensation to a
                                        // different designation would retroactively repoint its whole
                                        // attendance/payroll history to a different client/dept/position.
                                        const locked = modal?.mode === "edit";
                                        return (
                                            <select
                                                name="employeeDesignation"
                                                defaultValue={defaultVal}
                                                disabled={locked}
                                                required
                                                className={
                                                    locked
                                                        ? `${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`
                                                        : inputCls
                                                }
                                            >
                                                {empDesignations.map((ed) => (
                                                    <option
                                                        key={ed._id}
                                                        value={ed._id}
                                                    >
                                                        {ed.client?.clientName}{" "}
                                                        /{" "}
                                                        {
                                                            ed.department
                                                                ?.departmentName
                                                        }{" "}
                                                        /{" "}
                                                        {
                                                            ed.position
                                                                ?.positionName
                                                        }
                                                    </option>
                                                ))}
                                            </select>
                                        );
                                    })()}
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Field label="Employment Type *">
                                        <select
                                            name="employmentType"
                                            defaultValue={
                                                comp?.employmentType ?? ""
                                            }
                                            className={inputCls}
                                            required
                                        >
                                            <option value="">—</option>
                                            {Object.values(
                                                PAYROLL_EMPLOYMENT_TYPE,
                                            ).map((v) => (
                                                <option
                                                    key={v}
                                                    value={v}
                                                    className="capitalize"
                                                >
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Contract Type *">
                                        <select
                                            name="contractType"
                                            defaultValue={
                                                comp?.contractType ?? ""
                                            }
                                            className={inputCls}
                                            required
                                        >
                                            <option value="">—</option>
                                            {Object.values(CONTRACT_TYPES).map(
                                                (v) => (
                                                    <option
                                                        key={v}
                                                        value={v}
                                                        className="capitalize"
                                                    >
                                                        {v}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </Field>
                                    <Field label="Payroll Period *">
                                        <select
                                            name="payrollPeriod"
                                            defaultValue={
                                                comp?.payrollPeriod ?? ""
                                            }
                                            className={inputCls}
                                            required
                                        >
                                            <option value="">—</option>
                                            {Object.values(PAYROLL_PERIODS).map(
                                                (v) => (
                                                    <option
                                                        key={v}
                                                        value={v}
                                                        className="capitalize"
                                                    >
                                                        {v}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Monthly Rate">
                                        <input
                                            type="number"
                                            name="monthlyRate"
                                            min={0}
                                            step={0.01}
                                            value={monthlyRateInput}
                                            onChange={(e) =>
                                                setMonthlyRateInput(
                                                    e.target.value,
                                                )
                                            }
                                            className={inputCls}
                                            placeholder="0.00"
                                        />
                                    </Field>
                                    <Field label="Daily Rate (÷ 26)">
                                        <input
                                            readOnly
                                            value={
                                                computedDailyRate != null
                                                    ? `₱${computedDailyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                                                    : "—"
                                            }
                                            className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`}
                                        />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Field label="Start Contract">
                                        <input
                                            type="date"
                                            name="startContract"
                                            defaultValue={toDate(
                                                comp?.startContract,
                                            )}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="End Contract">
                                        <input
                                            type="date"
                                            name="endContract"
                                            defaultValue={toDate(
                                                comp?.endContract,
                                            )}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Date of Regularization">
                                        <input
                                            type="date"
                                            name="dateOfRegularization"
                                            defaultValue={toDate(
                                                comp?.dateOfRegularization,
                                            )}
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                            </ModalSection>

                            {/* ── Work Schedule ── */}
                            <ModalSection title="Work Schedule">
                                <Field label="Weekly Schedule">
                                    <div className="flex flex-wrap gap-x-4 gap-y-2 py-1.5">
                                        {Object.values(DAYS).map((day) => (
                                            <label
                                                key={day}
                                                className="flex items-center gap-1.5 text-sm text-slate-600"
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="weeklySchedule"
                                                    value={day}
                                                    defaultChecked={normalizeWeeklySchedule(
                                                        comp?.weeklySchedule,
                                                    ).includes(day)}
                                                    className="accent-slate-900"
                                                />
                                                {day.slice(0, 3)}
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Unticked days count as rest days.
                                    </p>
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Time In">
                                        <input
                                            type="time"
                                            name="timeIn"
                                            defaultValue={comp?.timeIn ?? ""}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Time Out">
                                        <input
                                            type="time"
                                            name="timeOut"
                                            defaultValue={comp?.timeOut ?? ""}
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Night Shift Time In">
                                        <input
                                            type="time"
                                            name="nightShiftTimeIn"
                                            defaultValue={
                                                comp?.nightShiftTimeIn ?? ""
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Night Shift Time Out">
                                        <input
                                            type="time"
                                            name="nightShiftTimeOut"
                                            defaultValue={
                                                comp?.nightShiftTimeOut ?? ""
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                            </ModalSection>

                            {/* ── Insurance ── */}
                            <ModalSection title="Insurance">
                                <Field label="Insurance Name">
                                    <input
                                        name="insuranceName"
                                        defaultValue={comp?.insuranceName ?? ""}
                                        className={inputCls}
                                    />
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Date Insured">
                                        <input
                                            type="date"
                                            name="dateInsured"
                                            defaultValue={toDate(
                                                comp?.dateInsured,
                                            )}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Insured Until">
                                        <input
                                            type="date"
                                            name="insuredUntil"
                                            defaultValue={toDate(
                                                comp?.insuredUntil,
                                            )}
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                            </ModalSection>

                            {/* ── Government Contributions ── */}
                            <ModalSection title="Government Contributions">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="SSS Contribution Basis">
                                        <select
                                            name="sssContributionBasis"
                                            defaultValue={
                                                comp?.sssContributionBasis ??
                                                SSS_CONTRIBUTION_BASIS.BASIC_PAY
                                            }
                                            className={inputCls}
                                        >
                                            {Object.values(
                                                SSS_CONTRIBUTION_BASIS,
                                            ).map((v) => (
                                                <option
                                                    key={v}
                                                    value={v}
                                                    className="capitalize"
                                                >
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="SSS Overwrite Amount">
                                        <input
                                            type="number"
                                            name="sssOverwriteAmount"
                                            min={0}
                                            step={0.01}
                                            defaultValue={
                                                comp?.sssOverwriteAmount ?? 0
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="PhilHealth Contribution Basis">
                                        <select
                                            name="philhealthContributionBasis"
                                            defaultValue={
                                                comp?.philhealthContributionBasis ??
                                                PHILHEALTH_CONTRIBUTION_BASIS.GROSS_PAY
                                            }
                                            className={inputCls}
                                        >
                                            {Object.values(
                                                PHILHEALTH_CONTRIBUTION_BASIS,
                                            ).map((v) => (
                                                <option
                                                    key={v}
                                                    value={v}
                                                    className="capitalize"
                                                >
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="PhilHealth Overwrite Amount">
                                        <input
                                            type="number"
                                            name="philhealthOverwriteAmount"
                                            min={0}
                                            step={0.01}
                                            defaultValue={
                                                comp?.philhealthOverwriteAmount ??
                                                0
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Pag-IBIG Contribution Basis">
                                        <select
                                            name="pagibigContributionBasis"
                                            defaultValue={
                                                comp?.pagibigContributionBasis ??
                                                PAGIBIG_CONTRIBUTION_BASIS.WITH_DEDUCTION
                                            }
                                            className={inputCls}
                                        >
                                            {Object.values(
                                                PAGIBIG_CONTRIBUTION_BASIS,
                                            ).map((v) => (
                                                <option
                                                    key={v}
                                                    value={v}
                                                    className="capitalize"
                                                >
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Pag-IBIG Overwrite Amount">
                                        <input
                                            type="number"
                                            name="pagibigOverwriteAmount"
                                            min={0}
                                            step={0.01}
                                            defaultValue={
                                                comp?.pagibigOverwriteAmount ??
                                                0
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                            </ModalSection>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                                >
                                    {saving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </Overlay>

            {/* View Modal */}
            <Overlay isOpen={!!viewItem} onClose={closeView}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-start justify-between mb-1">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">
                                {viewItem?.employee?.firstName}{" "}
                                {viewItem?.employee?.middleName ? viewItem.employee.middleName + " " : ""}
                                {viewItem?.employee?.lastName}
                            </h2>
                            <p className="text-sm text-slate-500 mt-0.5">{viewItem?.employee?.employeeCode || "—"}</p>
                        </div>
                        <button onClick={closeView} className="text-slate-400 hover:text-slate-600">
                            <FiX size={18} />
                        </button>
                    </div>

                    {viewLoading || !viewItem?.compensation ? (
                        <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
                    ) : (
                        <div className="flex flex-col gap-6 mt-4">
                            <ModalSection title="Organization">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <ViewField label="Client" value={viewItem.compensation.employeeDesignation?.client?.clientName} />
                                    <ViewField label="Department" value={viewItem.compensation.employeeDesignation?.department?.departmentName} />
                                    <ViewField label="Position" value={viewItem.compensation.employeeDesignation?.position?.positionName} />
                                </div>
                            </ModalSection>

                            <ModalSection title="Contract & Rate">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <ViewField label="Employment Type" value={viewItem.compensation.employmentType} capitalize />
                                    <ViewField label="Contract Type" value={viewItem.compensation.contractType} capitalize />
                                    <ViewField label="Payroll Period" value={viewItem.compensation.payrollPeriod} capitalize />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <ViewField label="Monthly Rate" value={fmt(viewItem.compensation.monthlyRate)} />
                                    <ViewField label="Daily Rate" value={fmt(viewItem.compensation.dailyRate)} />
                                    <ViewField label="Active Status" value={viewItem.compensation.activeStatus} capitalize />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <ViewField label="Start Contract" value={fmtDate(viewItem.compensation.startContract)} />
                                    <ViewField label="End Contract" value={fmtDate(viewItem.compensation.endContract)} />
                                    <ViewField label="Date of Regularization" value={fmtDate(viewItem.compensation.dateOfRegularization)} />
                                </div>
                            </ModalSection>

                            <ModalSection title="Work Schedule">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ViewField label="Weekly Schedule" value={formatDays(viewItem.compensation.weeklySchedule)} />
                                    <ViewField label="Rest Days" value={formatRestDays(viewItem.compensation.weeklySchedule)} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ViewField label="Time In" value={viewItem.compensation.timeIn} />
                                    <ViewField label="Time Out" value={viewItem.compensation.timeOut} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ViewField label="Night Shift Time In" value={viewItem.compensation.nightShiftTimeIn} />
                                    <ViewField label="Night Shift Time Out" value={viewItem.compensation.nightShiftTimeOut} />
                                </div>
                            </ModalSection>

                            <ModalSection title="Government Contributions">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ViewField label="SSS Basis" value={viewItem.compensation.sssContributionBasis} capitalize />
                                    <ViewField label="SSS Overwrite" value={viewItem.compensation.sssOverwriteAmount ? fmt(viewItem.compensation.sssOverwriteAmount) : "—"} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ViewField label="PhilHealth Basis" value={viewItem.compensation.philhealthContributionBasis} capitalize />
                                    <ViewField label="PhilHealth Overwrite" value={viewItem.compensation.philhealthOverwriteAmount ? fmt(viewItem.compensation.philhealthOverwriteAmount) : "—"} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <ViewField label="Pag-IBIG Basis" value={viewItem.compensation.pagibigContributionBasis} capitalize />
                                    <ViewField label="Pag-IBIG Overwrite" value={viewItem.compensation.pagibigOverwriteAmount ? fmt(viewItem.compensation.pagibigOverwriteAmount) : "—"} />
                                </div>
                            </ModalSection>

                            {(viewItem.compensation.insuranceName || viewItem.compensation.dateInsured || viewItem.compensation.insuredUntil) && (
                                <ModalSection title="Insurance">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <ViewField label="Insurance Name" value={viewItem.compensation.insuranceName} />
                                        <ViewField label="Date Insured" value={fmtDate(viewItem.compensation.dateInsured)} />
                                        <ViewField label="Insured Until" value={fmtDate(viewItem.compensation.insuredUntil)} />
                                    </div>
                                </ModalSection>
                            )}

                            <div className="flex gap-3 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const emp = viewItem.employee;
                                        closeView();
                                        openEdit(emp);
                                    }}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={closeView}
                                    className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Overlay>

            {/* Sub-modal: quick-create Client / Department / Position (z-50 > main modal z-40) */}
            {!!subModal && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setSubModal(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-slate-800">
                                {subModal === "client"
                                    ? "Add Client"
                                    : subModal === "department"
                                      ? "Add Department"
                                      : "Add Position"}
                            </h3>
                            <button
                                onClick={() => setSubModal(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleSubModalSubmit}
                            className="flex flex-col gap-3"
                        >
                            {subModal === "client" && (
                                <>
                                    <Field label="Client Name *">
                                        <input
                                            type="text"
                                            value={subForm.clientName ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    clientName: e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                            required
                                            autoFocus
                                        />
                                    </Field>
                                    <Field label="Client Since">
                                        <input
                                            type="date"
                                            value={subForm.clientSince ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    clientSince: e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Address">
                                        <input
                                            type="text"
                                            value={subForm.clientAddress ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    clientAddress:
                                                        e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                            placeholder="e.g. 123 Main St, Makati"
                                        />
                                    </Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Email">
                                            <input
                                                type="email"
                                                value={
                                                    subForm.clientEmail ?? ""
                                                }
                                                onChange={(e) =>
                                                    setSubForm((f) => ({
                                                        ...f,
                                                        clientEmail:
                                                            e.target.value,
                                                    }))
                                                }
                                                className={inputCls}
                                            />
                                        </Field>
                                        <Field label="Telephone">
                                            <input
                                                type="text"
                                                value={
                                                    subForm.clientTelephone ??
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setSubForm((f) => ({
                                                        ...f,
                                                        clientTelephone:
                                                            e.target.value,
                                                    }))
                                                }
                                                className={inputCls}
                                            />
                                        </Field>
                                    </div>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1 mt-1">
                                        Contact Person
                                    </p>
                                    <Field label="Name">
                                        <input
                                            type="text"
                                            value={subForm.contactPerson ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    contactPerson:
                                                        e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Number">
                                            <input
                                                type="text"
                                                value={
                                                    subForm.contactPersonNumber ??
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setSubForm((f) => ({
                                                        ...f,
                                                        contactPersonNumber:
                                                            e.target.value,
                                                    }))
                                                }
                                                className={inputCls}
                                            />
                                        </Field>
                                        <Field label="Email">
                                            <input
                                                type="email"
                                                value={
                                                    subForm.contactPersonEmail ??
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setSubForm((f) => ({
                                                        ...f,
                                                        contactPersonEmail:
                                                            e.target.value,
                                                    }))
                                                }
                                                className={inputCls}
                                            />
                                        </Field>
                                    </div>
                                </>
                            )}

                            {subModal === "department" && (
                                <>
                                    <Field label="Department Name *">
                                        <input
                                            type="text"
                                            value={subForm.departmentName ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    departmentName:
                                                        e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                            required
                                            autoFocus
                                        />
                                    </Field>
                                    <Field label="Description">
                                        <textarea
                                            value={subForm.departmentDesc ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    departmentDesc:
                                                        e.target.value,
                                                }))
                                            }
                                            className={`${inputCls} resize-none`}
                                            rows={3}
                                        />
                                    </Field>
                                </>
                            )}

                            {subModal === "position" && (
                                <>
                                    <Field label="Position Name *">
                                        <input
                                            type="text"
                                            value={subForm.positionName ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    positionName:
                                                        e.target.value,
                                                }))
                                            }
                                            className={inputCls}
                                            required
                                            autoFocus
                                        />
                                    </Field>
                                    <Field label="Description">
                                        <textarea
                                            value={subForm.positionDesc ?? ""}
                                            onChange={(e) =>
                                                setSubForm((f) => ({
                                                    ...f,
                                                    positionDesc:
                                                        e.target.value,
                                                }))
                                            }
                                            className={`${inputCls} resize-none`}
                                            rows={3}
                                        />
                                    </Field>
                                </>
                            )}

                            <div className="flex gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSubModal(null)}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={subSaving}
                                    className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                                >
                                    {subSaving ? "Saving..." : "Add"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default Compensation;
