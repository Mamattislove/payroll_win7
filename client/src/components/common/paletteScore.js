/**
 * Scores a nav link against what has been typed in the command palette.
 * Returns -1 for no match; higher is a better match.
 *
 * The tiers matter more than the numbers. An exact prefix on the label beats a
 * hit in the middle, which beats a match on the group name, which beats a
 * scattered subsequence — so "pay" offers Payroll and Payslips before Bulk Add
 * Attendance, which only qualifies because p-a-y appear in it in order.
 *
 * Within a tier, shorter labels win: typing "pay" should reach Payroll before
 * Payroll Journal, since the shorter one is more likely what so few letters
 * meant.
 */
export const scoreLink = (link, query) => {
    if (!query) return 0;
    const q = query.toLowerCase();
    const label = link.label.toLowerCase();
    const group = (link.group || "").toLowerCase();

    if (label.startsWith(q)) return 1000 - label.length;

    const at = label.indexOf(q);
    if (at > -1) return 800 - at * 10 - label.length;

    // Group name, so "settings" surfaces everything filed under Settings and
    // "admin" reaches Users and Audit Log without knowing what they're called.
    if (group.startsWith(q)) return 500 - label.length;
    if (group.includes(q)) return 400 - label.length;

    // Subsequence, the last resort: "bat" -> Bulk Add Attendance. Ranked by how
    // tightly the letters cluster, so an accidental spread-out match sinks.
    let matched = 0;
    let span = 0;
    let started = -1;
    for (let c = 0; c < label.length && matched < q.length; c++) {
        if (label[c] === q[matched]) {
            if (started < 0) started = c;
            matched++;
            span = c - started;
        }
    }
    if (matched === q.length) return 200 - span;

    return -1;
};

/** Best matches first, capped so the list stays scannable. */
export const rankLinks = (links, query, limit = 8) =>
    links
        .map((link) => ({ link, score: scoreLink(link, query) }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => r.link);
