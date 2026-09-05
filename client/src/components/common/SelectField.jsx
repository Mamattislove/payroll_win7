const SelectField = ({ label = "data", options = [], name, defaultValue }) => {
    const selectClass =
        "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all duration-150 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 capitalize";
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {label.toLocaleUpperCase()}
            </label>
            <select
                name={name}
                defaultValue={defaultValue || ""}
                className={selectClass}
            >
                <option value="" disabled>
                    {`Select ${label}`}
                </option>
                {options.map((option) => (
                    <option key={option} value={option} className="capitalize">
                        {option}
                    </option>
                ))}
            </select>
        </div>
    );
};
export default SelectField;
