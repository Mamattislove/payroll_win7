import { useState } from "react";
import {
    redirect,
    useLoaderData,
    useSearchParams,
    useRevalidator,
    useRouteLoaderData,
} from "react-router-dom";
import { toast } from "react-toastify";
import customFetch from "../../utils/customFetch";
import { HOLIDAY_TYPES } from "../../../utils/constants";
import { canWrite } from "../../../utils/permissions";
import {
    FiChevronLeft,
    FiChevronRight,
    FiX,
    FiPlus,
    FiTrash2,
} from "react-icons/fi";
import { useConfirm } from "../components";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get("year") || new Date().getFullYear();
        const { data } = await customFetch.get(
            `/holidays?year=${year}&limit=500`,
        );
        return { holidays: data.holidays, year: Number(year) };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_STYLE = {
    [HOLIDAY_TYPES.LEGAL]: {
        badge: "bg-red-100 text-red-700",
        dot: "bg-red-400",
    },
    [HOLIDAY_TYPES.SPECIAL]: {
        badge: "bg-amber-100 text-amber-700",
        dot: "bg-amber-400",
    },
};

function toDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildCalendarCells(year, month) {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--)
        cells.push({ day: prevMonthDays - i, current: false });
    for (let d = 1; d <= daysInMonth; d++)
        cells.push({ day: d, current: true });
    let trailing = 1;
    while (cells.length % 7 !== 0)
        cells.push({ day: trailing++, current: false });
    return cells;
}

function buildHolidayMap(holidays) {
    const map = {};
    for (const h of holidays) {
        const key = new Date(h.date).toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(h);
    }
    return map;
}

const Holidays = () => {
    const { holidays } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();

    const year = Number(searchParams.get("year") || new Date().getFullYear());
    const [month, setMonth] = useState(() => new Date().getMonth());
    const [selectedKey, setSelectedKey] = useState(null);
    const [form, setForm] = useState({
        eventName: "",
        specialLegal: HOLIDAY_TYPES.LEGAL,
    });
    const [saving, setSaving] = useState(false);
    const { confirmModal, askConfirm } = useConfirm();

    // The calendar stays readable for everyone; only the roles the holiday
    // router accepts get the add form and the delete buttons.
    const mayEdit = canWrite("holidays", user?.role);

    const holidayMap = buildHolidayMap(holidays);
    const cells = buildCalendarCells(year, month);
    const dayHolidays = selectedKey ? holidayMap[selectedKey] || [] : [];

    const today = new Date();
    const todayKey = toDateKey(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );

    const prevMonth = () => {
        if (month === 0) {
            setSearchParams({ year: year - 1 });
            setMonth(11);
        } else setMonth((m) => m - 1);
    };

    const nextMonth = () => {
        if (month === 11) {
            setSearchParams({ year: year + 1 });
            setMonth(0);
        } else setMonth((m) => m + 1);
    };

    const openDay = (cell) => {
        if (!cell.current) return;
        setSelectedKey(toDateKey(year, month, cell.day));
        setForm({ eventName: "", specialLegal: HOLIDAY_TYPES.LEGAL });
    };

    const closeModal = () => setSelectedKey(null);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!form.eventName.trim()) return;
        setSaving(true);
        try {
            await customFetch.post("/holidays", {
                date: selectedKey,
                eventName: form.eventName.trim(),
                specialLegal: form.specialLegal,
            });
            toast.success("Holiday added");
            setForm({ eventName: "", specialLegal: HOLIDAY_TYPES.LEGAL });
            revalidator.revalidate();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id, name) => {
        askConfirm(`Delete holiday "${name}"?`, async () => {
            try {
                await customFetch.delete(`/holidays/${id}`);
                toast.success("Holiday deleted");
                revalidator.revalidate();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err.message);
            }
        });
    };

    return (
        <div>
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Holidays
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {holidays.length} holiday
                        {holidays.length !== 1 ? "s" : ""} in {year}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-red-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                        Legal
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-amber-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                        Special
                    </span>
                </div>
            </div>

            {/* Calendar card */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Month navigation */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                        <FiChevronLeft size={18} />
                    </button>
                    <h2 className="text-base font-semibold text-slate-800">
                        {MONTH_NAMES[month]} {year}
                    </h2>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                        <FiChevronRight size={18} />
                    </button>
                </div>

                {/* Day-of-week header row */}
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {DOW.map((d) => (
                        <div
                            key={d}
                            className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide"
                        >
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                    {cells.map((cell, idx) => {
                        const key = cell.current
                            ? toDateKey(year, month, cell.day)
                            : null;
                        const dayHols = key ? holidayMap[key] || [] : [];
                        const isToday = key === todayKey;
                        return (
                            <div
                                key={idx}
                                onClick={() => openDay(cell)}
                                className={`min-h-15 sm:min-h-22 p-1 sm:p-2 transition-colors ${
                                    cell.current
                                        ? "cursor-pointer hover:bg-slate-50"
                                        : "bg-slate-50/60 cursor-default"
                                }`}
                            >
                                <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1 ${
                                        isToday
                                            ? "bg-slate-900 text-white"
                                            : cell.current
                                              ? "text-slate-700"
                                              : "text-slate-300"
                                    }`}
                                >
                                    {cell.day}
                                </span>
                                <div className="flex flex-col gap-0.5">
                                    {dayHols.map((h) => (
                                        <span
                                            key={h._id}
                                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate leading-tight ${TYPE_STYLE[h.specialLegal]?.badge}`}
                                        >
                                            {h.eventName}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Day modal */}
            {selectedKey && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">
                                    {new Date(
                                        selectedKey + "T00:00:00",
                                    ).toLocaleDateString("en-PH", {
                                        weekday: "long",
                                    })}
                                </p>
                                <h2 className="text-base font-semibold text-slate-800">
                                    {new Date(
                                        selectedKey + "T00:00:00",
                                    ).toLocaleDateString("en-PH", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </h2>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 mt-0.5"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Existing holidays for this day */}
                        {dayHolidays.length > 0 && (
                            <div className="mb-4 flex flex-col gap-2">
                                {dayHolidays.map((h) => (
                                    <div
                                        key={h._id}
                                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50"
                                    >
                                        <div className="min-w-0">
                                            <span className="text-sm font-medium text-slate-800 truncate block">
                                                {h.eventName}
                                            </span>
                                            <span
                                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_STYLE[h.specialLegal]?.badge}`}
                                            >
                                                {h.specialLegal}
                                            </span>
                                        </div>
                                        {mayEdit && (
                                            <button
                                                onClick={() =>
                                                    handleDelete(h._id, h.eventName)
                                                }
                                                className="text-red-400 hover:text-red-600 shrink-0 transition-colors"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add holiday form */}
                        {mayEdit && (
                        <form
                            onSubmit={handleAdd}
                            className="flex flex-col gap-3"
                        >
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Event Name
                                </label>
                                <input
                                    type="text"
                                    value={form.eventName}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            eventName: e.target.value,
                                        }))
                                    }
                                    placeholder="e.g. New Year's Day"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">
                                    Type
                                </label>
                                <div className="flex gap-4">
                                    {Object.values(HOLIDAY_TYPES).map((t) => (
                                        <label
                                            key={t}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="specialLegal"
                                                value={t}
                                                checked={
                                                    form.specialLegal === t
                                                }
                                                onChange={() =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        specialLegal: t,
                                                    }))
                                                }
                                                className="accent-slate-800"
                                            />
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_STYLE[t]?.badge}`}
                                            >
                                                {t}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 mt-1">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !form.eventName.trim()}
                                    className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <FiPlus size={14} />
                                    Add Holiday
                                </button>
                            </div>
                        </form>
                        )}
                    </div>
                </div>
            )}
            {confirmModal}
        </div>
    );
};

export default Holidays;
