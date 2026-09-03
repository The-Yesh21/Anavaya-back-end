// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";

// Serve the dev server over HTTPS whenever the app's self-signed certs exist
// (case_priority_system/certs/), so the landing page is a secure context too —
// microphone/video features on phones require https. Falls back to plain http
// on machines without the certs.
const certDir = path.resolve(process.cwd(), "case_priority_system/certs");
const certFile = path.join(certDir, "cert.pem");
const keyFile = path.join(certDir, "key.pem");
const httpsEnabled = fs.existsSync(certFile) && fs.existsSync(keyFile);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(httpsEnabled
    ? {
        vite: {
          server: {
            https: {
              key: fs.readFileSync(keyFile),
              cert: fs.readFileSync(certFile),
            },
          },
        },
      }
    : {}),
});
