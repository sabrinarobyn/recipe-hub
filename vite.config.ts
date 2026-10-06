/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const REACT_CDN = "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js";
const REACT_DOM_CDN = "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js";

/**
 * Single-file build (for hosting as one HTML page): React comes from the
 * pinned UMD build on cdnjs instead of being bundled, so the page only
 * carries the app's own code and data.
 */
function reactFromCdn(): Plugin {
  const shims: Record<string, string> = {
    react: `const R = window.React; export default R;
      export const { useState, useEffect, useMemo, useRef, useCallback, useReducer, useContext,
        createContext, Fragment, StrictMode, useId, useLayoutEffect } = R;`,
    "react-dom": `export default window.ReactDOM;`,
    "react-dom/client": `export const createRoot = (...a) => window.ReactDOM.createRoot(...a);`,
    "react/jsx-runtime": `const R = window.React;
      export const Fragment = R.Fragment;
      export function jsx(type, props, key) {
        const { children, ...rest } = props;
        if (key !== undefined) rest.key = key;
        if (children === undefined) return R.createElement(type, rest);
        return Array.isArray(children) ? R.createElement(type, rest, ...children) : R.createElement(type, rest, children);
      }
      export const jsxs = jsx;`,
  };
  return {
    name: "react-from-cdn",
    enforce: "pre",
    resolveId(id) {
      return id in shims ? `\0cdn:${id}` : null;
    },
    load(id) {
      return id.startsWith("\0cdn:") ? shims[id.slice(5)] : null;
    },
    transformIndexHtml() {
      return [REACT_CDN, REACT_DOM_CDN].map((src) => ({ tag: "script", attrs: { src }, injectTo: "head" as const }));
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    base: "./",
    plugins: single ? [reactFromCdn(), react(), viteSingleFile()] : [react()],
    build: { outDir: single ? "dist-single" : "dist" },
    test: { environment: "node" },
  };
});
