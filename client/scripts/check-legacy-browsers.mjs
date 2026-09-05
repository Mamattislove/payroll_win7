/**
 * Verifies that `dist/` can actually run on the last browsers released for
 * Windows 7: Chrome/Edge 109 and Firefox 115 ESR.
 *
 * These browsers fail silently rather than loudly -- an unrecognised colour
 * function makes every element fall back to transparent or inherited, and an
 * unrecognised property is dropped along with the rule it sits in, so the app
 * renders as a legible-but-wrong skeleton rather than throwing. That is easy to
 * ship by accident when a dependency bump changes what Tailwind or Vite emit,
 * or when someone reaches for a utility class whose CSS is newer than the
 * target, hence this check.
 *
 * Run with: npm run check:legacy   (after npm run build)
 */
import fs from "fs";
import path from "path";
import { parse } from "acorn";

const DIST_ROOT = "dist";
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
 * Counts occurrences of each token that sit *outside* an @supports block.
 *
 * Lightning CSS re-states values old browsers cannot read inside @supports, so
 * old browsers take the fallback and new ones take the guarded version. Only
 * unguarded occurrences are a problem.
 *
 * Note that an @supports prelude is a feature query, not a declaration -- the
 * browser tests it rather than applying it, so occurrences there are fine.
 *
 * A token starting with an identifier character (a property name such as
 * "text-wrap:") has to be preceded by a non-identifier character, so that
 * oklch() is not also counted as lch(), and oklab() as lab(). Tokens starting
 * with punctuation (":has(", "@scope") are matched anywhere, since they follow
 * a selector or declaration that legitimately ends in a word character.
 */
function scanUnguarded(css, tokens) {
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
        const afterWordChar = /[\w-]/.test(css[i - 1] ?? "");
        for (const token of tokens) {
            if (afterWordChar && /^[\w-]/.test(token)) continue;
            if (css.startsWith(token, i)) {
                unguarded.set(token, (unguarded.get(token) ?? 0) + 1);
            }
        }
    }
    return unguarded;
}

/*
 * 1. CSS colour syntax.
 *
 * Tailwind v4 writes its palette in oklch() and its opacity modifiers with
 * color-mix(), neither of which Chrome 109 understands. Lightning CSS (wired up
 * in vite.config.js) rewrites them to hex and re-states the wide-gamut values
 * inside @supports, so old browsers take the hex and new ones take the rest.
 * Anything using this syntax *outside* an @supports block would break.
 */
const MODERN_COLOR_SYNTAX = ["oklch(", "oklab(", "lab(", "lch(", "color-mix(", "linear-gradient(in "];

console.log("\nCSS colour syntax (Chrome 109 cannot parse oklch/lab/color-mix)");
for (const file of cssFiles) {
    const css = fs.readFileSync(path.join(DIST, file), "utf8");
    const unguarded = scanUnguarded(css, MODERN_COLOR_SYNTAX);

    if (unguarded.size === 0) {
        pass(file + " -- every modern colour value sits behind @supports");
    } else {
        for (const [token, count] of unguarded) {
            fail(file + " -- " + count + "x unguarded " + token);
        }
    }
}

/*
 * 2. CSS features newer than the target browsers.
 *
 * Lightning CSS lowers syntax -- nesting, colour functions, vendor prefixes --
 * but it cannot invent a feature the engine does not have. An unknown property
 * is dropped, and an unknown selector takes its whole rule with it. Most of the
 * entries below are one Tailwind utility away: `text-balance`, `has-*`,
 * `starting:`, `transition-discrete`, `grid-cols-subgrid`, `field-sizing-*`.
 *
 * :has() is the trap worth remembering. Chrome 109 supports it, so it looks
 * right on the machine the build runs on, and Firefox 115 ESR silently drops
 * every rule that uses it.
 */
const POST_TARGET_CSS = [
    ["text-wrap:", "text-wrap: balance/pretty", "Chrome 114 / Firefox 121"],
    ["field-sizing", "field-sizing", "Chrome 123"],
    ["@starting-style", "@starting-style", "Chrome 117 / Firefox 129"],
    ["transition-behavior", "transition-behavior", "Chrome 117 / Firefox 129"],
    ["allow-discrete", "transition-behavior: allow-discrete", "Chrome 117 / Firefox 129"],
    ["subgrid", "subgrid", "Chrome 117"],
    [":has(", ":has()", "Firefox 121 -- Chrome 109 is fine, Firefox 115 ESR is not"],
    [":user-valid", ":user-valid", "Chrome 119"],
    [":user-invalid", ":user-invalid", "Chrome 119"],
    ["[popover", "popover attribute", "Chrome 114 / Firefox 125"],
    ["light-dark(", "light-dark()", "Chrome 123 / Firefox 120"],
    ["@scope", "@scope", "Chrome 118, not in Firefox"],
    ["anchor-name", "CSS anchor positioning", "Chrome 125, not in Firefox"],
    ["position-anchor", "CSS anchor positioning", "Chrome 125, not in Firefox"],
    ["interpolate-size", "interpolate-size", "Chrome 129, not in Firefox"],
    ["calc-size(", "calc-size()", "Chrome 129, not in Firefox"],
    ["content-visibility", "content-visibility", "Firefox 125"],
    ["scrollbar-color", "scrollbar-color", "Chrome 121"],
    ["text-box-trim", "text-box-trim", "Chrome 133, not in Firefox"],
];

console.log("\nCSS features (an unknown property or selector is dropped, not ignored)");
for (const file of cssFiles) {
    const css = fs.readFileSync(path.join(DIST, file), "utf8");
    const unguarded = scanUnguarded(
        css,
        POST_TARGET_CSS.map(([token]) => token),
    );

    if (unguarded.size === 0) {
        pass(file + " -- nothing newer than Chrome 109 / Firefox 115");
    } else {
        for (const [token, count] of unguarded) {
            const [, name, since] = POST_TARGET_CSS.find(([t]) => t === token);
            fail(file + " -- " + count + "x " + name + " (" + since + ")");
        }
    }
}

/*
 * 3. The @property fallback.
 *
 * Tailwind v4 registers its --tw-* variables with @property, which Firefox did
 * not ship until 128. Without a registration those variables have no initial
 * value, so every var() that depends on one is invalid at computed-value time
 * and the declaration is thrown away -- shadow, transform, ring and gradient
 * utilities all stop working, on Firefox only.
 *
 * Tailwind ships a fallback that assigns the initial values through a universal
 * selector inside an @supports block only old Firefox and Safari match (it
 * sniffs -moz-orient plus the absence of relative colour syntax). If a Tailwind
 * upgrade keeps @property but drops that block, Chrome 109 stays fine while
 * Firefox 115 loses most of its styling, so check they travel together.
 */
console.log("\n@property fallback (Firefox 115 ESR has no @property)");
for (const file of cssFiles) {
    const css = fs.readFileSync(path.join(DIST, file), "utf8");
    if (!css.includes("@property")) {
        pass(file + " -- no @property rules to fall back from");
    } else if (css.includes("-moz-orient")) {
        pass(file + " -- @property rules ship with Tailwind's old-Firefox fallback");
    } else {
        fail(file + " -- uses @property with no fallback for Firefox 115 ESR");
    }
}

/*
 * 4. JavaScript syntax.
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
 * 5. JavaScript runtime APIs.
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
    ["Intl.DurationFormat", "Intl.DurationFormat", "Chrome 129"],
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

/*
 * 6. The nomodule fallback in index.html.
 *
 * Windows 7 ships with Internet Explorer 11, which ignores <script type=module>
 * entirely and would otherwise render a blank white page with nothing in the
 * console to explain it. index.html carries a `nomodule` script that replaces
 * the empty root with instructions for installing a browser that works.
 *
 * That script only helps if IE can parse it, and a syntax error takes the whole
 * script with it, so it has to stay ES5: no arrow functions, no template
 * literals, no const. Check the shipped copy rather than the source, since it
 * is dist/index.html that reaches the browser.
 */
console.log("\nindex.html fallback (Internet Explorer 11 skips module scripts)");
const indexPath = path.join(DIST_ROOT, "index.html");
if (!fs.existsSync(indexPath)) {
    fail("no " + indexPath + " -- nothing would explain the blank page to IE 11");
} else {
    const html = fs.readFileSync(indexPath, "utf8");
    const nomodule = html.match(/<script\s+nomodule\s*>([\s\S]*?)<\/script>/i);
    if (!nomodule) {
        fail("index.html has no <script nomodule> -- IE 11 would show a blank page");
    } else {
        try {
            parse(nomodule[1], { ecmaVersion: 5, sourceType: "script" });
            pass("index.html nomodule fallback parses as ES5");
        } catch (err) {
            fail("index.html nomodule fallback is not ES5, so IE 11 cannot run it: " + err.message);
        }
    }
}

console.log("");
if (failures.length) {
    console.error(failures.length + " problem(s) -- this build would break on Windows 7 browsers.");
    process.exit(1);
}
console.log("Build is safe for Chrome/Edge 109 and Firefox 115 ESR.");
