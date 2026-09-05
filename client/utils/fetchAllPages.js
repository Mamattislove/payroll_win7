import customFetch from "./customFetch";

const FETCH_PAGE_LIMIT = 1000;

// Backend list endpoints paginate with no hard cap on `limit`, so a single
// `?limit=1000` call silently truncates once a collection grows past 1000 docs.
// Loop through every page instead of guessing a "big enough" number.
export const fetchAllPages = async (path, params, dataKey) => {
    const first = await customFetch.get(path, {
        params: { ...params, page: 1, limit: FETCH_PAGE_LIMIT },
    });
    let items = first.data[dataKey] || [];
    const totalPages = first.data.totalPages || 1;

    if (totalPages > 1) {
        const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
                customFetch.get(path, {
                    params: { ...params, page: i + 2, limit: FETCH_PAGE_LIMIT },
                }),
            ),
        );
        for (const r of rest) items = items.concat(r.data[dataKey] || []);
    }
    return items;
};
