import { createFileRoute, Navigate } from "@tanstack/react-router";

// Movements are now unified with the History page.
export const Route = createFileRoute("/_app/movements")({
  component: () => <Navigate to="/history" replace />,
});
