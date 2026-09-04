// Dashboard URL the CTA buttons point at. Locally this is the FastAPI app's
// https://127.0.0.1:8000; when the landing page is served through a public
// tunnel (localhost.run/ngrok) set VITE_APP_URL to the tunnel's https URL so
// remote visitors reach the dashboard too, e.g.:
//   VITE_APP_URL=https://xxxx.lhr.life npm run dev
export const APP_URL =
  import.meta.env["VITE_APP_URL"] ?? "https://127.0.0.1:8000";
export const GITHUB_URL = "https://github.com/The-Yesh21/Anavaya-back-end";
