import { useState, useEffect } from "react";
import {
    Form,
    Link,
    redirect,
    useLoaderData,
    useSearchParams,
} from "react-router-dom";
import { toast } from "react-toastify";
import customFetch from "../../utils/customFetch";
import { Overlay, InputField, SelectField, Pagination } from "../components";
import { FiEdit2, FiEye, FiX } from "react-icons/fi";
import {
    GENDER,
    EMPLOYMENT_STATUS,
    CIVIL_STATUS,
    WHERE_DID_YOU_HEAR_ABOUT_US,
} from "../../../utils/constants";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const search = url.searchParams.get("search") || "";
        const status = url.searchParams.get("status") || "";
        const gender = url.searchParams.get("gender") || "";
        const params = new URLSearchParams({ page, search, status, gender, limit: 20 });
        const { data } = await customFetch.get(`/employees?${params}`);
        return data;
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
            await customFetch.post("/employees", fields);
            toast.success("Employee added");
        } else if (actionType === "UPDATE") {
            await customFetch.patch(`/employees/${id}`, fields);
            toast.success("Employee updated");
        }
        return { success: true };
    } catch (error) {
        toast.error(
            error?.response?.data?.msg ||
                error?.response?.data?.message ||
                error.message,
        );
        return { success: false };
    }
};

const statusBadge = (status) => {
    if (String(status).toLowerCase() === EMPLOYMENT_STATUS.ACTIVE)
        return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                {status}
            </span>
        );
    return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">
            {status}
        </span>
    );
};

const SectionLabel = ({ children }) => (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">
        {children}
    </p>
);

const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

const fmtMoney = (v) =>
    v !== undefined && v !== null
        ? `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
        : "—";

const ViewField = ({ label, value }) => (
    <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
);

const EmployeeForm = ({ actionType, item, departments, onCancel }) => (
    <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="actionType" value={actionType} />
        {item && <input type="hidden" name="id" value={item._id} />}

        <SectionLabel>Basic Information</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
            <InputField
                label="First Name"
                name="firstName"
                defaultValue={item?.firstName}
                placeholder="First name"
            />
            <InputField
                label="Last Name"
                name="lastName"
                defaultValue={item?.lastName}
                placeholder="Last name"
            />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <InputField
                label="Middle Name"
                name="middleName"
                defaultValue={item?.middleName}
                placeholder="Middle name"
            />
            <InputField
                label="Employee Code"
                name="employeeCode"
                defaultValue={item?.employeeCode}
                placeholder="EMP-001"
            />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <SelectField
                label="Gender"
                name="gender"
                options={Object.values(GENDER)}
                defaultValue={item?.gender}
            />
            <SelectField
                label="Civil Status"
                name="civilStatus"
                options={Object.values(CIVIL_STATUS)}
                defaultValue={item?.civilStatus}
            />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <InputField
                label="Birth Date"
                name="birthDate"
                type="date"
                defaultValue={
                    item?.birthDate ? item.birthDate.slice(0, 10) : ""
                }
            />
            <InputField
                label="Birth Place"
                name="birthPlace"
                defaultValue={item?.birthPlace}
                placeholder="City / Province"
            />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <SelectField
                label="Employment Status"
                name="employmentStatus"
                options={Object.values(EMPLOYMENT_STATUS)}
                defaultValue={item?.employmentStatus}
            />
            <InputField
                label="Employed Since"
                name="employedSince"
                type="date"
                defaultValue={
                    item?.employedSince ? item.employedSince.slice(0, 10) : ""
                }
            />
        </div>

        <SectionLabel>Contact</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
            <InputField
                label="Contact Number 1"
                name="contactNumber1"
                defaultValue={item?.contactNumber1}
                placeholder="09XX XXX XXXX"
            />
            <InputField
                label="Contact Number 2"
                name="contactNumber2"
                defaultValue={item?.contactNumber2}
                placeholder="Optional"
            />
        </div>
        <InputField
            label="Email"
            name="email1"
            type="email"
            defaultValue={item?.email1}
            placeholder="email@example.com"
        />
        <InputField
            label="Present Address"
            name="presentAddress"
            defaultValue={item?.presentAddress}
            placeholder="Current address"
        />
        <InputField
            label="Permanent Address"
            name="permanentAddress"
            defaultValue={item?.permanentAddress}
            placeholder="Permanent address"
        />

        <SectionLabel>Government IDs</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
            <InputField
                label="SSS Number"
                name="sssNumber"
                defaultValue={item?.sssNumber}
                placeholder="SS-XXXXXXXX-X"
            />
            <InputField
                label="PhilHealth Number"
                name="philhealthNumber"
                defaultValue={item?.philhealthNumber}
                placeholder="XX-XXXXXXXXX-X"
            />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <InputField
                label="Pag-IBIG Number"
                name="pagibigNumber"
                defaultValue={item?.pagibigNumber}
                placeholder="XXXX-XXXX-XXXX"
            />
            <InputField
                label="TIN Number"
                name="tinNumber"
                defaultValue={item?.tinNumber}
                placeholder="XXX-XXX-XXX"
            />
        </div>

        <div className="flex gap-3 mt-2">
            <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            >
                Cancel
            </button>
            <button
                type="submit"
                className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700"
            >
                {actionType === "CREATE" ? "Add Employee" : "Save Changes"}
            </button>
        </div>
    </Form>
);

const Employees = () => {
    const { employees, totalEmployees, totalPages, currentPage } =
        useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const gender = searchParams.get("gender") || "";

    const [searchInput, setSearchInput] = useState(search);

    const [viewItem, setViewItem] = useState(null);
    const [viewDesignations, setViewDesignations] = useState([]);
    const [viewLoading, setViewLoading] = useState(false);

    const openView = async (emp) => {
        setViewItem(emp);
        setViewDesignations([]);
        setViewLoading(true);
        try {
            const { data } = await customFetch.get("/employee-designations", {
                params: { employee: emp._id, limit: 50 },
            });
            const designations = data.employeeDesignations || [];
            const withComp = await Promise.all(
                designations.map(async (d) => {
                    const { data: compData } = await customFetch.get("/compensations", {
                        params: { employeeDesignation: d._id, limit: 1 },
                    });
                    return { ...d, compensation: compData.compensations?.[0] || null };
                }),
            );
            setViewDesignations(withComp);
        } catch {
            setViewDesignations([]);
        } finally {
            setViewLoading(false);
        }
    };

    const closeView = () => {
        setViewItem(null);
        setViewDesignations([]);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                if (searchInput) {
                    params.set("search", searchInput);
                } else {
                    params.delete("search");
                }
                params.set("page", "1");
                return params;
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const handleFilter = (key, value) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
            params.set("page", "1");
            return params;
        });
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearchParams({ page: "1" });
    };

    const setPage = (page) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", page);
            return params;
        });
    };

    const hasFilters = search || status || gender;

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Employees
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Total: {totalEmployees}
                    </p>
                </div>
                <Link
                    to="/dashboard/employees/add"
                    className="py-2 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    + Add Employee
                </Link>
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
                    value={status}
                    onChange={(e) => handleFilter("status", e.target.value)}
                    className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 bg-white"
                >
                    <option value="">All Status</option>
                    {Object.values(EMPLOYMENT_STATUS).map((v) => (
                        <option key={v} value={v} className="capitalize">
                            {v}
                        </option>
                    ))}
                </select>
                <select
                    value={gender}
                    onChange={(e) => handleFilter("gender", e.target.value)}
                    className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 bg-white"
                >
                    <option value="">All Gender</option>
                    {Object.values(GENDER).map((v) => (
                        <option key={v} value={v} className="capitalize">
                            {v}
                        </option>
                    ))}
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
                        <p className="px-4 py-8 text-center text-slate-400">No employees found.</p>
                    )}
                    {employees.map((emp) => (
                        <div key={emp._id} className="p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate">
                                    {emp.firstName}{emp.middleName ? ` ${emp.middleName}` : ""} {emp.lastName}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{emp.employeeCode} · <span className="capitalize">{emp.gender}</span></p>
                                <div className="mt-1.5">{statusBadge(emp.employmentStatus)}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                                <button
                                    onClick={() => openView(emp)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    title="View"
                                >
                                    <FiEye size={14} />
                                </button>
                                <Link
                                    to={`/dashboard/employees/${emp._id}/edit`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    title="Edit"
                                >
                                    <FiEdit2 size={14} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">
                                Employee Code
                            </th>
                            <th className="px-4 py-3 text-left">Full Name</th>
                            <th className="px-4 py-3 text-left">Gender</th>
                            <th className="px-4 py-3 text-left">
                                Employment Status
                            </th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employees.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-8 text-center text-slate-400"
                                >
                                    No employees found.
                                </td>
                            </tr>
                        )}
                        {employees.map((emp, idx) => (
                            <tr
                                key={emp._id}
                                className="bg-white hover:bg-slate-50"
                            >
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {emp.employeeCode}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {emp.firstName}{" "}
                                    {emp.middleName ? emp.middleName + " " : ""}
                                    {emp.lastName}
                                </td>
                                <td className="px-4 py-3 text-slate-600 capitalize">
                                    {emp.gender}
                                </td>
                                <td className="px-4 py-3">
                                    {statusBadge(emp.employmentStatus)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openView(emp)}
                                            className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                            title="View"
                                        >
                                            <FiEye size={14} />
                                        </button>
                                        <Link
                                            to={`/dashboard/employees/${emp._id}/edit`}
                                            className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={14} />
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            {/* View Modal */}
            <Overlay isOpen={!!viewItem} onClose={closeView}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">
                                {viewItem?.firstName}{" "}
                                {viewItem?.middleName ? viewItem.middleName + " " : ""}
                                {viewItem?.lastName}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">{viewItem?.employeeCode}</p>
                        </div>
                        <button onClick={closeView} className="text-slate-400 hover:text-slate-600">
                            <FiX size={18} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div>
                            <SectionLabel>Basic Information</SectionLabel>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-3">
                                <ViewField label="Gender" value={viewItem?.gender} />
                                <ViewField label="Civil Status" value={viewItem?.civilStatus} />
                                <ViewField label="Employment Status" value={viewItem?.employmentStatus} />
                                <ViewField label="Birth Date" value={fmtDate(viewItem?.birthDate)} />
                                <ViewField label="Birth Place" value={viewItem?.birthPlace} />
                                <ViewField label="Employed Since" value={fmtDate(viewItem?.employedSince)} />
                            </div>
                        </div>

                        <div>
                            <SectionLabel>Contact</SectionLabel>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-3">
                                <ViewField label="Contact Numbers" value={viewItem?.contacts?.join(", ")} />
                                <ViewField label="Emails" value={viewItem?.emails?.join(", ")} />
                                <ViewField label="Present Address" value={viewItem?.presentAddress} />
                                <ViewField label="Permanent Address" value={viewItem?.permanentAddress} />
                            </div>
                        </div>

                        <div>
                            <SectionLabel>Government IDs</SectionLabel>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-3">
                                <ViewField label="SSS Number" value={viewItem?.sssNumber} />
                                <ViewField label="PhilHealth Number" value={viewItem?.philhealthNumber} />
                                <ViewField label="Pag-IBIG Number" value={viewItem?.pagibigNumber} />
                                <ViewField label="TIN Number" value={viewItem?.tinNumber} />
                            </div>
                        </div>

                        <div>
                            <SectionLabel>Designation &amp; Compensation</SectionLabel>
                            {viewLoading ? (
                                <p className="text-sm text-slate-400 mt-3">Loading…</p>
                            ) : viewDesignations.length === 0 ? (
                                <p className="text-sm text-slate-400 mt-3">No designation on record.</p>
                            ) : (
                                <div className="flex flex-col gap-4 mt-3">
                                    {viewDesignations.map((d) => (
                                        <div key={d._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                                                <ViewField label="Client" value={d.client?.clientName} />
                                                <ViewField label="Department" value={d.department?.departmentName} />
                                                <ViewField label="Position" value={d.position?.positionName} />
                                            </div>
                                            {d.compensation ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-3 pt-3 border-t border-slate-200">
                                                    <ViewField label="Monthly Rate" value={fmtMoney(d.compensation.monthlyRate)} />
                                                    <ViewField label="Daily Rate" value={fmtMoney(d.compensation.dailyRate)} />
                                                    <ViewField label="Contract Type" value={d.compensation.contractType} />
                                                    <ViewField label="Employment Type" value={d.compensation.employmentType} />
                                                    <ViewField label="Payroll Period" value={d.compensation.payrollPeriod} />
                                                    <ViewField label="Active Status" value={d.compensation.activeStatus} />
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 mt-2">No compensation record for this designation.</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Overlay>
        </div>
    );
};
export default Employees;
