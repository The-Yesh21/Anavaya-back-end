import { defineConfig, loadEnv } from "vite";
import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Serve the dev server over HTTPS whenever the app's self-signed certs exist
// (case_priority_system/certs/), so the landing page is a secure context too —
// microphone/video features on phones require https. Falls back to plain http
// on machines without the certs.
const certDir = path.resolve(process.cwd(), "case_priority_system/certs");
const certFile = path.join(certDir, "cert.pem");
const keyFile = path.join(certDir, "key.pem");
const httpsEnabled = fs.existsSync(certFile) && fs.existsSync(keyFile);

export default defineConfig(({ mode, command }) => {
  // Expose VITE_*-prefixed vars as import.meta.env.* at build time.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
  );

  return {
    define,
    css: { transformer: "lightningcss" },
    server: {
      host: "::",
      port: 8080,
      ...(httpsEnabled
        ? { https: { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) } }
        : {}),
    },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      // A second copy of React or the query client silently breaks hooks and cache identity.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    // Order matters: tailwind and path resolution must run before TanStack Start
    // generates the route tree and server entry, and React last.
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        server: { entry: "server" },
        // Keep server-only modules out of the client bundle.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(command === "build" ? [nitro()] : []),
      viteReact(),
    ],
  };
});
