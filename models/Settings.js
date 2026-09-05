import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        sssOverwriteAmount:        { type: Number, default: 0 },
        philhealthOverwriteAmount: { type: Number, default: 0 },
        pagibigOverwriteAmount:    { type: Number, default: 0 },
    },
    { timestamps: true },
);

// Always read with Settings.findOne() — only one document should exist
export default mongoose.model("Settings", settingsSchema);
