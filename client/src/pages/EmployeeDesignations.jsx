import { useState, useEffect, useRef } from "react";
import {
    Form,
    redirect,
    useLoaderData,
    useActionData,
    useSearchParams,
    useSubmit,
} from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { EMPLOYMENT_STATUS } from "../../../utils/constants";
import { fetchAllPages } from "../../utils/fetchAllPages";
import { Overlay, useConfirm, Pagination } from "../components";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const employee = url.searchParams.get("employee") || "";
        const client = url.searchParams.get("client") || "";
        const department = url.searchParams.get("department") || "";
        const position = url.searchParams.get("position") || "";

        const params = new URLSearchParams({ page, limit: 20 });
        if (employee) params.set("employee", employee);
        if (client) params.set("client", client);
        if (department) params.set("department", department);
        if (position) params.set("position", position);

        // Employees are searched on demand via the combobox instead of being
        // preloaded in full (2000+ employees would make this page slow to load).
        const [{ data }, clients, departments, positions] =
            await Promise.all([
                customFetch.get(`/employee-designations?${params}`),
                fetchAllPages("/clients", {}, "clients"),
                fetchAllPages("/departments", {}, "departments"),
                fetchAllPages("/positions", {}, "positions"),
            ]);

        return {
            ...data,
            clients,
            departments,
            positions,
        };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

export const action = async ({ request }) => {
    try {
        const formData = await request.formData();
        const data = Object.fromEntries(formData);
        const { actionType, id, ...fields } = data;

        if (actionType === "CREATE") {
            await customFetch.post("/employee-designations", fields);
            toast.success("Designation added");
        } else if (actionType === "UPDATE") {
            await customFetch.patch(`/employee-designations/${id}`, fields);
            toast.success("Designation updated");
        } else if (actionType === "DELETE") {
            await customFetch.delete(`/employee-designations/${id}`);
            toast.success("Designation deleted");
        }
        return { success: true };
    } catch (error) {
        toast.error(
            error?.response?.data?.msg ||
            error?.response?.data?.message ||
            error.message
        );
        return { success: false };
    }
};

// ─── select field for object arrays ──────────────────────────────────────────

const SelectInput = ({ label, name, value, onChange, options, getLabel, required }) => {
    // Controlled only when the caller supplies onChange. Passing `value` with no
    // onChange makes React render the <select> read-only, and passing `value`
    // and `defaultValue` together is a contradiction it warns about. Every
    // caller in the modal omits onChange, so both bindings have to be applied
    // as one or the other — never a mix.
    const controlled = typeof onChange === "function";
    const binding = controlled
        ? { value: value ?? "", onChange: (e) => onChange(e.target.value) }
        : { defaultValue: value || "" };

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {label}
            </label>
            <select
                name={name}
                {...binding}
                required={required}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            >
                <option value="" disabled>Select {label}</option>
                {options.map((o) => (
                    <option key={o._id} value={o._id}>{getLabel(o)}</option>
                ))}
            </select>
        </div>
    );
};

// ─── searchable employee combobox ────────────────────────────────────────────
// Searches employees server-side (`/employees?search=`) instead of filtering a
// preloaded list — with 2000+ employees, loading them all up front made this
// page (and the modals below) slow. `initialEmployee` lets the caller show a
// name for an already-known selection (e.g. editing an existing designation)
// without needing the full list.

const EmployeeCombobox = ({ value, onChange, initialEmployee }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(initialEmployee || null);
    const containerRef = useRef(null);

    const empLabel = (e) => `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || "—";

    useEffect(() => {
        setSelected(initialEmployee || null);
    }, [initialEmployee?._id]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const { data } = await customFetch.get("/employees", {
                    // Inactive employees are kept for their history but
                    // should never be offered as a choice: nearly half the
                    // roster is inactive, so they bury the current staff.
                    params: {
                        search: query,
                        limit: 20,
                        status: EMPLOYMENT_STATUS.ACTIVE,
                    },
                });
                if (!cancelled) setResults(data.employees || []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, open]);

    const handleSelect = (emp) => {
        setSelected(emp);
        onChange(emp._id);
        setQuery("");
        setOpen(false);
    };
    const handleClear = () => {
        setSelected(null);
        onChange("");
        setQuery("");
    };

    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const displayValue = open ? query : (selected ? empLabel(selected) : "");

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search employee…"
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-8 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
                {selected && !open && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Clear"
                    >
                        <FiX size={14} />
                    </button>
                )}
            </div>
            {open && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loading ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">Searching…</p>
                    ) : results.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">No employees found.</p>
                    ) : (
                        results.map((e) => (
                            <button
                                key={e._id}
                                type="button"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => handleSelect(e)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 ${value === e._id ? "bg-slate-50 font-semibold" : ""}`}
                            >
                                <span className="text-slate-800 truncate">{empLabel(e)}</span>
                                {e.employeeCode && <span className="text-slate-400 text-xs shrink-0">{e.employeeCode}</span>}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ─── designation form (shared by add + edit) ─────────────────────────────────

const DesignationForm = ({ defaultValues = {}, clients, departments, positions }) => {
    const [employeeId, setEmployeeId] = useState(
        defaultValues.employee?._id || defaultValues.employee || "",
    );
    const initialEmployee =
        typeof defaultValues.employee === "object" ? defaultValues.employee : null;

    return (
    <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Employee
            </label>
            <EmployeeCombobox
                value={employeeId}
                onChange={setEmployeeId}
                initialEmployee={initialEmployee}
            />
            <input type="hidden" name="employee" value={employeeId} required />
        </div>
        <SelectInput
            label="Client"
            name="client"
            value={defaultValues.client?._id || defaultValues.client || ""}
            options={clients}
            getLabel={(c) => c.clientName}
            required
        />
        <SelectInput
            label="Department"
            name="department"
            value={defaultValues.department?._id || defaultValues.department || ""}
            options={departments}
            getLabel={(d) => d.departmentName}
            required
        />
        <SelectInput
            label="Position"
            name="position"
            value={defaultValues.position?._id || defaultValues.position || ""}
            options={positions}
            getLabel={(p) => p.positionName}
            required
        />
    </div>
    );
};

// ─── main page ───────────────────────────────────────────────────────────────

const EmployeeDesignations = () => {
    const {
        employeeDesignations,
        totalEmployeeDesignations,
        totalPages,
        currentPage,
        clients,
        departments,
        positions,
    } = useLoaderData();

    const actionData = useActionData();
    const [searchParams, setSearchParams] = useSearchParams();
    const submit = useSubmit();
    const { confirmModal, askConfirm } = useConfirm();

    const [showAdd, setShowAdd] = useState(false);
    const [editItem, setEditItem] = useState(null);

    const [filterEmployee, setFilterEmployee] = useState(searchParams.get("employee") || "");
    const [filterEmployeeObj, setFilterEmployeeObj] = useState(null);
    const [filterClient, setFilterClient] = useState(searchParams.get("client") || "");
    const [filterDepartment, setFilterDepartment] = useState(searchParams.get("department") || "");
    const [filterPosition, setFilterPosition] = useState(searchParams.get("position") || "");

    useEffect(() => {
        if (actionData?.success) {
            setShowAdd(false);
            setEditItem(null);
        }
    }, [actionData]);

    // Deep-linked ?employee=<id> filter: fetch just that one employee so the
    // combobox can show a name instead of a blank input.
    useEffect(() => {
        const id = searchParams.get("employee");
        if (!id) return;
        let cancelled = false;
        customFetch
            .get(`/employees/${id}`)
            .then(({ data }) => {
                if (!cancelled) setFilterEmployeeObj(data.employee);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyFilter = (key, value) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (value) p.set(key, value); else p.delete(key);
            p.set("page", "1");
            return p;
        });
    };

    const clearFilters = () => {
        setFilterEmployee(""); setFilterEmployeeObj(null); setFilterClient("");
        setFilterDepartment(""); setFilterPosition("");
        setSearchParams({});
    };

    const hasFilters = filterEmployee || filterClient || filterDepartment || filterPosition;

    const handleDelete = (id, label) => {
        askConfirm(`Delete designation for "${label}"?`, () => {
            submit({ actionType: "DELETE", id }, { method: "post" });
        });
    };

    const setPage = (page) => {
        const params = Object.fromEntries(searchParams);
        setSearchParams({ ...params, page });
    };

    const filterSelectClass =
        "w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100";

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Employee Designations</h1>
                    <p className="text-slate-500 mt-1">Total: {totalEmployeeDesignations}</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="py-2 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    + Add Designation
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="flex flex-col gap-1 w-full sm:w-60">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Employee</label>
                    <EmployeeCombobox
                        value={filterEmployee}
                        initialEmployee={filterEmployeeObj}
                        onChange={(id) => { setFilterEmployee(id); applyFilter("employee", id); }}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Client</label>
                    <select
                        value={filterClient}
                        onChange={(e) => { setFilterClient(e.target.value); applyFilter("client", e.target.value); }}
                        className={filterSelectClass}
                    >
                        <option value="">All Clients</option>
                        {clients.map((c) => (
                            <option key={c._id} value={c._id}>{c.clientName}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Department</label>
                    <select
                        value={filterDepartment}
                        onChange={(e) => { setFilterDepartment(e.target.value); applyFilter("department", e.target.value); }}
                        className={filterSelectClass}
                    >
                        <option value="">All Departments</option>
                        {departments.map((d) => (
                            <option key={d._id} value={d._id}>{d.departmentName}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Position</label>
                    <select
                        value={filterPosition}
                        onChange={(e) => { setFilterPosition(e.target.value); applyFilter("position", e.target.value); }}
                        className={filterSelectClass}
                    >
                        <option value="">All Positions</option>
                        {positions.map((p) => (
                            <option key={p._id} value={p._id}>{p.positionName}</option>
                        ))}
                    </select>
                </div>
                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-slate-500 hover:text-slate-800 underline pb-2.5"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Employee</th>
                            <th className="px-4 py-3 text-left">Client</th>
                            <th className="px-4 py-3 text-left">Department</th>
                            <th className="px-4 py-3 text-left">Position</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employeeDesignations.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                    No designations found.
                                </td>
                            </tr>
                        )}
                        {employeeDesignations.map((d, idx) => {
                            const emp = d.employee;
                            const empLabel = emp
                                ? `${emp.firstName} ${emp.lastName}`
                                : "—";
                            return (
                                <tr key={d._id} className="bg-white hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-400 w-10">
                                        {(currentPage - 1) * 20 + idx + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-800">{empLabel}</div>
                                        <div className="text-xs text-slate-400">{emp?.employeeCode}</div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {d.client?.clientName || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {d.department?.departmentName || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {d.position?.positionName || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setEditItem(d)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                                title="Edit"
                                            >
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(d._id, empLabel)}
                                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                title="Delete"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            {/* Add Modal */}
            <Overlay isOpen={showAdd} onClose={() => setShowAdd(false)}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Designation</h2>
                    <Form method="post" className="flex flex-col gap-4">
                        <input type="hidden" name="actionType" value="CREATE" />
                        <DesignationForm
                            clients={clients}
                            departments={departments}
                            positions={positions}
                        />
                        <div className="flex gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowAdd(false)}
                                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700"
                            >
                                Add Designation
                            </button>
                        </div>
                    </Form>
                </div>
            </Overlay>

            {/* Edit Modal */}
            <Overlay isOpen={!!editItem} onClose={() => setEditItem(null)}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Edit Designation</h2>
                    <Form method="post" className="flex flex-col gap-4">
                        <input type="hidden" name="actionType" value="UPDATE" />
                        <input type="hidden" name="id" value={editItem?._id} />
                        <DesignationForm
                            defaultValues={editItem || {}}
                            clients={clients}
                            departments={departments}
                            positions={positions}
                        />
                        <div className="flex gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setEditItem(null)}
                                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </Form>
                </div>
            </Overlay>

            {confirmModal}
        </div>
    );
};

export default EmployeeDesignations;
