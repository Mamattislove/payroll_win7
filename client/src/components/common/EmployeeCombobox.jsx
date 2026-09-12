import { useState, useEffect, useRef } from "react";
import customFetch from "../../../utils/customFetch";
import { EMPLOYMENT_STATUS } from "@shared/constants";

const inputCls =
    "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 w-full";

/**
 * Searches employees server-side (`/employees?search=`) instead of filtering a
 * preloaded list — with 2000+ employees, loading them all up front made the
 * page that used it slow.
 *
 * Shared by the loan pages: the list filters by employee and the form picks
 * one. (Payroll.jsx has its own variant that filters by client and selects a
 * compensation rather than an employee; the two are not interchangeable.)
 *
 * @param {string} value - selected employee id
 * @param {Function} onChange - called with the new employee id, or "" on clear
 * @param {boolean} disabled - render a read-only box showing initialEmployee
 * @param {object} initialEmployee - populated employee, for the disabled case
 */
const EmployeeCombobox = ({ value, onChange, disabled, initialEmployee }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const containerRef = useRef(null);
    const empName = (e) =>
        `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "—";

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

    if (disabled)
        return (
            <input
                type="text"
                value={empName(initialEmployee)}
                disabled
                className={`${inputCls} bg-slate-100 text-slate-400 cursor-not-allowed`}
            />
        );

    const displayValue = open ? query : selected ? empName(selected) : "";
    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search employee…"
                    className={`${inputCls} pr-8`}
                    autoComplete="off"
                />
                {selected && !open && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Clear"
                    >
                        ×
                    </button>
                )}
            </div>
            {open && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loading ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">Searching…</p>
                    ) : results.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">
                            No employees found.
                        </p>
                    ) : (
                        results.map((e) => (
                            <button
                                key={e._id}
                                type="button"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => handleSelect(e)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 ${
                                    value === e._id ? "bg-slate-50 font-semibold" : ""
                                }`}
                            >
                                <span className="text-slate-800 truncate">{empName(e)}</span>
                                {e.employeeCode && (
                                    <span className="text-slate-400 text-xs shrink-0">
                                        {e.employeeCode}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
export default EmployeeCombobox;
