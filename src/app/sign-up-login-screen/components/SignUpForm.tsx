'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { OAUTH_PROVIDERS } from '@/lib/design-system';

interface SignUpFormData {
  displayName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

interface SignUpFormProps {
  onSwitchToLogin: () => void;
}

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

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" />
    </svg>
  );
}

export default function SignUpForm({ onSwitchToLogin }: SignUpFormProps) {
  const router = useRouter();
  const { signUp, signInWithOAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>();

  const passwordValue = watch('password');

  async function onSubmit(data: SignUpFormData) {
    setIsLoading(true);
    setAuthError(null);
    try {
      await signUp(data.email, data.password, {
        fullName: data.displayName,
        displayName: data.displayName,
        username: data.username,
      });
      router.push('/social-feed');
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
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

      {/* Display name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-foreground" htmlFor="signup-name">
          Display name
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          placeholder="Alex Morgan"
          className={`input-field ${errors.displayName ? 'error' : ''}`}
          {...register('displayName', {
            required: 'Display name is required',
            minLength: { value: 2, message: 'At least 2 characters' },
            maxLength: { value: 32, message: 'Max 32 characters' },
          })}
        />
        {errors.displayName && (
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{errors.displayName.message}</p>
        )}
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-foreground" htmlFor="signup-username">
          Username
        </label>
        <input
          id="signup-username"
          type="text"
          autoComplete="username"
          placeholder="alex_morgan"
          className={`input-field ${errors.username ? 'error' : ''}`}
          {...register('username', {
            required: 'Username is required',
            minLength: { value: 3, message: 'At least 3 characters' },
            maxLength: { value: 20, message: 'Max 20 characters' },
            pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Only letters, numbers, underscores' },
          })}
        />
        {errors.username && (
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{errors.username.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-foreground" htmlFor="signup-email">
          Email address
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
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
        <label className="block text-sm font-semibold text-foreground" htmlFor="signup-password">
          Password
        </label>
        <p className="text-xs text-muted-foreground">At least 8 characters with a number</p>
        <div className="relative">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Choose a strong password"
            className={`input-field pr-12 ${errors.password ? 'error' : ''}`}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' },
              pattern: { value: /(?=.*[0-9])/, message: 'Must contain at least one number' },
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

      {/* Confirm password */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-foreground" htmlFor="signup-confirm">
          Confirm password
        </label>
        <div className="relative">
          <input
            id="signup-confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat your password"
            className={`input-field pr-12 ${errors.confirmPassword ? 'error' : ''}`}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (v) => v === passwordValue || 'Passwords do not match',
            })}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showConfirm} />
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Terms */}
      <div className="space-y-1">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 mt-0.5 rounded accent-primary shrink-0"
            {...register('terms', { required: 'You must accept the terms to continue' })}
          />
          <span className="text-sm text-muted-foreground leading-relaxed">
            I agree to the{' '}
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>Terms of Service</span>
            {' '}and{' '}
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>Privacy Policy</span>
          </span>
        </label>
        {errors.terms && (
          <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{errors.terms.message}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary gradient-primary-btn"
        style={{ marginTop: '8px' }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2"><Spinner />Creating account…</span>
        ) : 'Create Account'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs text-muted-foreground font-medium">or sign up with</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn-social relative"
          onClick={() => handleOAuthSignIn('google')}
          disabled={oauthLoading === 'google'}
          aria-label="Sign up with Google"
          title={OAUTH_PROVIDERS.google.enabled ? 'Sign up with Google' : 'Google sign-up coming soon'}
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

        <button
          type="button"
          className="btn-social relative"
          onClick={() => handleOAuthSignIn('apple')}
          disabled={oauthLoading === 'apple'}
          aria-label="Sign up with Apple"
          title={OAUTH_PROVIDERS.apple.enabled ? 'Sign up with Apple' : 'Apple sign-up coming soon'}
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

      {/* Switch to login */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold transition-colors hover:underline"
          style={{ color: 'var(--primary)' }}
        >
          Sign in
        </button>
      </p>
    </form>
  );
}