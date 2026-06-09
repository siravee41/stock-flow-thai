import { createFileRoute } from "@tanstack/react-router";
import { MovementForm } from "@/components/movement-form";
export const Route = createFileRoute("/_app/stock-out")({ component: () => <MovementForm mode="OUT" /> });
