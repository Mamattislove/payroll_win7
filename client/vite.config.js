import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Windows 7 browser ceiling. Chrome/Edge 109 was the final release for Win7,
// and Firefox 115 is the last ESR that installs there. Vite 8 otherwise
// defaults to chrome111/firefox114, which ships CSS these browsers cannot read.
const LEGACY_JS_TARGET = ["chrome109", "edge109", "firefox115"];

// Lightning CSS encodes versions as major << 16 | minor << 8 | patch.
const browserVersion = (major) => major << 16;
const LEGACY_CSS_TARGET = {
    chrome: browserVersion(109),
    edge: browserVersion(109),
    firefox: browserVersion(115),
};

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        dedupe: ["react", "react-dom"],
        alias: {
            "@shared": path.resolve(__dirname, "../utils"),
        },
    },
    css: {
        // Tailwind v4 emits its palette as oklch(), which Chrome 109 cannot
        // parse -- every colour would fall back to transparent/inherited.
        // Lightning CSS rewrites those to hex and keeps the wide-gamut values
        // behind an @supports guard for newer browsers.
        transformer: "lightningcss",
        lightningcss: {
            targets: LEGACY_CSS_TARGET,
        },
    },
    // build.target only applies to `vite build`. The dev server transforms
    // source with Oxc, which defaults to `esnext` and lowers nothing, so
    // `npm run dev` (what start-app.cmd runs, with --host, so Windows 7
    // machines reach it over the LAN) would serve syntax Chrome 109 cannot
    // parse. Pin it to the same ceiling as the build.
    //
    // Note Oxc skips plain `.js` by default (its exclude is /\.js$/), so the
    // hand-written helpers in utils/ and ../utils/ are served as authored in
    // dev. Keep those to syntax Chrome 109 already understands.
    oxc: {
        target: LEGACY_JS_TARGET,
    },
    build: {
        target: LEGACY_JS_TARGET,
        cssMinify: "lightningcss",
    },
    optimizeDeps: {
        // Keep dev-mode prebundles within the same ceiling as the build.
        // This has to go through rolldownOptions: Vite 8 forwards only a few
        // optimizeDeps.esbuildOptions fields (minify, define, loader, ...) to
        // Rolldown, and `target` is not one of them -- setting it there is
        // silently discarded.
        rolldownOptions: {
            transform: {
                target: LEGACY_JS_TARGET,
            },
        },
    },
    server: {
        fs: {
            allow: [".."],
        },
        host: true,
        proxy: {
            "/api": {
                target: "http://localhost:5100/api",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
            },
        },
    },
});
