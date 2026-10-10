import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import appCss from "../styles.css?url";
import { THEME_INIT_SCRIPT } from "../components/landing/ThemeToggle";
import { Preloader } from "../components/preloader/Preloader";

// First-paint preloader guard. Preloader.tsx can only mount AFTER hydration, so
// on a first visit the landing used to paint first and the curtain arrived a beat
// later — badly visible over a tunnel, where the JS takes a moment.
//
// This runs inline, before the body paints, and on a first visit injects a small
// stylesheet: a paper curtain on <html>::before/::after with #page-root hidden.
// A stylesheet — not an attribute or class on <html>/<body> — because those nodes
// are React-managed: marking them here makes hydration see a DOM that does not
// match the server HTML, and React reports a hydration mismatch on every first
// visit. The Preloader removes the <style> once its own curtain is painted (same
// paper colour, so the handover is invisible), and a timeout removes it too, so a
// failed bundle can never leave a blank page — the guard fails open.
const PRELOADER_BOOT = `(function(){var K='anvaya-preloader-seen';var first=true;try{first=sessionStorage.getItem(K)!=='1';}catch(e){first=true;}if(!first)return;var css="html{background:#FBF8F2}#page-root{visibility:hidden}html::before,html::after{content:'';position:fixed;top:0;bottom:0;width:50%;background:#FBF8F2;z-index:2147483000;pointer-events:none}html::before{left:0;border-right:1px solid rgba(201,162,74,0.45)}html::after{right:0}";var s=document.createElement('style');s.id='anavaya-preloader-curtain';s.textContent=css;document.head.appendChild(s);window.__anavayaPreloaderBoot=true;window.clearTimeout(window.__anavayaPreloaderTimer);window.__anavayaPreloaderTimer=window.setTimeout(function(){if(window.__anavayaPreloaderBoot){var e=document.getElementById('anavaya-preloader-curtain');if(e)e.remove();}},6000);})();`;

const ROOT_TITLE = "Anavaya — AI-Powered Judicial Case Priority System";
// Same base the vite server runs on (VITE_BASE=/landing/ on the tunnel stack).
// MUST read import.meta.env, not process.env: the browser has no process.env, so
// a process.env read evaluates to "/" on the client, and hydration then injects a
// SECOND set of bare /favicon.* links next to the SSR's base-prefixed ones (both
// non-functional at the origin root under a sub-path base). Mirrors src/router.tsx.
const LANDING_BASE = import.meta.env["VITE_BASE"] ?? "/";
const ROOT_DESCRIPTION =
  "Anavaya triages FIRs, complaints, and court documents into High, Medium, and Low priority in seconds — deterministic, auditable, and grounded in the Constitution of India.";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: ROOT_TITLE },
      { name: "description", content: ROOT_DESCRIPTION },
      { name: "author", content: "Anavaya" },
      { name: "theme-color", content: "#8C6D18" },
      { property: "og:title", content: ROOT_TITLE },
      { property: "og:description", content: ROOT_DESCRIPTION },
      { property: "og:site_name", content: "Anavaya" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,500;1,700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Base-relative: under VITE_BASE=/landing/ the absolute /favicon.svg
      // would 404 at the origin root — prefix the base the dev/prod server runs under.
      { rel: "icon", href: `${LANDING_BASE}favicon.svg`, type: "image/svg+xml" },
      { rel: "icon", href: `${LANDING_BASE}favicon.ico`, sizes: "32x32" },
      { rel: "apple-touch-icon", href: `${LANDING_BASE}apple-touch-icon.png` },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_BOOT }} />

      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Preloader />
      {/* The preloader timeline scales this wrapper as the curtain splits.
          transformOrigin is matched inside usePreloaderTimeline. */}
      <div id="page-root" style={{ transformOrigin: "50% 50%" }}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}
