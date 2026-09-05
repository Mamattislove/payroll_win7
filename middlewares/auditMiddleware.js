import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { AUDIT_ACTIONS } from "../utils/constants.js";

// Read requests are not logged — they would bury the writes that actually
// matter, and every page load fires several.
const LOGGED_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const METHOD_ACTIONS = {
    POST: AUDIT_ACTIONS.CREATE,
    PATCH: AUDIT_ACTIONS.UPDATE,
    PUT: AUDIT_ACTIONS.UPDATE,
    DELETE: AUDIT_ACTIONS.DELETE,
};

const REDACTED = "[redacted]";
const SECRET_KEYS = /pass|token|secret|otp|pin$/i;

// A bulk attendance post can carry hundreds of rows; keep the log row small.
const MAX_CHANGES_BYTES = 4000;

/** Strips credentials out of a request body before it is written to the log. */
function sanitize(value, depth = 0) {
    if (value == null || depth > 6) return value;
    if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
    if (typeof value !== "object") return value;

    const out = {};
    for (const [key, v] of Object.entries(value)) {
        out[key] = SECRET_KEYS.test(key) ? REDACTED : sanitize(v, depth + 1);
    }
    return out;
}

/** Keeps the stored body under MAX_CHANGES_BYTES, noting what was dropped. */
function truncate(body) {
    if (body == null) return undefined;
    const clean = sanitize(body);
    const json = JSON.stringify(clean);
    if (json === undefined) return undefined;
    if (json.length <= MAX_CHANGES_BYTES) return clean;

    if (Array.isArray(clean)) {
        return { truncated: true, itemCount: clean.length, sample: clean.slice(0, 3) };
    }
    // Arrays nested one level down are the usual culprit (e.g. { records: [...] }).
    const summary = { truncated: true };
    for (const [key, v] of Object.entries(clean)) {
        summary[key] = Array.isArray(v) ? `[${v.length} item(s)]` : v;
    }
    const summaryJson = JSON.stringify(summary);
    return summaryJson && summaryJson.length <= MAX_CHANGES_BYTES
        ? summary
        : { truncated: true, note: "body too large to store" };
}

/**
 * Splits "/api/v1/payrolls/68ab.../process" into its resource and id.
 * The id is only taken when the segment actually looks like an ObjectId, so
 * sub-routes like /periods or /bulk are not mistaken for one.
 */
function describePath(path) {
    const parts = path.replace(/^\/api\/v1\//, "").split("/").filter(Boolean);
    const resource = parts[0] ?? "";
    const resourceId = parts.find((p) => mongoose.isValidObjectId(p));
    return { resource, resourceId };
}

function resolveAction(req, statusCode) {
    const { resource } = describePath(req.path);
    if (resource === "auth") {
        if (req.path.endsWith("/login")) {
            return statusCode < 400
                ? AUDIT_ACTIONS.LOGIN
                : AUDIT_ACTIONS.LOGIN_FAILED;
        }
        if (req.path.endsWith("/logout")) return AUDIT_ACTIONS.LOGOUT;
    }
    return METHOD_ACTIONS[req.method];
}

/**
 * Records every state-changing request once the response has been sent.
 *
 * Mounted globally ahead of the routers. req.user is populated later by
 * authenticateUser, which is fine: the finish handler runs after the route has,
 * so by then it is set. Logging happens off the response path and never rejects
 * — an audit write must not be able to fail a payroll save.
 */
export const auditLogger = (req, res, next) => {
    // Logout is a GET in this app, so it needs letting through explicitly.
    const isLogout = req.method === "GET" && req.path.endsWith("/auth/logout");
    if (!LOGGED_METHODS.has(req.method) && !isLogout) return next();

    const { resource, resourceId } = describePath(req.path);

    // Never log reads of the log itself.
    if (resource === "audit-logs") return next();

    const body = truncate(req.body);

    res.on("finish", () => {
        const action = resolveAction(req, res.statusCode);
        if (!action) return;

        const entry = {
            action,
            resource,
            resourceId,
            method: req.method,
            path: req.originalUrl.split("?")[0],
            statusCode: res.statusCode,
            success: res.statusCode < 400,
            changes: body,
            ip: req.ip,
            userAgent: req.get("user-agent"),
        };

        // Login has no req.user yet — identify it by the submitted username so a
        // failed attempt still records who was tried.
        if (action === AUDIT_ACTIONS.LOGIN_FAILED) {
            entry.username = req.body?.username ?? "(unknown)";
            void AuditLog.create(entry).catch(() => {});
            return;
        }

        const userId = req.user?.userId;
        if (!userId) {
            void AuditLog.create(entry).catch(() => {});
            return;
        }

        // Snapshot the username/role alongside the reference, so the trail still
        // reads correctly if the account is renamed or removed later.
        void User.findById(userId)
            .select("username role")
            .lean()
            .then((user) =>
                AuditLog.create({
                    ...entry,
                    user: userId,
                    username: user?.username ?? "(deleted user)",
                    role: user?.role ?? req.user?.role,
                }),
            )
            .catch(() => {});
    });

    next();
};
