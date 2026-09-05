import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const employeeDesignationSchema = new mongoose.Schema(
    {
        employee: { type: ObjectId, ref: "Employee", required: true },
        client: { type: ObjectId, ref: "Client", required: true },
        department: { type: ObjectId, ref: "Department", required: true },
        position: { type: ObjectId, ref: "Position", required: true },
    },
    { timestamps: true },
);

employeeDesignationSchema.index(
    { employee: 1, client: 1, department: 1, position: 1 },
    { unique: true },
);

export default mongoose.model("EmployeeDesignation", employeeDesignationSchema);
