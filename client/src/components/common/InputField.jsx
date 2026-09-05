import { useState } from "react";
import { TbEye } from "react-icons/tb";
import { TbEyeClosed } from "react-icons/tb";

const InputField = ({
    label,
    type = "text",
    placeholder,
    value,
    defaultValue,
    onChange,
    extra,
    name,
    required,
    autoComplete,
    autoFocus,
    disabled,
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputType =
        type === "password" ? (showPassword ? "text" : "password") : type;

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {label}
                </label>
                {extra}
            </div>
            <div className="relative">
                <input
                    type={inputType}
                    placeholder={placeholder}
                    value={value}
                    defaultValue={defaultValue}
                    onChange={onChange}
                    name={name}
                    required={required}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all duration-150 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60 ${
                        type === "password" ? "pr-10" : ""
                    }`}
                />
                {type === "password" && (
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label={
                            showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        {showPassword ? (
                            <TbEye className="h-4 w-4" />
                        ) : (
                            <TbEyeClosed className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};
export default InputField;
