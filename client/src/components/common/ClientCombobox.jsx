import { useState, useRef, useEffect } from "react";
import { FiX } from "react-icons/fi";

const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 pr-8";

const ClientCombobox = ({ clients, value, onChange }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const selected = clients.find((c) => c._id === value);

    const filtered =
        query.trim() === ""
            ? clients
            : clients.filter((c) =>
                  c.clientName.toLowerCase().includes(query.toLowerCase()),
              );

    const handleSelect = (c) => { onChange(c._id); setQuery(""); setOpen(false); };
    const handleClear  = () => { onChange(""); setQuery(""); };

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

    const displayValue = open ? query : (selected ? selected.clientName : "");

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search client…"
                    className={inputCls}
                    autoComplete="off"
                />
                {selected && !open && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Clear"
                    >
                        <FiX size={14} />
                    </button>
                )}
            </div>
            {open && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-slate-400">No clients found.</p>
                    ) : (
                        filtered.map((c) => (
                            <button
                                key={c._id}
                                type="button"
                                onMouseDown={() => handleSelect(c)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                    value === c._id ? "bg-slate-100 font-semibold" : ""
                                }`}
                            >
                                {c.clientName}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientCombobox;
