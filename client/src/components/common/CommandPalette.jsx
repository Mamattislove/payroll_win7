import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoSearchOutline } from "react-icons/io5";
import { visibleNavLinks } from "../../constants/navigation";
import { rankLinks } from "./paletteScore";

// Jump-to-page for Ctrl+K. With thirty destinations behind five sidebar groups,
// typing three letters beats scrolling a list, and it costs no screen space.
//
// Dependency-free on purpose: a palette is a filtered list and four key
// handlers, and this app ships to Chrome 109, where every added library is one
// more thing to check against that ceiling.
//
// Mounted only while open (DashboardLayout owns the flag and the shortcut), so
// the query and highlight start fresh every time instead of being reset in an
// effect after the fact.

const CommandPalette = ({ role, onClose }) => {
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const navigate = useNavigate();
    const listRef = useRef(null);

    const links = useMemo(() => visibleNavLinks(role), [role]);
    const results = useMemo(() => rankLinks(links, query), [links, query]);

    // Keep the highlighted row visible when arrowing past the edge of the list.
    useEffect(() => {
        listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const go = (link) => {
        onClose();
        navigate(link.to);
    };

    const onInputKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (results.length ? (i + 1) % results.length : 0));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) =>
                results.length ? (i - 1 + results.length) % results.length : 0,
            );
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[active]) go(results[active]);
        }
    };

    return (
        <div
            className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-[12vh] bg-black/40"
            onMouseDown={onClose}
            role="presentation"
        >
            <div
                className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Jump to page"
            >
                <div className="flex items-center gap-2 px-4 border-b border-slate-100">
                    <IoSearchOutline className="text-slate-400 shrink-0" />
                    <input
                        // Safe here in a way it usually isn't: the field only
                        // exists because the user just asked for it.
                        autoFocus
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActive(0);
                        }}
                        onKeyDown={onInputKeyDown}
                        placeholder="Jump to page…"
                        aria-label="Jump to page"
                        className="w-full py-3 text-sm outline-none placeholder:text-slate-400"
                    />
                </div>

                <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
                    {results.length === 0 && (
                        <li className="px-4 py-6 text-center text-sm text-slate-400">
                            No page matches “{query}”.
                        </li>
                    )}
                    {results.map((link, i) => {
                        const Icon = link.icon;
                        return (
                            <li key={link.to}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => go(link)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                                        i === active
                                            ? "bg-slate-100 text-slate-900"
                                            : "text-slate-600"
                                    }`}
                                >
                                    <Icon className="text-base shrink-0 text-slate-400" />
                                    <span className="flex-1 truncate">
                                        {link.label}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400">
                                        {link.group}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>

                <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">
                    <span>↑↓ to move</span>
                    <span>↵ to open</span>
                    <span>esc to close</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
