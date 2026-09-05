const Overlay = ({ isOpen = false, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div
            className="fixed inset-0 bg-black/35 z-40 flex items-start sm:items-center justify-center overflow-y-auto p-4"
            onClick={onClose}
        >
            <div className="w-full flex justify-center my-auto" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};
export default Overlay;
