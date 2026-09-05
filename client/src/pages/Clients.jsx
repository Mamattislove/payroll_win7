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
        const { data } = await customFetch.get(`/clients?page=${page}&limit=20`);
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
            await customFetch.post("/clients", fields);
            toast.success("Client added");
        } else if (actionType === "UPDATE") {
            await customFetch.patch(`/clients/${id}`, fields);
            toast.success("Client updated");
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

const Clients = () => {
    const { clients, totalClients, totalPages, currentPage } = useLoaderData();
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
                    <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
                    <p className="text-slate-500 mt-1">Total: {totalClients}</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="py-2 px-4 text-sm text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    + Add Client
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Client Name</th>
                            <th className="px-4 py-3 text-left">Address</th>
                            <th className="px-4 py-3 text-left">Contact Person</th>
                            <th className="px-4 py-3 text-left">Contact Number</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {clients.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                    No clients found.
                                </td>
                            </tr>
                        )}
                        {clients.map((client, idx) => (
                            <tr key={client._id} className="bg-white hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-500">
                                    {(currentPage - 1) * 20 + idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">{client.clientName}</td>
                                <td className="px-4 py-3 text-slate-600">{client.clientAddress}</td>
                                <td className="px-4 py-3 text-slate-600">{client.contactPerson}</td>
                                <td className="px-4 py-3 text-slate-600">{client.contactPersonNumber}</td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => setEditItem(client)}
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
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Client</h2>
                    <Form method="post" className="flex flex-col gap-4">
                        <input type="hidden" name="actionType" value="CREATE" />
                        <InputField label="Client Name" name="clientName" placeholder="Company name" />
                        <InputField label="Address" name="clientAddress" placeholder="Company address" />
                        <InputField label="Contact Person" name="contactPerson" placeholder="Full name" />
                        <InputField label="Contact Number" name="contactPersonNumber" placeholder="Phone number" />
                        <InputField label="Contact Email" name="contactPersonEmail" type="email" placeholder="email@example.com" />
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
                                Add Client
                            </button>
                        </div>
                    </Form>
                </div>
            </Overlay>

            {/* Edit Modal */}
            <Overlay isOpen={!!editItem} onClose={() => setEditItem(null)}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Edit Client</h2>
                    <Form method="post" className="flex flex-col gap-4">
                        <input type="hidden" name="actionType" value="UPDATE" />
                        <input type="hidden" name="id" value={editItem?._id} />
                        <InputField label="Client Name" name="clientName" defaultValue={editItem?.clientName} placeholder="Company name" />
                        <InputField label="Address" name="clientAddress" defaultValue={editItem?.clientAddress} placeholder="Company address" />
                        <InputField label="Contact Person" name="contactPerson" defaultValue={editItem?.contactPerson} placeholder="Full name" />
                        <InputField label="Contact Number" name="contactPersonNumber" defaultValue={editItem?.contactPersonNumber} placeholder="Phone number" />
                        <InputField label="Contact Email" name="contactPersonEmail" type="email" defaultValue={editItem?.contactPersonEmail} placeholder="email@example.com" />
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
export default Clients;
