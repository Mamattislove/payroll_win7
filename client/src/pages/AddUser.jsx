import { Form, Link, redirect } from "react-router-dom";
import { Card, InputField, SelectField } from "../components";
import { USER_ROLES } from "../../../utils/constants";
import { toast } from "react-toastify";
import customFetch from "../../utils/customFetch";

export const action = async ({ request }) => {
    try {
        const formData = await request.formData();
        const data = Object.fromEntries(formData);
        await customFetch.post("/users", data);
        toast.success("User created successfully!");
        return redirect("/moderator");
    } catch (error) {
        toast.error(error?.response?.data?.msg || "Failed to create user.");
        return error;
    }
};
const AddUser = () => {
    const selectedRole = Object.values(roles).filter(
        (r) => r !== roles.ADMIN && r !== roles.USER,
    );
    return (
        <div className="flex flex-col items-center py-10">
            <div className="w-11/12 sm:w-96 mb-4">
                <Link
                    to="/moderator"
                    className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    &larr; Back
                </Link>
            </div>
            <Card>
                <h1 className="mb-5 text-center text-2xl font-semibold">
                    Add User
                </h1>
                <Form className="flex flex-col gap-5" method="post">
                    <InputField
                        label="Username"
                        type="text"
                        placeholder="Enter your username"
                        name="userName"
                    />
                    <InputField
                        label="First Name"
                        type="text"
                        placeholder="Enter your First Name"
                        name="firstName"
                    />
                    <InputField
                        label="Last Name"
                        type="text"
                        placeholder="Enter your Last Name"
                        name="lastName"
                    />
                    <InputField
                        label="Password"
                        type="password"
                        placeholder="Enter your password"
                        name="password"
                    />
                    <InputField
                        label="Confirm Password"
                        type="password"
                        placeholder="Enter your Confirm password"
                        name="confirmPassword"
                    />
                    <SelectField
                        label="Select Role"
                        options={selectedRole}
                        name="role"
                    />
                    <button
                        type="submit"
                        className="mt-2 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-700 active:scale-[0.98]"
                    >
                        Submit
                    </button>
                </Form>
            </Card>
        </div>
    );
};
export default AddUser;
