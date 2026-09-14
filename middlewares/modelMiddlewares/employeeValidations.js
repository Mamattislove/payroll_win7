import { body } from "express-validator";
import { withValidationErrors } from "../validationMiddleware.js";
import {
    CIVIL_STATUS,
    EMPLOYMENT_STATUS,
    GENDER,
    WHERE_DID_YOU_HEAR_ABOUT_US,
} from "../../utils/constants.js";
import { existingDepartment, existingEmployee } from "../existingMiddleware.js";
import Employee from "../../models/Employee.js";

// Shared optional fields used by both create and update validators
const sharedOptionalFields = [
    body("middleName").optional(),
    body("employeeCode").optional(),
    body("birthPlace").optional(),
    body("height").optional(),
    body("weight").optional(),
    body("religion").optional(),
    body("civilStatus")
        .optional()
        .isIn(Object.values(CIVIL_STATUS))
        .withMessage("invalid civil status"),
    body("employmentStatus")
        .optional()
        .isIn(Object.values(EMPLOYMENT_STATUS))
        .withMessage("invalid employment status"),
    body("contacts")
        .optional()
        .isArray()
        .withMessage("contacts must be an array"),
    body("contacts.*")
        .optional()
        .isString()
        .withMessage("contact must be a string"),
    body("emails").optional().isArray().withMessage("emails must be an array"),
    body("emails.*").optional().isEmail().withMessage("invalid email address"),
    body("presentAddress").optional(),
    body("permanentAddress").optional(),
    body("otherAddress").optional(),
    body("sssNumber").optional(),
    body("philhealthNumber").optional(),
    body("pagibigNumber").optional(),
    body("tinNumber").optional(),
    body("gsisNumber").optional(),
    body("employedSince")
        .optional()
        .isDate()
        .withMessage("employed since date is invalid"),
    body("profilePicture").optional(),
    body("department")
        .optional()
        .custom(async (departmentId) => {
            if (departmentId) await existingDepartment(departmentId);
        }),

    // families[]
    body("families")
        .optional()
        .isArray()
        .withMessage("families must be an array"),
    body("families.*.name")
        .optional()
        .isString()
        .withMessage("family member name must be a string"),
    body("families.*.relationship")
        .optional()
        .isString()
        .withMessage("family relationship must be a string"),
    body("families.*.birthDate")
        .optional()
        .isDate()
        .withMessage("family member birth date is invalid"),
    body("families.*.address").optional().isString(),
    body("families.*.occupation").optional().isString(),

    // relatives[]
    body("relatives")
        .optional()
        .isArray()
        .withMessage("relatives must be an array"),
    body("relatives.*.name").optional().isString(),
    body("relatives.*.position").optional().isString(),
    body("relatives.*.relationship").optional().isString(),

    // emergencyContact{}
    body("emergencyContact.name").optional().isString(),
    body("emergencyContact.relationship").optional().isString(),
    body("emergencyContact.contactNumber").optional().isString(),
    body("emergencyContact.address").optional().isString(),

    // educationalBackground{}
    ...["highSchool", "college", "graduateSchool", "vocational"].flatMap(
        (level) => [
            body(`educationalBackground.${level}.school`).optional().isString(),
            body(`educationalBackground.${level}.location`)
                .optional()
                .isString(),
            body(`educationalBackground.${level}.degree`).optional().isString(),
            body(`educationalBackground.${level}.from`)
                .optional()
                .isDate()
                .withMessage(`${level} from date is invalid`),
            body(`educationalBackground.${level}.to`)
                .optional()
                .isDate()
                .withMessage(`${level} to date is invalid`),
            body(`educationalBackground.${level}.honorReceived`)
                .optional()
                .isString(),
        ],
    ),
    body("educationalBackground.activities").optional().isString(),
    body("educationalBackground.hobbies").optional().isString(),
    body("educationalBackground.grade").optional().isString(),

    // profession{}
    body("profession.degree").optional().isString(),
    body("profession.profession").optional().isString(),
    body("profession.vocational").optional().isString(),
    body("profession.skills").optional().isString(),

    // medicalInformation{}
    body("medicalInformation.medicalHistory").optional().isString(),
    body("medicalInformation.hospitalizationHistory").optional().isString(),
    body("medicalInformation.allergies")
        .optional()
        .isBoolean()
        .withMessage("allergies must be a boolean"),
    body("medicalInformation.cardiovascular")
        .optional()
        .isBoolean()
        .withMessage("cardiovascular must be a boolean"),
    body("medicalInformation.gastrointestinal")
        .optional()
        .isBoolean()
        .withMessage("gastrointestinal must be a boolean"),
    body("medicalInformation.musculoskeletal")
        .optional()
        .isBoolean()
        .withMessage("musculoskeletal must be a boolean"),
    body("medicalInformation.visionHearing")
        .optional()
        .isBoolean()
        .withMessage("visionHearing must be a boolean"),

    // workingExperience[]
    body("workingExperience")
        .optional()
        .isArray()
        .withMessage("workingExperience must be an array"),
    body("workingExperience.*.company").optional().isString(),
    body("workingExperience.*.position").optional().isString(),
    body("workingExperience.*.from")
        .optional()
        .isDate()
        .withMessage("work experience from date is invalid"),
    body("workingExperience.*.to")
        .optional()
        .isDate()
        .withMessage("work experience to date is invalid"),
    body("workingExperience.*.reasonForLeaving").optional().isString(),

    // references[]
    body("references")
        .optional()
        .isArray()
        .withMessage("references must be an array"),
    body("references.*.name").optional().isString(),
    body("references.*.company").optional().isString(),
    body("references.*.occupation").optional().isString(),
    body("references.*.contactNumber").optional().isString(),
    body("references.*.relationship").optional().isString(),

    // OtherInformation{}
    body("OtherInformation.civilCriminalCase").optional().isString(),
    body("OtherInformation.desiredSalary").optional().isString(),
    body("OtherInformation.canDrive")
        .optional()
        .isBoolean()
        .withMessage("canDrive must be a boolean"),
    body("OtherInformation.driverslicenseNumber").optional().isString(),
    body("OtherInformation.whereDidYouHearAboutUs")
        .optional()
        .isIn(Object.values(WHERE_DID_YOU_HEAR_ABOUT_US))
        .withMessage("invalid whereDidYouHearAboutUs value"),
];

/**
 * Refuses a second employee with the same name as one already on file.
 *
 * The roster already carries 81 groups of employees sharing a first, middle
 * and last name, 19 of them with two or more still active, and their employee
 * codes give the game away -- F-5241 beside F--5241, T-4152 beside T-04152.
 * Those are the same person keyed twice, and every one of them is a payroll
 * that can be generated twice.
 *
 * Real namesakes do exist, so this is a stop rather than a wall: send
 * `allowDuplicateName: true` to record one deliberately. The message names the
 * existing employee's code so the difference can be checked first.
 */
const rejectDuplicateName = body("lastName").custom(async (lastName, { req }) => {
    if (req.body.allowDuplicateName === true) return true;

    // Case- and whitespace-insensitive: "dela cruz" and "DELA CRUZ " are the
    // same person, and anchored so it matches the whole name, not part of it.
    const exact = (value) => {
        const trimmed = String(value ?? "").trim();
        if (!trimmed) return null;
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return { $regex: `^\\s*${escaped}\\s*$`, $options: "i" };
    };

    const filter = {
        firstName: exact(req.body.firstName),
        lastName: exact(lastName),
    };
    if (!filter.firstName || !filter.lastName) return true;

    // A blank middle name has to match blank, missing, or whitespace, or a
    // record saved without one would never be recognised as the same person.
    const middle = exact(req.body.middleName);
    filter.middleName = middle ?? { $in: [null, ""] };

    const existing = await Employee.findOne(filter).select(
        "employeeCode employmentStatus",
    );
    if (!existing) return true;

    const code = existing.employeeCode
        ? ` (employee code ${existing.employeeCode})`
        : "";
    throw new Error(
        `an employee named ${req.body.firstName} ${req.body.lastName} already exists${code}. ` +
            "Check that this is not the same person; to record a different person with the same name, confirm the duplicate.",
    );
});

export const validateEmployeeInput = withValidationErrors([
    body("firstName").notEmpty().withMessage("first name is required"),
    body("lastName").notEmpty().withMessage("last name is required"),
    body("gender").isIn(Object.values(GENDER)).withMessage("invalid gender"),
    body("birthDate").isDate().withMessage("birth date is invalid"),
    rejectDuplicateName,
    ...sharedOptionalFields,
]);

export const validateEmployeeParamid = async (req, res, next) => {
    const { employeeId } = req.params;
    const employee = await existingEmployee(employeeId);
    req.employee = employee;
    next();
};

export const validateEmployeeUpdateInput = withValidationErrors([
    body("firstName")
        .optional()
        .notEmpty()
        .withMessage("first name is required"),
    body("lastName").optional().notEmpty().withMessage("last name is required"),
    body("gender")
        .optional()
        .isIn(Object.values(GENDER))
        .withMessage("invalid gender"),
    body("birthDate").optional().isDate().withMessage("birth date is invalid"),
    ...sharedOptionalFields,
]);
