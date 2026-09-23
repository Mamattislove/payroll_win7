import { useEffect, useState } from "react";
import customFetch from "../../../utils/customFetch";

/**
 * Department picker for the report filters.
 *
 * The list is fetched per client, because there are a hundred departments on
 * file and any one client staffs a handful — an unfiltered picker is mostly
 * wrong answers. With no client chosen there is nothing sensible to offer, so
 * the control is disabled rather than listing everything.
 *
 * Picking a client always clears the department: the previous one almost never
 * belongs to the new client, and a stale id silently returns an empty report.
 */
const DepartmentSelect = ({ clientId, value, onChange, className }) => {
    const [loaded, setLoaded] = useState({ forClient: null, departments: [] });

    useEffect(() => {
        if (!clientId) return;
        let cancelled = false;
        customFetch
            .get(`/departments?client=${clientId}&limit=200`)
            .then(({ data }) => {
                if (!cancelled)
                    setLoaded({
                        forClient: clientId,
                        departments: data.departments || [],
                    });
            })
            .catch(() => {
                if (!cancelled)
                    setLoaded({ forClient: clientId, departments: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [clientId]);

    // Storing the list with the client it belongs to makes "still loading" and
    // "that is the previous client's list" the same derived question. The
    // effect then only fetches -- no synchronous setState in an effect body --
    // and a slow response cannot leave one client's departments on screen under
    // another client's name.
    const ready = Boolean(clientId) && loaded.forClient === clientId;
    const options = ready ? loaded.departments : [];
    const loading = Boolean(clientId) && !ready;

    return (
        <select
            value={value || ""}
            disabled={!clientId || loading}
            onChange={(e) => {
                const id = e.target.value;
                const name =
                    options.find((d) => d._id === id)?.departmentName ?? "";
                onChange(id, name);
            }}
            className={className}
        >
            <option value="">
                {!clientId
                    ? "Select a client first"
                    : loading
                      ? "Loading…"
                      : "All departments"}
            </option>
            {options.map((d) => (
                <option key={d._id} value={d._id}>
                    {d.departmentName}
                </option>
            ))}
        </select>
    );
};

export default DepartmentSelect;
