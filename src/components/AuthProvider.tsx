import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentSession,
  getCurrentUser,
  getUserProfile,
  onAuthStateChange,
  signOut as authSignOut,
  type UserProfile,
} from "@/modules/supabase/auth";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  /** Current Supabase user (null while loading or if not authenticated) */
  user: User | null;
  /** Current Supabase session */
  session: Session | null;
  /** User profile from the `profiles` table */
  profile: UserProfile | null;
  /** True while the initial auth check is in progress */
  loading: boolean;
  /** True if user is authenticated */
  isAuthenticated: boolean;
  /** True if user has admin role */
  isAdmin: boolean;
  /** Sign out the current user */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const currentSession = await getCurrentSession();
        if (!alive) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          try {
            const userProfile = await getUserProfile(currentSession.user.id);
            if (alive) setProfile(userProfile);
          } catch {
            /* profile fetch is best-effort */
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    init();

    const unsubscribe = onAuthStateChange(async (_event, newSession) => {
      if (!alive) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        try {
          const userProfile = await getUserProfile(newSession.user.id);
          if (alive) setProfile(userProfile);
        } catch {
          /* ignore */
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: profile?.role === "admin",
      signOut: handleSignOut,
    }),
    [user, session, profile, loading, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth state.
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
