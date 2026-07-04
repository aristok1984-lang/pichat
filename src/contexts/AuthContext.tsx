'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OAUTH_PROVIDERS, OAuthProviderKey } from '@/lib/design-system';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Email / Password ──────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: metadata?.username || '',
          display_name: metadata?.displayName || metadata?.fullName || '',
          full_name: metadata?.fullName || metadata?.displayName || '',
          avatar_url: metadata?.avatarUrl || ''
        },
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      }
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  // ─── OAuth Providers ───────────────────────────────────────────────────────
  //
  // Architecture is prepared for Google OAuth and Apple Sign In.
  // To enable a provider:
  //   1. Configure the provider in your Supabase Dashboard → Authentication → Providers
  //   2. Set OAUTH_PROVIDERS[provider].enabled = true in src/lib/design-system.ts
  //   3. The UI buttons will automatically become active
  //
  // The redirect URL to register in each provider's OAuth console:
  //   https://pichat3932.builtwithrocket.new/auth/callback
  //   https://pichat.us/auth/callback

  const signInWithOAuth = async (provider: OAuthProviderKey) => {
    const config = OAUTH_PROVIDERS[provider];
    if (!config.enabled) {
      throw new Error(`${config.label} sign-in is not yet enabled.`);
    }
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: config.supabaseProvider,
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    signInWithOAuth,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    // Expose provider config so UI can check enabled state
    oauthProviders: OAUTH_PROVIDERS,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
