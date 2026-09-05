// Naming and ordering rules for payslips. Kept out of the PDF component so
// that file exports only components — and so the ordering can be tested
// without rendering a document.

/** "CUNANAN, ALMA B." — surname, given name, middle initial, as printed. */
export const employeeName = (emp) => {
    if (!emp) return "—";
    const initial = emp.middleName?.trim()
        ? ` ${emp.middleName.trim().charAt(0).toUpperCase()}.`
        : "";
    return `${emp.lastName ?? ""}, ${emp.firstName ?? ""}${initial}`.trim();
};

/**
 * Orders payslips alphabetically by employee, so a printed stack can be handed
 * round without being sorted by hand. Case- and accent-insensitive, so "dela
 * Cruz" files with "DELA CRUZ" rather than after every capitalised surname.
 *
 * A date range wider than one cutoff returns several payrolls per employee;
 * those stay together under the one name, oldest period first.
 *
 * Pure — copies rather than sorting in place.
 */
export const sortPayslipsByName = (payrolls = []) =>
    [...payrolls].sort((a, b) => {
        const byName = employeeName(
            a?.compensation?.employeeDesignation?.employee,
        ).localeCompare(
            employeeName(b?.compensation?.employeeDesignation?.employee),
            "en",
            { sensitivity: "base" },
        );
        if (byName !== 0) return byName;
        return String(a?.payrollFrom ?? "").localeCompare(
            String(b?.payrollFrom ?? ""),
        );
    });
