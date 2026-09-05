// Helpers for Compensation.weeklySchedule — an array of day names drawn from
// the DAYS enum. Shared by the server and the client (aliased as @shared).
//
// Rest days are not stored: they are whatever falls outside the weekly
// schedule, so there is only one source of truth to keep correct.

import { DAYS } from "./constants.js";

// DAYS is declared Monday-first, which is how a work week reads in payroll.
// Use that ordering rather than a JS Date weekday index, which starts Sunday.
export const DAY_ORDER = Object.values(DAYS);

const short = (day) => day.slice(0, 3);

/** Puts an arbitrary set of day names back into canonical week order. */
export const sortDays = (days = []) => DAY_ORDER.filter((d) => days.includes(d));

/** The days an employee does not work. */
export const restDaysFrom = (weeklySchedule = []) =>
    DAY_ORDER.filter((d) => !weeklySchedule.includes(d));

/**
 * Renders a day set compactly. Runs of three or more collapse to "Mon – Fri";
 * anything shorter lists out as "Mon, Wed". Returns "" when empty so callers
 * can supply their own placeholder.
 */
export const formatDays = (days = []) => {
    const ordered = sortDays(Array.isArray(days) ? days : []);
    if (ordered.length === 0) return "";
    if (ordered.length === DAY_ORDER.length) return "Every day";

    const runs = [];
    for (const day of ordered) {
        const previous = runs.at(-1);
        const isConsecutive =
            previous &&
            DAY_ORDER.indexOf(previous.at(-1)) === DAY_ORDER.indexOf(day) - 1;
        if (isConsecutive) previous.push(day);
        else runs.push([day]);
    }

    return runs
        .map((run) =>
            run.length >= 3
                ? `${short(run[0])} – ${short(run.at(-1))}`
                : run.map(short).join(", "),
        )
        .join(", ");
};

/** Formats the rest days, blank when no schedule has been set at all. */
export const formatRestDays = (weeklySchedule) => {
    const schedule = Array.isArray(weeklySchedule) ? weeklySchedule : [];
    if (schedule.length === 0) return "";
    return formatDays(restDaysFrom(schedule));
};

const findDay = (token) => {
    const t = String(token).trim().toLowerCase();
    // Two letters is too ambiguous to resolve ("s" could be Sat or Sun).
    if (t.length < 3) return null;
    return (
        DAY_ORDER.find((d) => {
            const day = d.toLowerCase();
            return day === t || day.startsWith(t) || t.startsWith(day.slice(0, 3));
        }) ?? null
    );
};

/**
 * Coerces whatever is stored today into a valid array of day names. Copes with
 * the free-text values the old input allowed — "Mon – Fri", "Monday to Friday",
 * "Mon, Wed, Fri" — as well as values that are already arrays.
 */
export const normalizeWeeklySchedule = (value) => {
    if (Array.isArray(value)) {
        const valid = sortDays(value.filter((d) => DAY_ORDER.includes(d)));
        if (valid.length || value.length === 0) return valid;
        // Free text cast by Mongoose lands as one junk element, e.g.
        // ["Mon – Fri"]. Fall through to the string parser for those.
        return normalizeWeeklySchedule(value.join(", "));
    }
    if (typeof value !== "string" || !value.trim()) return [];

    const found = new Set();
    for (const chunk of value.split(/[,/|]|\band\b/i)) {
        const bounds = chunk.split(/[-–—]|\bto\b/i);
        if (bounds.length === 2) {
            const from = findDay(bounds[0]);
            const to = findDay(bounds[1]);
            if (from && to) {
                const start = DAY_ORDER.indexOf(from);
                const span = (DAY_ORDER.indexOf(to) - start + 7) % 7;
                for (let i = 0; i <= span; i++) {
                    found.add(DAY_ORDER[(start + i) % 7]);
                }
                continue;
            }
        }
        const single = findDay(chunk);
        if (single) found.add(single);
    }
    return sortDays([...found]);
};
