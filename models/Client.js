import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
    {
        clientName: { type: String, required: true },
        clientAddress: { type: String },
        clientEmail: { type: String },
        clientTelephone: { type: String },
        clientLogo: { type: String },
        contactPerson: { type: String },
        contactPersonNumber: { type: String },
        contactPersonEmail: { type: String },
        contactPersonImage: { type: String },
        clientSince: { type: Date },
    },
    { timestamps: true },
);

export default mongoose.model("Client", clientSchema);
