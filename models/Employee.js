import mongoose from "mongoose";
import {
    CIVIL_STATUS,
    EMPLOYMENT_STATUS,
    GENDER,
    WHERE_DID_YOU_HEAR_ABOUT_US,
} from "../utils/constants.js";

const employeeSchema = new mongoose.Schema(
    {
        employeeCode: { type: String, index: true },
        firstName: { type: String, required: true },
        middleName: { type: String },
        lastName: { type: String, required: true },
        contacts: [
            {
                type: String,
            },
        ],
        emails: [
            {
                type: String,
            },
        ],
        presentAddress: String,
        permanentAddress: String,
        otherAddress: String,
        profilePic: String,
        birthDate: { type: Date, required: true },
        birthPlace: { type: String },
        height: String,
        weight: String,
        civilStatus: { type: String, enum: Object.values(CIVIL_STATUS) },
        religion: String,

        families: [
            {
                name: String,
                relationship: String,
                birthDate: Date,
                address: String,
                occupation: String,
            },
        ],
        relatives: [
            {
                name: String,
                position: String,
                relationship: String,
            },
        ],
        emergencyContact: {
            name: String,
            relationship: String,
            contactNumber: String,
            address: String,
        },
        educationalBackground: {
            highSchool: {
                school: String,
                location: String,
                degree: String,
                from: Date,
                to: Date,
                honorReceived: String,
            },
            college: {
                school: String,
                location: String,
                degree: String,
                from: Date,
                to: Date,
                honorReceived: String,
            },
            graduateSchool: {
                school: String,
                location: String,
                degree: String,
                from: Date,
                to: Date,
                honorReceived: String,
            },
            vocational: {
                school: String,
                location: String,
                degree: String,
                from: Date,
                to: Date,
                honorReceived: String,
            },
            activities: String,
            hobbies: String,
            grade: String,
        },
        profession: {
            degree: String,
            profession: String,
            vocational: String,
            skills: String,
        },
        medicalInformation: {
            medicalHistory: String,
            hospitalizationHistory: String,
            allergies: Boolean,
            cardiovascular: Boolean,
            gastrointestinal: Boolean,
            musculoskeletal: Boolean,
            visionHearing: Boolean,
        },
        workingExperience: [
            {
                company: String,
                position: String,
                from: Date,
                to: Date,
                reasonForLeaving: String,
            },
        ],
        gender: { type: String, enum: Object.values(GENDER), required: true },
        profilePicture: { type: String },
        sssNumber: { type: String },
        philhealthNumber: { type: String },
        pagibigNumber: { type: String },
        tinNumber: String,
        gsisNumber: String,
        employedSince: { type: Date },
        employmentStatus: {
            type: String,
            enum: Object.values(EMPLOYMENT_STATUS),
            default: EMPLOYMENT_STATUS.ACTIVE,
            index: true,
        }, // 0 = inactive, 1 = active
        references: [
            {
                name: String,
                company: String,
                occupation: String,
                contactNumber: String,
                relationship: String,
            },
        ],
        OtherInformation: {
            civilCriminalCase: String,
            desiredSalary: String,
            canDrive: Boolean,
            driverslicenseNumber: String,
            whereDidYouHearAboutUs: {
                type: String,
                enum: Object.values(WHERE_DID_YOU_HEAR_ABOUT_US),
            },
        },
    },
    { timestamps: true },
);

export default mongoose.model("Employee", employeeSchema);
