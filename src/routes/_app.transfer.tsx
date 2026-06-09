import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MovementForm } from "@/components/movement-form";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/transfer")({
  component: TransferPage,
});

function TransferPage() {
  const { profile } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (profile && profile.role === "staff") nav({ to: "/dashboard", replace: true });
  }, [profile, nav]);
  if (profile?.role === "staff") return null;
  return <MovementForm mode="TRANSFER" />;
}
