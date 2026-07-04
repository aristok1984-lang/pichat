'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { OAUTH_PROVIDERS } from '@/lib/design-system';

interface LoginFormData {
  email: string;
  password: string;
  remember: boolean;
}

interface ResetFormData {
  resetEmail: string;
}

interface LoginFormProps {
  onSwitchToSignup: () => void;
}

// ─── Eye icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" />
    </svg>
  );
}

export default function LoginForm({ onSwitchToSignup }: LoginFormProps) {
  const router = useRouter();
  const { signIn, resetPassword, signInWithOAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', remember: false },
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm<ResetFormData>();

  useEffect(() => {
    function handleDemoFill(e: Event) {
      const { email, password } = (e as CustomEvent).detail;
      setValue('email', email);
      setValue('password', password);
    }
    window.addEventListener('pichat-demo-fill', handleDemoFill);
    return () => window.removeEventListener('pichat-demo-fill', handleDemoFill);
  }, [setValue]);

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    setAuthError(null);
    try {
      await signIn(data.email, data.password);
      router.push('/social-feed');
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  }

  async function onResetSubmit(data: ResetFormData) {
    setResetLoading(true);
    setResetError(null);
    try {
      await resetPassword(data.resetEmail);
      setResetSent(true);
    } catch (err: any) {
      setResetError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleOAuthSignIn(provider: 'google' | 'apple') {
    const config = OAUTH_PROVIDERS[provider];
    if (!config.enabled) {
      setAuthError(`${config.label} sign-in is coming soon.`);
      return;
    }
    setOauthLoading(provider);
    setAuthError(null);
    try {
      await signInWithOAuth(provider);
    } catch (err: any) {
      setAuthError(err?.message || `${config.label} sign-in failed`);
      setOauthLoading(null);
    }
  }

  // ─── Password Reset: Success ───────────────────────────────────────────────
  if (showReset && resetSent) {
    return (
      <div className="space-y-4 text-center py-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'rgba(99,102,241,0.15)' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--primary)' }}>
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">Check your email</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a password reset link to your email. Click the link to set a new password.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowReset(false); setResetSent(false); }}
          className="btn-primary gradient-primary-btn"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  // ─── Password Reset: Form ──────────────────────────────────────────────────
  if (showReset) {
    return (
      <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-4">
        <div className="text-center mb-2">
          <h3 className="text-base font-bold text-foreground">Reset your password</h3>
          <p className="text-xs text-muted-foreground mt-1">Enter your email and we'll send you a reset link.</p>
        </div>

        {resetError && (
          <div
            className="p-3 text-sm font-medium animate-fade-in"
            style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}
          >
            {resetError}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-foreground" htmlFor="reset-email">
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="you@pichat.app"
            className={`input-field ${resetErrors.resetEmail ? 'error' : ''}`}
            {...registerReset('resetEmail', {
              required: 'Email is required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
            })}
          />
          {resetErrors.resetEmail && (
            <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{resetErrors.resetEmail.message}</p>
          )}
        </div>

        <button type="submit" disabled={resetLoading} className="btn-primary gradient-primary-btn">
          {resetLoading ? (
            <span className="flex items-center justify-center gap-2"><Spinner />Sending…</span>
          ) : 'Send Reset Link'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setShowReset(false)}
            className="font-semibold transition-colors hover:underline"
            style={{ color: 'var(--primary)' }}
          >
            Back to Sign In
          </button>
        </p>
      </form>
    );
  }

  // ─── Main Login Form ───────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {authError && (
        <div
          className="p-3 text-sm font-medium animate-fade-in"
          style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}
        >
          {authError}
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-foreground" htmlFor="login-email">
          Email address
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@pichat.app"
          className={`input-field ${errors.email ? 'error' : ''}`}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
          })}
        />
        {errors.email && (
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-foreground" htmlFor="login-password">
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-xs font-medium transition-colors hover:text-foreground"
            style={{ color: 'var(--primary)' }}
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`input-field pr-12 ${errors.password ? 'error' : ''}`}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'Minimum 6 characters' },
            })}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        {errors.password && (
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{errors.password.message}</p>
        )}
      </div>

      {/* Remember me */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 rounded accent-primary" {...register('remember')} />
        <span className="text-sm text-muted-foreground">Keep me signed in</span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary gradient-primary-btn"
        style={{ marginTop: '8px' }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2"><Spinner />Signing in…</span>
        ) : 'Sign In to PiChat'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs text-muted-foreground font-medium">or continue with</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* OAuth Buttons — architecturally prepared, visually present, disabled until enabled */}
      <div className="grid grid-cols-2 gap-3">
        {/* Google */}
        <button
          type="button"
          className="btn-social relative"
          onClick={() => handleOAuthSignIn('google')}
          disabled={oauthLoading === 'google'}
          aria-label="Continue with Google"
          title={OAUTH_PROVIDERS.google.enabled ? 'Continue with Google' : 'Google sign-in coming soon'}
        >
          {oauthLoading === 'google' ? (
            <Spinner />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>Google</span>
          {!OAUTH_PROVIDERS.google.enabled && (
            <span
              className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 py-0.5 leading-none"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: '4px' }}
            >
              Soon
            </span>
          )}
        </button>

        {/* Apple */}
        <button
          type="button"
          className="btn-social relative"
          onClick={() => handleOAuthSignIn('apple')}
          disabled={oauthLoading === 'apple'}
          aria-label="Continue with Apple"
          title={OAUTH_PROVIDERS.apple.enabled ? 'Continue with Apple' : 'Apple sign-in coming soon'}
        >
          {oauthLoading === 'apple' ? (
            <Spinner />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          )}
          <span>Apple</span>
          {!OAUTH_PROVIDERS.apple.enabled && (
            <span
              className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 py-0.5 leading-none"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: '4px' }}
            >
              Soon
            </span>
          )}
        </button>
      </div>

      {/* Switch to signup */}
      <p className="text-center text-sm text-muted-foreground">
        No account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-semibold transition-colors hover:underline"
          style={{ color: 'var(--primary)' }}
        >
          Create one
        </button>
      </p>
    </form>
  );
}