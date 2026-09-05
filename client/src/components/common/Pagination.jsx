import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > 3) pages.push("...");
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push("...");
        pages.push(totalPages);
    }

    const base = "w-9 h-9 rounded-lg text-sm font-medium transition-colors flex items-center justify-center";
    const inactive = `${base} bg-white border border-slate-200 text-slate-600 hover:bg-slate-50`;
    const active = `${base} bg-slate-900 text-white`;

    return (
        <div className="mt-4 flex gap-1.5 justify-center items-center">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`${inactive} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
                <FiChevronLeft size={14} />
            </button>
            {pages.map((page, i) =>
                page === "..." ? (
                    <span key={`e${i}`} className="w-9 text-center text-slate-400 text-sm select-none">
                        …
                    </span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={page === currentPage ? active : inactive}
                    >
                        {page}
                    </button>
                ),
            )}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`${inactive} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
                <FiChevronRight size={14} />
            </button>
        </div>
    );
};

export default Pagination;
