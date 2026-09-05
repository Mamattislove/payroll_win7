import { useState, useEffect } from "react";
import { Form, redirect, useLoaderData, useActionData, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FiEdit2 } from "react-icons/fi";
import customFetch from "../../utils/customFetch";
import { Overlay, InputField, Pagination } from "../components";

export const loader = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") || 1;
        const { data } = await customFetch.get(`/positions?page=${page}&limit=20`);
        return data;
    } catch (error) {
        if (error?.response?.status === 401) return redirect("/login");
        throw error;
    }
};

export const action = async ({ request }) => {
    try {
        const formData = await request.formData();
        const data = Object.fromEntries(formData);
        const { actionType, id, ...fields } = data;

        if (actionType === "CREATE") {
            await customFetch.post("/positions", fields);
            toast.success("Position added");
        } else if (actionType === "UPDATE") {
            await customFetch.patch(`/positions/${id}`, fields);
            toast.success("Position updated");
        }
        return { success: true };
    } catch (error) {
        toast.error(
            error?.response?.data?.msg ||
            error?.response?.data?.message ||
            error.message
        );
        return { success: false };
    }
};

const Positions = () => {
    const { positions, totalPositions, totalPages, currentPage } = useLoaderData();
    const actionData = useActionData();
    const [searchParams, setSearchParams] = useSearchParams();

    const [showAdd, setShowAdd] = useState(false);
    const [editItem, setEditItem] = useState(null);

    useEffect(() => {
        if (actionData?.success) {
            setShowAdd(false);
            setEditItem(null);
        }
    }, [actionData]);

    const setPage = (page) => {
        setSearchParams({ page });
    };

    return (
        <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Positions</h1>
                    <p className="text-slate-500 mt-1">Total: {totalPositions}</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="py-2 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    + Add Position
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Position Name</th>
                            <th className="px-4 py-3 text-left">Description</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {positions.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                    No positions found.
                                </td>
                            </tr>
                        )}
                        {positions.map((pos, idx) => (
                            <tr key={pos._id} className="bg-white hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">{pos.positionName}</td>
                                <td className="px-4 py-3 text-slate-600">{pos.positionDesc}</td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => setEditItem(pos)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                        title="Edit"
                                    >
                                        <FiEdit2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            {/* Add Modal */}
            <Overlay isOpen={showAdd} onClose={() => setShowAdd(false)}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Position</h2>
                    <Form method="post" className="flex flex-col gap-4">
                        <input type="hidden" name="actionType" value="CREATE" />
                        <InputField label="Position Name" name="positionName" placeholder="e.g. Software Engineer" />
                        <InputField label="Description" name="positionDesc" placeholder="Brief description" />
                        <div className="flex gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowAdd(false)}
                                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700"
                            >
                                Add Position
                            </button>
                        </div>
                    </Form>
                </div>
            </Overlay>

            {/* Edit Modal */}
            <Overlay isOpen={!!editItem} onClose={() => setEditItem(null)}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Edit Position</h2>
                    <Form method="post" className="flex flex-col gap-4">
                        <input type="hidden" name="actionType" value="UPDATE" />
                        <input type="hidden" name="id" value={editItem?._id} />
                        <InputField
                            label="Position Name"
                            name="positionName"
                            defaultValue={editItem?.positionName}
                            placeholder="e.g. Software Engineer"
                        />
                        <InputField
                            label="Description"
                            name="positionDesc"
                            defaultValue={editItem?.positionDesc}
                            placeholder="Brief description"
                        />
                        <div className="flex gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setEditItem(null)}
                                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </Form>
                </div>
            </Overlay>
        </div>
    );
};
export default Positions;
