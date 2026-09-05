import { useState } from "react";
import { useNavigate, useNavigation, Form, redirect } from "react-router-dom";
import { toast } from "react-toastify";
import customFetch from "../../utils/customFetch";
import {
    GENDER,
    CIVIL_STATUS,
    WHERE_DID_YOU_HEAR_ABOUT_US,
} from "../../../utils/constants";

export const loader = async () => {
    try {
        await customFetch.get("/users/current-user");
        return null;
    } catch {
        return redirect("/login");
    }
};

// Converts dot-notation FormData keys into a nested object.
// e.g. { "emergencyContact.name": "Juan" } → { emergencyContact: { name: "Juan" } }
const buildNested = (flat) => {
    const out = {};
    for (const [path, value] of Object.entries(flat)) {
        const parts = path.split(".");
        let node = out;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node[parts[i]]) node[parts[i]] = {};
            node = node[parts[i]];
        }
        node[parts[parts.length - 1]] = value;
    }
    return out;
};

export const action = async ({ request }) => {
    try {
        const formData = await request.formData();
        const flat = Object.fromEntries(formData);

        // Required field validation
        const missing = [];
        if (!flat.firstName?.trim()) missing.push("First Name");
        if (!flat.lastName?.trim()) missing.push("Last Name");
        if (!flat.employeeCode?.trim()) missing.push("Employee Code");
        if (missing.length > 0) {
            toast.error(`Please fill in: ${missing.join(", ")}`);
            return null;
        }

        // Strip empty strings so optional date/email fields don't fail backend validation
        for (const key of Object.keys(flat)) {
            if (flat[key] === "") delete flat[key];
        }

        // Build nested object from dot-notation keys
        const data = buildNested(flat);

        // Arrays were serialized as JSON in hidden inputs — parse them back
        data.families = JSON.parse(flat._families || "[]");
        data.relatives = JSON.parse(flat._relatives || "[]");
        data.workingExperience = JSON.parse(flat._workingExperience || "[]");
        data.references = JSON.parse(flat._references || "[]");

        // Remove the underscore keys that buildNested copied
        delete data._families;
        delete data._relatives;
        delete data._workingExperience;
        delete data._references;

        // Checkboxes / radios send "true"/"false" strings — convert to booleans
        if (data.medicalInformation) {
            for (const key of [
                "allergies",
                "cardiovascular",
                "gastrointestinal",
                "musculoskeletal",
                "visionHearing",
            ]) {
                data.medicalInformation[key] =
                    flat[`medicalInformation.${key}`] === "true";
            }
        }
        if (data.OtherInformation) {
            data.OtherInformation.canDrive =
                flat["OtherInformation.canDrive"] === "true";
        }
        console.log(data);

        await customFetch.post("/employees", data);
        toast.success("Employee added successfully");
        return redirect("/dashboard/employees");
    } catch (error) {
        toast.error(
            error?.response?.data?.msg ||
                error?.response?.data?.message ||
                error.message,
        );
        return null;
    }
};

// ─── shared UI ────────────────────────────────────────────────────────────────

const inputCls =
    "w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 bg-white";
const labelCls = "block text-xs text-slate-500 mb-0.5";

const SectionHeader = ({ children }) => (
    <div className="bg-slate-100 border-b border-slate-200 px-4 py-2">
        <span className="text-sm font-semibold text-slate-700">{children}</span>
    </div>
);

const Field = ({ label, children }) => (
    <div>
        <label className={labelCls}>{label}</label>
        {children}
    </div>
);

const CardHeader = ({ label, onRemove }) => (
    <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <button
            type="button"
            onClick={onRemove}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
        >
            × Remove
        </button>
    </div>
);

// ─── empty row factories ─────────────────────────────────────────────────────

const emptyFamily = () => ({
    name: "",
    relationship: "",
    birthDate: "",
    address: "",
    occupation: "",
});
const emptyRelative = () => ({ name: "", position: "", relationship: "" });
const emptyWorkExp = () => ({
    company: "",
    position: "",
    from: "",
    to: "",
    reasonForLeaving: "",
});
const emptyReference = () => ({
    name: "",
    company: "",
    occupation: "",
    contactNumber: "",
    relationship: "",
});

// ─── component ────────────────────────────────────────────────────────────────

const AddEmployee = () => {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const submitting = navigation.state === "submitting";

    const [families, setFamilies] = useState(() => [emptyFamily()]);
    const [relatives, setRelatives] = useState(() => [emptyRelative()]);
    const [workExp, setWorkExp] = useState(() => [emptyWorkExp()]);
    const [references, setReferences] = useState(() => [emptyReference()]);

    const [ecodePrefix, setEcodePrefix] = useState("");
    const [ecodeSuffix, setEcodeSuffix] = useState("");
    const [ecodeLoading, setEcodeLoading] = useState(false);
    const combinedCode = ecodePrefix && ecodeSuffix ? `${ecodePrefix}-${ecodeSuffix}` : "";

    const handlePrefixChange = async (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        setEcodePrefix(val);
        if (val.length >= 1) {
            setEcodeLoading(true);
            try {
                const { data } = await customFetch.get(`/employees/next-code?prefix=${val}`);
                setEcodeSuffix(data.nextSuffix);
            } catch {
                setEcodeSuffix("");
            } finally {
                setEcodeLoading(false);
            }
        } else {
            setEcodeSuffix("");
        }
    };

    const updateRow = (setter, idx, field, value) =>
        setter((prev) =>
            prev.map((row, i) =>
                i === idx ? { ...row, [field]: value } : row,
            ),
        );

    const addRow = (setter, factory) => setter((prev) => [...prev, factory()]);
    const removeRow = (setter, idx) =>
        setter((prev) => prev.filter((_, i) => i !== idx));

    return (
        <div>
            {/* Page header */}
            <div className="mb-5 flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    ← Back
                </button>
                <h1 className="text-2xl font-bold text-slate-800">
                    Add Employee
                </h1>
            </div>

            <Form method="post">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* ══════════════ LEFT COLUMN ══════════════ */}
                    <div className="flex flex-col gap-6">
                        {/* Personal Background */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>Personal Background</SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                <div>
                                    <label className={`${labelCls} whitespace-nowrap`}>Employee Code *</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="YNL"
                                            value={ecodePrefix}
                                            onChange={handlePrefixChange}
                                            maxLength={10}
                                            className={`${inputCls} w-24 uppercase`}
                                        />
                                        <span className="text-slate-400 font-bold">-</span>
                                        <input
                                            type="text"
                                            placeholder="00001"
                                            value={ecodeSuffix}
                                            onChange={(e) => setEcodeSuffix(e.target.value.replace(/[^0-9A-Za-z]/g, ""))}
                                            maxLength={10}
                                            className={`${inputCls} w-28`}
                                        />
                                        {ecodeLoading && (
                                            <span className="text-xs text-slate-400">loading…</span>
                                        )}
                                        {combinedCode && !ecodeLoading && (
                                            <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                                                {combinedCode}
                                            </span>
                                        )}
                                    </div>
                                    <input type="hidden" name="employeeCode" value={combinedCode} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="First Name *">
                                        <input
                                            name="firstName"
                                            required
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Middle Name">
                                        <input
                                            name="middleName"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <Field label="Surname *">
                                    <input
                                        name="lastName"
                                        required
                                        className={inputCls}
                                    />
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Date of Birth">
                                        <input
                                            type="date"
                                            name="birthDate"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Religion">
                                        <input
                                            name="religion"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <Field label="Place of Birth">
                                    <textarea
                                        name="birthPlace"
                                        rows={2}
                                        className={inputCls}
                                    />
                                </Field>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <Field label="Height">
                                        <input
                                            name="height"
                                            className={inputCls}
                                            placeholder="cm"
                                        />
                                    </Field>
                                    <Field label="Weight">
                                        <input
                                            name="weight"
                                            className={inputCls}
                                            placeholder="kg"
                                        />
                                    </Field>
                                    <Field label="Civil Status">
                                        <select
                                            name="civilStatus"
                                            className={inputCls}
                                        >
                                            <option value="">—</option>
                                            {Object.values(CIVIL_STATUS).map(
                                                (v) => (
                                                    <option
                                                        key={v}
                                                        value={v}
                                                        className="capitalize"
                                                    >
                                                        {v}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </Field>
                                    <Field label="Gender">
                                        <select
                                            name="gender"
                                            className={inputCls}
                                        >
                                            <option value="">—</option>
                                            {Object.values(GENDER).map((v) => (
                                                <option
                                                    key={v}
                                                    value={v}
                                                    className="capitalize"
                                                >
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>
                                <Field label="Profile Picture">
                                    <input
                                        type="file"
                                        name="profilePicture"
                                        accept="image/*"
                                        className="w-full text-sm text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                    />
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Field label="Contact No. 1">
                                        <input
                                            name="contactNumber1"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Contact No. 2">
                                        <input
                                            name="contactNumber2"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Contact No. 3">
                                        <input
                                            name="contactNumber3"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <Field label="Present Address">
                                    <textarea
                                        name="presentAddress"
                                        rows={2}
                                        className={inputCls}
                                        placeholder="No. Street Barangay Municipality/City Province"
                                    />
                                </Field>
                                <Field label="Permanent Address">
                                    <textarea
                                        name="permanentAddress"
                                        rows={2}
                                        className={inputCls}
                                        placeholder="No. Street Barangay Municipality/City Province"
                                    />
                                </Field>
                                <Field label="Other Address">
                                    <textarea
                                        name="otherAddress"
                                        rows={2}
                                        className={inputCls}
                                        placeholder="No. Street Barangay Municipality/City Province"
                                    />
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Field label="Email 1">
                                        <input
                                            type="email"
                                            name="email1"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Email 2">
                                        <input
                                            type="email"
                                            name="email2"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Email 3">
                                        <input
                                            type="email"
                                            name="email3"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* Government IDs */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>Government IDs</SectionHeader>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label="SSS No.">
                                    <input
                                        name="sssNumber"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="HDMF No. (Pag-IBIG)">
                                    <input
                                        name="pagibigNumber"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="PhilHealth">
                                    <input
                                        name="philhealthNumber"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="TIN">
                                    <input
                                        name="tinNumber"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="GSIS">
                                    <input
                                        name="gsisNumber"
                                        className={inputCls}
                                    />
                                </Field>
                            </div>
                        </div>

                        {/* Families */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>
                                Give Particulars about your parents, brothers
                                and sisters, or spouse and children, if married
                            </SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                {families.map((row, i) => (
                                    <div
                                        key={i}
                                        className="border border-slate-200 rounded-lg overflow-hidden"
                                    >
                                        <CardHeader
                                            label={`Member #${i + 1}`}
                                            onRemove={() =>
                                                removeRow(setFamilies, i)
                                            }
                                        />
                                        <div className="p-3 flex flex-col gap-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Field label="Name">
                                                    <input
                                                        value={row.name}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setFamilies,
                                                                i,
                                                                "name",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                        placeholder="Full name"
                                                    />
                                                </Field>
                                                <Field label="Relation">
                                                    <input
                                                        value={row.relationship}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setFamilies,
                                                                i,
                                                                "relationship",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                        placeholder="e.g. Mother"
                                                    />
                                                </Field>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Field label="Date of Birth">
                                                    <input
                                                        type="date"
                                                        value={row.birthDate}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setFamilies,
                                                                i,
                                                                "birthDate",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="Occupation">
                                                    <input
                                                        value={row.occupation}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setFamilies,
                                                                i,
                                                                "occupation",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                            </div>
                                            <Field label="Address">
                                                <input
                                                    value={row.address}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            setFamilies,
                                                            i,
                                                            "address",
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={inputCls}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow(setFamilies, emptyFamily)
                                    }
                                    className="text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors text-left"
                                >
                                    + Add Family Member
                                </button>
                            </div>
                        </div>

                        {/* Relatives */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>
                                Do you have any relatives working here? If yes,
                                fill out below.
                            </SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                {relatives.map((row, i) => (
                                    <div
                                        key={i}
                                        className="border border-slate-200 rounded-lg overflow-hidden"
                                    >
                                        <CardHeader
                                            label={`Relative #${i + 1}`}
                                            onRemove={() =>
                                                removeRow(setRelatives, i)
                                            }
                                        />
                                        <div className="p-3 flex flex-col gap-2">
                                            <Field label="Name">
                                                <input
                                                    value={row.name}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            setRelatives,
                                                            i,
                                                            "name",
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={inputCls}
                                                />
                                            </Field>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Field label="Position / Dept.">
                                                    <input
                                                        value={row.position}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setRelatives,
                                                                i,
                                                                "position",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="Relation">
                                                    <input
                                                        value={row.relationship}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setRelatives,
                                                                i,
                                                                "relationship",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow(setRelatives, emptyRelative)
                                    }
                                    className="text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors text-left"
                                >
                                    + Add Relative
                                </button>
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>
                                Contact Person in Case of Emergency
                            </SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Contact Person Name">
                                        <input
                                            name="emergencyContact.name"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Relationship">
                                        <input
                                            name="emergencyContact.relationship"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Contact Number">
                                        <input
                                            name="emergencyContact.contactNumber"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Address">
                                        <input
                                            name="emergencyContact.address"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* Educational Background */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>
                                Educational Background
                            </SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                {[
                                    ["highSchool", "High School"],
                                    ["college", "College / University"],
                                    ["graduateSchool", "Graduate School"],
                                    ["vocational", "Seminars / Training"],
                                ].map(([key, label]) => (
                                    <div
                                        key={key}
                                        className="border border-slate-200 rounded-lg overflow-hidden"
                                    >
                                        <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                                            <span className="text-xs font-medium text-slate-600">
                                                {label}
                                            </span>
                                        </div>
                                        <div className="p-3 flex flex-col gap-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Field label="Name of School">
                                                    <input
                                                        name={`educationalBackground.${key}.school`}
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="Location">
                                                    <input
                                                        name={`educationalBackground.${key}.location`}
                                                        className={inputCls}
                                                    />
                                                </Field>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <Field label="Major / Degree">
                                                    <input
                                                        name={`educationalBackground.${key}.degree`}
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="From">
                                                    <input
                                                        type="date"
                                                        name={`educationalBackground.${key}.from`}
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="To">
                                                    <input
                                                        type="date"
                                                        name={`educationalBackground.${key}.to`}
                                                        className={inputCls}
                                                    />
                                                </Field>
                                            </div>
                                            <Field label="Honor Received">
                                                <input
                                                    name={`educationalBackground.${key}.honorReceived`}
                                                    className={inputCls}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex flex-col gap-2 pt-1">
                                    <Field label="School activities you participated in (athletics, clubs, organizations, publications, etc.)">
                                        <textarea
                                            name="educationalBackground.activities"
                                            rows={2}
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field label="Hobbies / Interests">
                                        <textarea
                                            name="educationalBackground.hobbies"
                                            rows={2}
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══════════════ RIGHT COLUMN ══════════════ */}
                    <div className="flex flex-col gap-6">
                        {/* Medical Background */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>Medical Background</SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                <Field label="Present or past medical history (indicate conditions that need special consideration in job assignment)">
                                    <textarea
                                        name="medicalInformation.medicalHistory"
                                        rows={3}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Any illness, hospitalization, or accidents in the past 2 years? (Please explain)">
                                    <textarea
                                        name="medicalInformation.hospitalizationHistory"
                                        rows={3}
                                        className={inputCls}
                                    />
                                </Field>
                                <p className="text-xs font-medium text-slate-600">
                                    Check any conditions you have or have had:
                                </p>
                                <div className="flex flex-col gap-2">
                                    {[
                                        [
                                            "medicalInformation.allergies",
                                            "Allergic disorder (asthma, hay fever, hives)",
                                        ],
                                        [
                                            "medicalInformation.cardiovascular",
                                            "Cardiovascular conditions (elevated blood pressure, anemia, heart abnormalities)",
                                        ],
                                        [
                                            "medicalInformation.gastrointestinal",
                                            "Gastrointestinal problems (ulcer, liver disease, bowel problems)",
                                        ],
                                        [
                                            "medicalInformation.musculoskeletal",
                                            "Muscular / skeletal (fractured bone, disc, or joint problems)",
                                        ],
                                        [
                                            "medicalInformation.visionHearing",
                                            "Vision / hearing problems (glasses, defects, or disease)",
                                        ],
                                    ].map(([name, label]) => (
                                        <label
                                            key={name}
                                            className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                name={name}
                                                value="true"
                                                className="mt-0.5 accent-slate-800"
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Work Experience */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>Work Experience</SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                {workExp.map((row, i) => (
                                    <div
                                        key={i}
                                        className="border border-slate-200 rounded-lg overflow-hidden"
                                    >
                                        <CardHeader
                                            label={`Job #${i + 1}`}
                                            onRemove={() =>
                                                removeRow(setWorkExp, i)
                                            }
                                        />
                                        <div className="p-3 flex flex-col gap-2">
                                            <Field label="Company Name & Address">
                                                <textarea
                                                    value={row.company}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            setWorkExp,
                                                            i,
                                                            "company",
                                                            e.target.value,
                                                        )
                                                    }
                                                    rows={2}
                                                    className={inputCls}
                                                />
                                            </Field>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <Field label="Position / Nature of Work">
                                                    <input
                                                        value={row.position}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setWorkExp,
                                                                i,
                                                                "position",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="From">
                                                    <input
                                                        type="date"
                                                        value={row.from}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setWorkExp,
                                                                i,
                                                                "from",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="To">
                                                    <input
                                                        type="date"
                                                        value={row.to}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setWorkExp,
                                                                i,
                                                                "to",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                            </div>
                                            <Field label="Reason for Leaving">
                                                <input
                                                    value={row.reasonForLeaving}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            setWorkExp,
                                                            i,
                                                            "reasonForLeaving",
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={inputCls}
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow(setWorkExp, emptyWorkExp)
                                    }
                                    className="text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors text-left"
                                >
                                    + Add Work Experience
                                </button>
                            </div>
                        </div>

                        {/* Other Information */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>Other Information</SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                <Field label="Have you ever been involved in any administrative, civil, or criminal case? (Please explain)">
                                    <textarea
                                        name="OtherInformation.civilCriminalCase"
                                        rows={3}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Approximate monthly minimum salary desired">
                                    <input
                                        name="OtherInformation.desiredSalary"
                                        className={inputCls}
                                    />
                                </Field>
                                <div className="flex flex-wrap items-center gap-4">
                                    <p className="text-xs text-slate-600 font-medium">
                                        Can you drive?
                                    </p>
                                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="OtherInformation.canDrive"
                                            value="true"
                                            className="accent-slate-800"
                                        />{" "}
                                        Yes
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="OtherInformation.canDrive"
                                            value="false"
                                            defaultChecked
                                            className="accent-slate-800"
                                        />{" "}
                                        No
                                    </label>
                                </div>
                                <Field label="Driver's License No.">
                                    <input
                                        name="OtherInformation.driverslicenseNumber"
                                        className={inputCls}
                                        placeholder="Driver's License No."
                                    />
                                </Field>
                                <div>
                                    <p className="text-xs font-medium text-slate-600 mb-1.5">
                                        How did you hear about us?
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {Object.values(
                                            WHERE_DID_YOU_HEAR_ABOUT_US,
                                        ).map((v) => (
                                            <label
                                                key={v}
                                                className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer capitalize"
                                            >
                                                <input
                                                    type="radio"
                                                    name="OtherInformation.whereDidYouHearAboutUs"
                                                    value={v}
                                                    className="accent-slate-800"
                                                />
                                                {v}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* References */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>References</SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                {references.map((row, i) => (
                                    <div
                                        key={i}
                                        className="border border-slate-200 rounded-lg overflow-hidden"
                                    >
                                        <CardHeader
                                            label={`Reference #${i + 1}`}
                                            onRemove={() =>
                                                removeRow(setReferences, i)
                                            }
                                        />
                                        <div className="p-3 flex flex-col gap-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Field label="Name">
                                                    <input
                                                        value={row.name}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setReferences,
                                                                i,
                                                                "name",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="Occupation">
                                                    <input
                                                        value={row.occupation}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setReferences,
                                                                i,
                                                                "occupation",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                            </div>
                                            <Field label="Company / Address">
                                                <input
                                                    value={row.company}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            setReferences,
                                                            i,
                                                            "company",
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={inputCls}
                                                />
                                            </Field>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Field label="Contact No.">
                                                    <input
                                                        value={
                                                            row.contactNumber
                                                        }
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setReferences,
                                                                i,
                                                                "contactNumber",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                                <Field label="Relation">
                                                    <input
                                                        value={row.relationship}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                setReferences,
                                                                i,
                                                                "relationship",
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={inputCls}
                                                    />
                                                </Field>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow(setReferences, emptyReference)
                                    }
                                    className="text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors text-left"
                                >
                                    + Add Reference
                                </button>
                            </div>
                        </div>

                        {/* Skills and Profession */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>Skills and Profession</SectionHeader>
                            <div className="p-4 flex flex-col gap-3">
                                <Field label="Degree (e.g. Bachelor of Science in Information Technology)">
                                    <input
                                        name="profession.degree"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Profession (e.g. Software Engineer, Lawyer, Accountant)">
                                    <input
                                        name="profession.profession"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Vocational Course">
                                    <input
                                        name="profession.vocational"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Skills (separate by commas — e.g. automotive, photoshop, video editing)">
                                    <textarea
                                        name="profession.skills"
                                        rows={2}
                                        className={inputCls}
                                    />
                                </Field>
                            </div>
                        </div>

                        {/* Employment Status */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <SectionHeader>Employment Status</SectionHeader>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Date of Employment">
                                    <input
                                        type="date"
                                        name="employedSince"
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Employment Status">
                                    <select
                                        name="employmentStatus"
                                        className={inputCls}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">
                                            Inactive
                                        </option>
                                    </select>
                                </Field>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hidden inputs — carry state-managed arrays to the action */}
                <input
                    type="hidden"
                    name="_families"
                    value={JSON.stringify(
                        families.filter((r) => r.name || r.relationship),
                    )}
                />
                <input
                    type="hidden"
                    name="_relatives"
                    value={JSON.stringify(
                        relatives.filter((r) => r.name || r.position),
                    )}
                />
                <input
                    type="hidden"
                    name="_workingExperience"
                    value={JSON.stringify(
                        workExp.filter((r) => r.company || r.position),
                    )}
                />
                <input
                    type="hidden"
                    name="_references"
                    value={JSON.stringify(references.filter((r) => r.name))}
                />

                {/* Submit bar */}
                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-8 py-2.5 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
                    >
                        {submitting ? "Saving..." : "Save Employee"}
                    </button>
                </div>
            </Form>
        </div>
    );
};
export default AddEmployee;
