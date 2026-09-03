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

  // Load initial session
  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const currentSession = await getCurrentSession();
        if (!alive) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Fetch profile if user exists
        if (currentSession?.user) {
          const userProfile = await getUserProfile(currentSession.user.id);
          if (alive) setProfile(userProfile);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    init();

    return () => {
      alive = false;
    };
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const userProfile = await getUserProfile(newSession.user.id);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }

      // On initial SIGNED_IN or token refresh, ensure loading is false
      if (loading) setLoading(false);
    });

    return unsubscribe;
  }, [loading]);

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
