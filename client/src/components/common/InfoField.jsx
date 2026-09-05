const InfoField = ({ label, value }) => {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {label}
                </label>
            </div>
            <div className="text-slate-900">{value}</div>
        </div>
    );
};
export default InfoField;
