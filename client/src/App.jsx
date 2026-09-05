import {
    createBrowserRouter,
    redirect,
    RouterProvider,
} from "react-router-dom";
import HomeLayout from "./pages/HomeLayout";
import Login, { action as loginAction } from "./pages/Login";
import DashboardLayout, {
    loader as dashboardLayoutLoader,
} from "./pages/DashboardLayout";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "./pages/NotFound";

// Every dashboard page used to be statically imported into one ~2.2MB bundle,
// so opening the login page downloaded the code for every other page too.
// `lazy` makes each route fetch its own chunk on first visit instead.
const page = (importer) => () =>
    importer().then((m) => ({ Component: m.default, loader: m.loader }));
const pageWithAction = (importer) => () =>
    importer().then((m) => ({
        Component: m.default,
        loader: m.loader,
        action: m.action,
    }));

const router = createBrowserRouter([
    {
        path: "/",
        element: <HomeLayout />,
        // Without this the router falls back to its own error screen, which
        // shows a stack trace and nothing a clerk can act on.
        errorElement: <ErrorPage />,
        children: [
            {
                index: true,
                loader: () => redirect("/login"),
            },
            { path: "login", element: <Login />, action: loginAction },
            { path: "*", element: <NotFound /> },
        ],
    },
    {
        id: "dashboard",
        path: "/dashboard",
        element: <DashboardLayout />,
        loader: dashboardLayoutLoader,
        // /dashboard is a sibling of "/", not a child, so it needs its own
        // boundary -- a page loader that throws would otherwise land on the
        // router's default screen.
        errorElement: <ErrorPage />,
        children: [
            { index: true, lazy: page(() => import("./pages/Dashboard")) },
            {
                path: "departments",
                lazy: pageWithAction(() => import("./pages/Departments")),
            },
            {
                path: "positions",
                lazy: pageWithAction(() => import("./pages/Positions")),
            },
            {
                path: "holidays",
                lazy: page(() => import("./pages/Holidays")),
            },
            {
                path: "clients",
                lazy: pageWithAction(() => import("./pages/Clients")),
            },
            {
                path: "employees",
                lazy: pageWithAction(() => import("./pages/Employees")),
            },
            {
                path: "employees/add",
                lazy: pageWithAction(() => import("./pages/AddEmployee")),
            },
            {
                path: "employees/:id/edit",
                lazy: pageWithAction(() => import("./pages/EditEmployee")),
            },
            {
                path: "attendance",
                lazy: page(() => import("./pages/Attendance")),
            },
            {
                path: "attendance/bulk",
                lazy: page(() => import("./pages/BulkAttendance")),
            },
            {
                path: "payslips",
                lazy: page(() => import("./pages/Payslips")),
            },
            {
                path: "payroll",
                lazy: page(() => import("./pages/Payroll")),
            },
            {
                path: "payroll/:id/edit",
                lazy: page(() => import("./pages/EditPayroll")),
            },
            {
                path: "compensation",
                lazy: page(() => import("./pages/Compensation")),
            },
            {
                path: "leave",
                lazy: pageWithAction(() => import("./pages/Leave")),
            },
            {
                path: "loans",
                lazy: page(() => import("./pages/Loans")),
            },
            {
                path: "savings",
                lazy: page(() => import("./pages/Savings")),
            },
            {
                path: "deductions",
                lazy: page(() => import("./pages/Deductions")),
            },
            {
                path: "earnings",
                lazy: page(() => import("./pages/Earnings")),
            },
            {
                path: "allowances",
                lazy: page(() => import("./pages/Allowances")),
            },
            {
                path: "charges",
                lazy: page(() => import("./pages/Charges")),
            },
            {
                path: "settings",
                lazy: page(() => import("./pages/Settings")),
            },
            {
                path: "earning-types",
                lazy: page(() => import("./pages/EarningTypes")),
            },
            {
                path: "allowance-types",
                lazy: page(() => import("./pages/AllowanceTypes")),
            },
            {
                path: "deduction-types",
                lazy: page(() => import("./pages/DeductionTypes")),
            },
            {
                path: "charge-types",
                lazy: page(() => import("./pages/ChargeTypes")),
            },
            {
                path: "loan-types",
                lazy: page(() => import("./pages/LoanTypes")),
            },
            {
                path: "employee-designations",
                lazy: pageWithAction(() => import("./pages/EmployeeDesignations")),
            },
            {
                path: "billing-report",
                lazy: page(() => import("./pages/BillingReport")),
            },
            {
                path: "payroll-journal",
                lazy: page(() => import("./pages/PayrollJournal")),
            },
            {
                path: "net-pay-report",
                lazy: page(() => import("./pages/NetPayReport")),
            },
            {
                path: "users",
                lazy: page(() => import("./pages/Users")),
            },
            {
                path: "audit-logs",
                lazy: page(() => import("./pages/AuditLogs")),
            },
            // Matched last, so a mistyped dashboard address renders inside the
            // layout with the sidebar still there rather than as a dead end.
            { path: "*", element: <NotFound inDashboard /> },
        ],
    },
]);

const App = () => {
    return <RouterProvider router={router} />;
};
export default App;
