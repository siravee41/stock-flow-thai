import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, type User,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, getDocs, collection,
} from "firebase/firestore";
import { auth, db, type UserProfile, type Role, type BranchId } from "./firebase";

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (args: {
    email: string; password: string; name: string;
    role: Role; branchId: BranchId | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setProfile(snap.data() as UserProfile);
        else setProfile(null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value: AuthCtx = {
    user, profile, loading,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUp: async ({ email, password, name, role, branchId }) => {
      // If no users exist at all, force first user to be owner
      const usersSnap = await getDocs(collection(db, "users"));
      const isFirst = usersSnap.empty;
      const finalRole: Role = isFirst ? "owner" : role;
      const finalBranch: BranchId | null = finalRole === "owner" ? null : branchId;

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const prof: UserProfile = {
        uid: cred.user.uid,
        email,
        name,
        role: finalRole,
        branchId: finalBranch,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "users", cred.user.uid), prof);
      setProfile(prof);
    },
    logout: async () => { await signOut(auth); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
