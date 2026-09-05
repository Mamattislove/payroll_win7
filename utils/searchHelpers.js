export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Matches `search` against an employee's first/middle/last name individually,
// their employee code, AND the combined "First Last" name — a per-field-only
// match misses a full-name search like "Cris Paner", since neither firstName
// ("Cris") nor lastName ("Paner") alone contains that whole string.
export const employeeNameSearchOr = (search) => {
    const escaped = escapeRegex(search);
    return [
        { firstName: { $regex: escaped, $options: "i" } },
        { lastName: { $regex: escaped, $options: "i" } },
        { middleName: { $regex: escaped, $options: "i" } },
        { employeeCode: { $regex: escaped, $options: "i" } },
        {
            $expr: {
                $regexMatch: {
                    input: { $concat: ["$firstName", " ", "$lastName"] },
                    regex: escaped,
                    options: "i",
                },
            },
        },
    ];
};
