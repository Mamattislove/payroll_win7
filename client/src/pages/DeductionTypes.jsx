import { useState } from "react";
import {
    redirect,
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
} from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { canWrite } from "../../../utils/permissions";
import { useConfirm } from "../components";

export const loader = async () => {
    try {
        const { data } = await customFetch.get("/deduction-types?limit=1000");
        return { deductionTypes: data.deductionTypes || [] };
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 bg-slate-50";

const DeductionTypes = () => {
    const { deductionTypes } = useLoaderData();
    const { user } = useRouteLoaderData("dashboard");
    const revalidator = useRevalidator();
    const { confirmModal, askConfirm } = useConfirm();

    // The list is readable by anyone signed in; only some roles may change it.
    // Offering the controls to the rest just trades a hidden button for a
    // rejected request and a toast nobody can act on.
    const mayEdit = canWrite("deductionTypes", user?.role);

    const [editItem, setEditItem] = useState(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ deductionName: "", deductionDesc: "" });
    const [saving, setSaving] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const startAdd = () => {
        setForm({ deductionName: "", deductionDesc: "" });
        setEditItem(null);
        setAdding(true);
    };

    const startEdit = (item) => {
        setForm({ deductionName: item.deductionName, deductionDesc: item.deductionDesc || "" });
        setEditItem(item);
        setAdding(false);
    };

    const cancel = () => { setAdding(false); setEditItem(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = { deductionName: form.deductionName };
            if (form.deductionDesc) body.deductionDesc = form.deductionDesc;
            if (editItem) {
                await customFetch.patch(`/deduction-types/${editItem._id}`, body);
                toast.success("Deduction type updated");
            } else {
                await customFetch.post("/deduction-types", body);
                toast.success("Deduction type added");
            }
            cancel();
            revalidator.revalidate();
        } catch (err) {
            toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (item) => {
        askConfirm(`Delete "${item.deductionName}"?`, async () => {
            try {
                await customFetch.delete(`/deduction-types/${item._id}`);
                toast.success("Deduction type deleted");
                revalidator.revalidate();
            } catch (err) {
                toast.error(err?.response?.data?.msg || err?.response?.data?.message || err.message);
            }
        });
    };

    const isFormOpen = adding || !!editItem;

    return (
        <div>
            {confirmModal}

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Deduction Types</h1>
                    <p className="text-slate-500 mt-1">Total: {deductionTypes.length}</p>
                </div>
                {mayEdit && (
                    <button
                        onClick={startAdd}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <FiPlus size={14} />
                        Add Type
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-left">Description</th>
                            {mayEdit && (
                                <th className="px-4 py-3 text-center">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {deductionTypes.length === 0 && (
                            <tr>
                                <td colSpan={mayEdit ? 4 : 3} className="px-4 py-8 text-center text-slate-400">
                                    No deduction types yet.
                                </td>
                            </tr>
                        )}
                        {deductionTypes.map((item, idx) => (
                            <tr key={item._id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">{item.deductionName}</td>
                                <td className="px-4 py-3 text-slate-500">{item.deductionDesc || "—"}</td>
                                {mayEdit && (
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => startEdit(item)} className="text-blue-500 hover:text-blue-700" title="Edit">
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(item)} className="text-red-400 hover:text-red-600" title="Delete">
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-base font-semibold text-slate-800">
                                {editItem ? "Edit Deduction Type" : "Add Deduction Type"}
                            </h2>
                            <button onClick={cancel} className="text-slate-400 hover:text-slate-600">
                                <FiX size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Name *</label>
                                <input value={form.deductionName} onChange={set("deductionName")} required placeholder="e.g. SSS Loan" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Description</label>
                                <input value={form.deductionDesc} onChange={set("deductionDesc")} placeholder="Optional" className={inputCls} />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={cancel} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 disabled:opacity-60">
                                    {saving ? "Saving…" : editItem ? "Update" : "Add"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeductionTypes;
