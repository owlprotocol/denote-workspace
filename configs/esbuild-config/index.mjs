import { NodeResolvePlugin } from "@esbuild-plugins/node-resolve";
import { globSync } from "glob";
import * as esbuild from "esbuild";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const filesCts = globSync("src/**/*.{ts,cts,tsx,json}");
const filesMts = globSync("src/**/*.{ts,mts,tsx,json}");

const excludeNodeModulesPlugin = NodeResolvePlugin({
    extensions: [".ts", ".js", ".json"],
    onResolved: (resolved) => {
        // console.debug(resolved)
        if (resolved.includes("node_modules")) {
            return {
                external: true,
            };
        }
        return resolved;
    },
});

const ESBUILD_WATCH = process.env.ESBUILD_WATCH === "true" || process.env.ESBUILD_WATCH === "1";

const external = ["url", "events", "path"];
const inject = []; // ['./react-shim.mjs']

export const baseConfig = {
    sourcemap: "external",
    platform: "neutral",
    target: ["es2020"],
    inject,
    plugins: [excludeNodeModulesPlugin],
};

// CJS Library (Testing)
export const cjsLibConfig = {
    entryPoints: filesCts,
    bundle: false,
    outdir: "_cjs/lib",
    // outExtension: { '.js': '.cjs' },
    format: "cjs",
    ...baseConfig,
};

// ESM Library
export const esmLibConfig = {
    entryPoints: filesMts,
    bundle: false,
    outdir: "_esm/lib",
    format: "esm",
    ...baseConfig,
};

// CJS Bundle
export const cjsBundleConfig = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: false,
    outfile: "_cjs/dist/index.cjs",
    format: "cjs",
    external,
    ...baseConfig,
};

export const cjsBundleMinConfig = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    outfile: "_esm/dist/index.min.cjs",
    format: "cjs",
    external,
    ...baseConfig,
};

// ESM Bundle
export const esmBundleConfig = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: false,
    outfile: "_esm/dist/index.mjs",
    format: "esm",
    external,
    ...baseConfig,
};

export const esmBundleMinConfig = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    outfile: "_esm/dist/index.min.mjs",
    format: "esm",
    external,
    ...baseConfig,
};

export const libConfigs = [cjsLibConfig, esmLibConfig];

export const distConfigs = [cjsBundleConfig, cjsBundleMinConfig, esmBundleConfig, esmBundleMinConfig];

export const configs = [...libConfigs, ...distConfigs];

export async function buildConfig(c) {
    // Write package.json
    if (!c.bundle) {
        const dir = c.outdir;
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        const p = join(dir, "package.json");
        if (!existsSync(p)) {
            const type = c.format === "esm" ? "module" : "commonjs";
            writeFileSync(p, JSON.stringify({ type }), "utf-8");
        }
    }

    if (!ESBUILD_WATCH) {
        // Static build
        await esbuild.build(c);
    }
    else {
        // Incremental build
        const ctx = await esbuild.context(c);
        await ctx.watch();
    }
}

export function buildLibESM() {
    return buildConfig(esmLibConfig);
}

export function buildLibCJS() {
    return buildConfig(cjsLibConfig);
}

export function buildDistESM() {
    return buildConfig(esmBundleConfig);
}

export function buildDistCJS() {
    return buildConfig(cjsBundleConfig);
}

export function buildLib() {
    // Write package.json
    return Promise.all(libConfigs.map(buildConfig));
}

export function buildDist() {
    return Promise.all(distConfigs.map(buildConfig));
}

export function buildAll() {
    return Promise.all(configs.map(buildConfig));
}
