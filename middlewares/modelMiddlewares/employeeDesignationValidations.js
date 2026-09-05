import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    existingEmployeeDesignation,
    existingEmployee,
    existingClient,
    existingDepartment,
    existingPosition,
} from "../existingMiddleware.js";
import EmployeeDesignation from "../../models/EmployeeDesignation.js";

export const validateEmployeeDesignationInput = withValidationErrors([
    body("employee")
        .notEmpty()
        .withMessage("employee is required")
        .custom(async (employeeId) => {
            await existingEmployee(employeeId);
        }),
    body("client")
        .notEmpty()
        .withMessage("client is required")
        .custom(async (clientId) => {
            await existingClient(clientId);
        }),
    body("department")
        .notEmpty()
        .withMessage("department is required")
        .custom(async (departmentId) => {
            await existingDepartment(departmentId);
        }),
    body("position")
        .notEmpty()
        .withMessage("position is required")
        .custom(async (positionId, { req }) => {
            await existingPosition(positionId);
            const duplicate = await EmployeeDesignation.findOne({
                employee: req.body.employee,
                client: req.body.client,
                department: req.body.department,
                position: positionId,
            });
            if (duplicate)
                throw new Error(
                    "this employee already has a designation for this client, department, and position",
                );
        }),
]);

export const validateEmployeeDesignationUpdateInput = withValidationErrors([
    body("employee")
        .optional()
        .custom(async (employeeId) => {
            await existingEmployee(employeeId);
        }),
    body("client")
        .optional()
        .custom(async (clientId) => {
            await existingClient(clientId);
        }),
    body("department")
        .optional()
        .custom(async (departmentId) => {
            await existingDepartment(departmentId);
        }),
    body("position")
        .optional()
        .custom(async (positionId, { req }) => {
            await existingPosition(positionId);
            const employeeId = req.body.employee ?? req.employeeDesignation.employee._id ?? req.employeeDesignation.employee;
            const clientId = req.body.client ?? req.employeeDesignation.client._id ?? req.employeeDesignation.client;
            const departmentId = req.body.department ?? req.employeeDesignation.department._id ?? req.employeeDesignation.department;
            const conflict = await EmployeeDesignation.findOne({
                employee: employeeId,
                client: clientId,
                department: departmentId,
                position: positionId,
                _id: { $ne: req.employeeDesignation._id },
            });
            if (conflict)
                throw new Error(
                    "this employee already has a designation for this client, department, and position",
                );
        }),
]);

export const validateEmployeeDesignationParamId = async (req, res, next) => {
    const { employeeDesignationId } = req.params;
    const employeeDesignation = await existingEmployeeDesignation(employeeDesignationId);
    req.employeeDesignation = employeeDesignation;
    next();
};
