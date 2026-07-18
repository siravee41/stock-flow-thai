import { createFileRoute, Navigate } from "@tanstack/react-router";

// Catalog is now unified with the Products page.
export const Route = createFileRoute("/_app/catalog")({
  component: () => <Navigate to="/products" replace />,
});
