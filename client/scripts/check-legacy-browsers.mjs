/**
 * Verifies that `dist/` can actually run on the last browsers released for
 * Windows 7: Chrome/Edge 109 and Firefox 115 ESR.
 *
 * These browsers fail silently rather than loudly -- an unrecognised colour
 * function makes every element fall back to transparent or inherited, so the
 * app renders as a legible-but-colourless skeleton rather than throwing. That
 * is easy to ship by accident when a dependency bump changes what Tailwind or
 * Vite emit, hence this check.
 *
 * Run with: npm run check:legacy   (after npm run build)
 */
import fs from "fs";
import path from "path";
import { parse } from "acorn";

const DIST = "dist/assets";
const failures = [];
const pass = (msg) => console.log("  PASS  " + msg);
const fail = (msg) => {
    failures.push(msg);
    console.log("  FAIL  " + msg);
};

if (!fs.existsSync(DIST)) {
    console.error("No " + DIST + " found. Run `npm run build` first.");
    process.exit(1);
}
const files = fs.readdirSync(DIST);
const cssFiles = files.filter((f) => f.endsWith(".css"));
const jsFiles = files.filter((f) => f.endsWith(".js"));

/*
 * 1. CSS colour syntax.
 *
 * Tailwind v4 writes its palette in oklch() and its opacity modifiers with
 * color-mix(), neither of which Chrome 109 understands. Lightning CSS (wired up
 * in vite.config.js) rewrites them to hex and re-states the wide-gamut values
 * inside @supports, so old browsers take the hex and new ones take the rest.
 * Anything using this syntax *outside* an @supports block would break.
 *
 * Note that an @supports prelude is a feature query, not a declaration -- the
 * browser tests it rather than applying it, so occurrences there are fine.
 */
const MODERN_COLOR_SYNTAX = ["oklch(", "oklab(", "lab(", "lch(", "color-mix(", "linear-gradient(in "];

console.log("\nCSS colour syntax (Chrome 109 cannot parse oklch/lab/color-mix)");
for (const file of cssFiles) {
    const css = fs.readFileSync(path.join(DIST, file), "utf8");
    const openBlocks = [];
    const unguarded = new Map();
    let blockStart = 0;
    let inPrelude = false;

    for (let i = 0; i < css.length; i++) {
        if (css.startsWith("@supports", i)) inPrelude = true;
        const char = css[i];
        if (char === "{") {
            const prelude = css.slice(blockStart, i);
            const at = prelude.lastIndexOf("@supports");
            openBlocks.push(at >= 0 ? prelude.slice(at) : null);
            blockStart = i + 1;
            inPrelude = false;
        } else if (char === "}") {
            openBlocks.pop();
            blockStart = i + 1;
        } else if (char === ";") {
            blockStart = i + 1;
        }

        if (inPrelude || openBlocks.some((block) => block !== null)) continue;
        // Require a non-identifier character before the token so that oklch()
        // is not also counted as lch(), and oklab() as lab().
        if (/[\w-]/.test(css[i - 1] ?? "")) continue;
        for (const token of MODERN_COLOR_SYNTAX) {
            if (css.startsWith(token, i)) {
                unguarded.set(token, (unguarded.get(token) ?? 0) + 1);
            }
        }
    }

    if (unguarded.size === 0) {
        pass(file + " -- every modern colour value sits behind @supports");
    } else {
        for (const [token, count] of unguarded) {
            fail(file + " -- " + count + "x unguarded " + token);
        }
    }
}

/*
 * 2. JavaScript syntax.
 *
 * Chrome 109 and Firefox 115 both implement all of ES2022, so if every chunk
 * parses at that level there is nothing they cannot read. This catches
 * build.target in vite.config.js drifting upward.
 */
console.log("\nJavaScript syntax (Chrome 109 and Firefox 115 support all of ES2022)");
const tooNew = [];
for (const file of jsFiles) {
    try {
        parse(fs.readFileSync(path.join(DIST, file), "utf8"), {
            ecmaVersion: 2022,
            sourceType: "module",
        });
    } catch (err) {
        tooNew.push(file + ": " + err.message);
    }
}
if (tooNew.length === 0) pass(jsFiles.length + " chunks parse as ES2022 modules");
else tooNew.forEach(fail);

/*
 * 3. JavaScript runtime APIs.
 *
 * A build target downlevels syntax but never adds missing methods, so these
 * have to be polyfilled or avoided. Feature-detected uses are fine -- check the
 * surrounding code before acting on a hit.
 */
const POST_109_APIS = [
    [".toSorted(", "Array.prototype.toSorted", "Chrome 110"],
    [".toReversed(", "Array.prototype.toReversed", "Chrome 110"],
    [".toSpliced(", "Array.prototype.toSpliced", "Chrome 110"],
    [".isWellFormed(", "String.prototype.isWellFormed", "Chrome 111"],
    [".startViewTransition(", "Document.startViewTransition", "Chrome 111"],
    ["showPopover(", "Popover API", "Chrome 114"],
    ["AbortSignal.any(", "AbortSignal.any", "Chrome 116"],
    ["Object.groupBy(", "Object.groupBy", "Chrome 117"],
    ["Map.groupBy(", "Map.groupBy", "Chrome 117"],
    ["Promise.withResolvers(", "Promise.withResolvers", "Chrome 119"],
    ["URL.canParse(", "URL.canParse", "Chrome 120"],
    ["Array.fromAsync(", "Array.fromAsync", "Chrome 121"],
    [".isSubsetOf(", "Set.prototype.isSubsetOf", "Chrome 122"],
    [".symmetricDifference(", "Set.prototype.symmetricDifference", "Chrome 122"],
    ["Promise.try(", "Promise.try", "Chrome 128"],
    ["Error.isError(", "Error.isError", "Chrome 134"],
    ["Symbol.dispose", "explicit resource management", "Chrome 134"],
    ["Float16Array", "Float16Array", "Chrome 135"],
    ["RegExp.escape(", "RegExp.escape", "Chrome 136"],
    [".fromBase64(", "Uint8Array.fromBase64", "Chrome 140"],
];

/*
 * react-router feature-detects startViewTransition before calling it, and the
 * app never passes the `viewTransition` prop that would reach that code, so the
 * branch is dead on Windows 7. Remove this entry if the app starts using it.
 */
const ALLOWED = new Set(["Document.startViewTransition"]);

console.log("\nJavaScript runtime APIs (a build target cannot polyfill these)");
const found = new Map();
for (const file of jsFiles) {
    const code = fs.readFileSync(path.join(DIST, file), "utf8");
    for (const [token, name, since] of POST_109_APIS) {
        if (!code.includes(token)) continue;
        const key = name + " (" + since + ")";
        if (!found.has(key)) found.set(key, { name, files: [] });
        found.get(key).files.push(file);
    }
}
const unexpected = [...found.entries()].filter(([, v]) => !ALLOWED.has(v.name));
for (const [key, v] of found) {
    if (ALLOWED.has(v.name)) pass(key + " -- feature-detected, allowed");
}
if (unexpected.length === 0) pass("no other post-Chrome-109 APIs in " + jsFiles.length + " chunks");
else unexpected.forEach(([key, v]) => fail(key + " used in " + v.files.join(", ")));

console.log("");
if (failures.length) {
    console.error(failures.length + " problem(s) -- this build would break on Windows 7 browsers.");
    process.exit(1);
}
console.log("Build is safe for Chrome/Edge 109 and Firefox 115 ESR.");
