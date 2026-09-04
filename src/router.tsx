import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Matches vite.config.ts `base`: VITE_BASE=/landing/ in remote single-URL
  // mode (dashboard owns the root), default "/" for local dev.
  const basepath = import.meta.env["VITE_BASE"] ?? "/";

  const router = createRouter({
    routeTree,
    context: { queryClient },
    basepath,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
