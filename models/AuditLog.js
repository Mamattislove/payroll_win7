import mongoose from "mongoose";
import { AUDIT_ACTIONS } from "../utils/constants.js";

const { ObjectId } = mongoose.Schema.Types;

const auditLogSchema = new mongoose.Schema(
    {
        // Reference for joins, plus a snapshot of who it was at the time. The
        // snapshot matters: a user can be renamed or deleted later, and an audit
        // trail that changes retroactively is not an audit trail.
        user: { type: ObjectId, ref: "User" },
        username: { type: String },
        role: { type: String },

        action: { type: String, enum: Object.values(AUDIT_ACTIONS), index: true },
        resource: { type: String, index: true }, // "payrolls", "employees", …
        resourceId: { type: String },

        method: { type: String },
        path: { type: String },
        statusCode: { type: Number },
        success: { type: Boolean, default: true },

        // Sanitised request body — never contains passwords or tokens, and is
        // truncated so a bulk import cannot write a multi-megabyte log row.
        changes: { type: mongoose.Schema.Types.Mixed },

        ip: { type: String },
        userAgent: { type: String },
    },
    { timestamps: true },
);

// The admin view is always "most recent first", optionally narrowed by who or
// what, so lead every index with the sort key's companions.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
