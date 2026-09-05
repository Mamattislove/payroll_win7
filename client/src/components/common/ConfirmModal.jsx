import { useState } from "react";

const ConfirmModal = ({ isOpen, title = "Confirm Delete", message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-base font-semibold text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        No, Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
                    >
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export function useConfirm() {
    const [state, setState] = useState({ open: false, message: "", onConfirm: null });

    const askConfirm = (message, onConfirm) =>
        setState({ open: true, message, onConfirm });

    const handleConfirm = () => {
        state.onConfirm?.();
        setState({ open: false, message: "", onConfirm: null });
    };

    const handleCancel = () =>
        setState({ open: false, message: "", onConfirm: null });

    const confirmModal = (
        <ConfirmModal
            isOpen={state.open}
            message={state.message}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );

    return { confirmModal, askConfirm };
}

export default ConfirmModal;
