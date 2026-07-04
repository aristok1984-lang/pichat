'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';

interface OnboardingStep {
  id: number;
  emoji: string;
  title: string;
  description: string;
  gradient: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    emoji: '💬',
    title: 'Chat with Anyone',
    description: 'Send messages, share media, and stay connected with friends and communities in real time.',
    gradient: 'linear-gradient(135deg, #0E1621 0%, #17212B 60%, #1a2d42 100%)',
  },
  {
    id: 2,
    emoji: '📱',
    title: 'Share Your Moments',
    description: 'Post to your feed, create reels, and let the world see what you\'re up to.',
    gradient: 'linear-gradient(135deg, #0E1621 0%, #1a1730 60%, #1f1040 100%)',
  },
  {
    id: 3,
    emoji: '🌐',
    title: 'Join Communities',
    description: 'Find your tribe. Join communities around your interests and meet like-minded people.',
    gradient: 'linear-gradient(135deg, #0E1621 0%, #0d2218 60%, #0a2e1a 100%)',
  },
  {
    id: 4,
    emoji: '🤖',
    title: 'AI-Powered Chats',
    description: 'Chat with our built-in AI assistant for help, ideas, or just a conversation.',
    gradient: 'linear-gradient(135deg, #0E1621 0%, #17212B 60%, #1a2d42 100%)',
  },
];

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const router = useRouter();

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  function goNext() {
    if (animating) return;
    if (isLast) {
      handleComplete();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setCurrentStep((s) => s + 1);
      setAnimating(false);
    }, 250);
  }

  function handleComplete() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pichat_onboarded', 'true');
    }
    onComplete();
  }

  function handleSkip() {
    handleComplete();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-500"
      style={{ background: step.gradient }}
    >
      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-12 right-6 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors duration-150"
      >
        Skip
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 mb-12 animate-fade-in">
        <AppLogo size={32} />
        <span className="text-lg font-bold text-foreground">PiChat</span>
      </div>

      {/* Step content */}
      <div
        className="flex flex-col items-center text-center px-8 max-w-xs"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(12px)' : 'translateY(0)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        }}
      >
        {/* Emoji illustration */}
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center mb-8 text-6xl"
          style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}
        >
          {step.emoji}
        </div>

        <h2 className="text-2xl font-extrabold text-foreground mb-3 leading-tight">
          {step.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Dots */}
      <div className="flex gap-2 mt-12 mb-10">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => !animating && setCurrentStep(i)}
            className="transition-all duration-300"
            style={{
              width: i === currentStep ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i === currentStep ? 'var(--primary)' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={goNext}
        className="w-64 py-4 rounded-2xl text-base font-bold text-white transition-all duration-200 active:scale-95 hover:brightness-110"
        style={{ background: 'var(--primary)' }}
      >
        {isLast ? 'Get Started 🚀' : 'Continue'}
      </button>
    </div>
  );
}
