import mongoose from "mongoose";
import { HOLIDAY_TYPES } from "../utils/constants.js";

const holidaySchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, unique: true },
        eventName: { type: String, required: true },
        specialLegal: {
            type: String,
            enum: Object.values(HOLIDAY_TYPES),
            required: true,
        },
    },
    { timestamps: true },
);

export default mongoose.model("Holiday", holidaySchema);
