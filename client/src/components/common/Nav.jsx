import { IoMenuOutline } from "react-icons/io5";

const Nav = ({ onMenuOpen }) => {
    return (
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
            <button
                onClick={onMenuOpen}
                className="text-slate-600 hover:text-slate-900"
            >
                <IoMenuOutline className="text-2xl" />
            </button>
            <h1 className="font-semibold text-slate-800">Payroll System</h1>
        </header>
    );
};

export default Nav;
