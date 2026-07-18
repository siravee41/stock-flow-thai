import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile, Role, BranchId } from "./firebase";

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (args: {
    email: string; password: string; name: string;
    role: Role; branchId: BranchId | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function loadProfile(u: User): Promise<UserProfile> {
  // Fetch profile row (auto-created by trigger)
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, email, name, created_at")
    .eq("id", u.id)
    .maybeSingle();

  // Fetch primary role + branch
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role, branch_id")
    .eq("user_id", u.id);

  let role: Role = "staff";
  let branchId: BranchId | null = null;
  if (roles && roles.length > 0) {
    const owner = roles.find((r) => r.role === "owner");
    if (owner) {
      role = "owner";
      branchId = null;
    } else {
      const primary = roles[0];
      role = primary.role as Role;
      branchId = (primary.branch_id ?? null) as BranchId | null;
    }
  }

  return {
    uid: u.id,
    email: prof?.email ?? u.email ?? "",
    name: prof?.name ?? u.email?.split("@")[0] ?? "User",
    role,
    branchId,
    createdAt: prof?.created_at ? new Date(prof.created_at).getTime() : Date.now(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: Session | null) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        try {
          const p = await loadProfile(u);
          if (mounted) setProfile(p);
        } catch (e) {
          console.error("Failed to load profile:", e);
          if (mounted) {
            setProfile({
              uid: u.id,
              email: u.email ?? "",
              name: u.email?.split("@")[0] ?? "User",
              role: "staff",
              branchId: null,
              createdAt: Date.now(),
            });
          }
        }
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    };

    // Setup listener first, then read initial session.
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      // defer async work to avoid deadlocks
      setTimeout(() => { handleSession(session); }, 0);
    });
    supabase.auth.getSession().then(({ data }) => handleSession(data.session));

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const value: AuthCtx = {
    user, profile, loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signInWithGoogle: async () => {
      const { lovable } = await import("@/integrations/lovable");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message || "Google sign-in failed");
    },
    signUp: async ({ email, password, name, role, branchId }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name },
        },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) return;

      // Check if this is the first user (no user_roles rows exist)
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true });
      const isFirst = (count ?? 0) === 0;
      const finalRole: Role = isFirst ? "owner" : role;
      const finalBranch = finalRole === "owner" ? null : branchId;

      await supabase.from("user_roles").insert({
        user_id: uid,
        role: finalRole,
        branch_id: finalBranch,
      });
    },
    logout: async () => { await supabase.auth.signOut(); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
