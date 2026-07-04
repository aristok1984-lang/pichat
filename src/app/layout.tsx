import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter, League_Spartan } from 'next/font/google';
import '../styles/tailwind.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import PWARegister from '@/components/PWARegister';
import PageTransition from '@/components/PageTransition';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-league-spartan',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2AABEE',
};

export const metadata: Metadata = {
  title: 'PiChat — Messaging & Social in One Place',
  description: 'PiChat brings real-time messaging and a social feed together — chat with anyone, share moments, and stay connected all from one app.',
  keywords: ['messaging', 'social', 'chat', 'communities', 'reels', 'feed', 'PiChat'],
  authors: [{ name: 'PiChat' }],
  creator: 'PiChat',
  publisher: 'PiChat',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://pichat3932.builtwithrocket.new'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://pichat3932.builtwithrocket.new',
    title: 'PiChat — Messaging & Social in One Place',
    description: 'PiChat brings real-time messaging and a social feed together — chat with anyone, share moments, and stay connected all from one app.',
    siteName: 'PiChat',
    images: [
      {
        url: '/assets/images/app_logo.png',
        width: 512,
        height: 512,
        alt: 'PiChat logo — messaging and social app',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PiChat — Messaging & Social in One Place',
    description: 'PiChat brings real-time messaging and a social feed together — chat with anyone, share moments, and stay connected all from one app.',
    images: ['/assets/images/app_logo.png'],
  },
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/icons/icon-192x192.png' }],
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${inter.variable} ${leagueSpartan.variable}`}>
      <head>

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fpichat3932back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.19" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></head>
      <body className={`${inter.className}`}>
        <AuthProvider>
          <PageTransition>
            {children}
          </PageTransition>
        </AuthProvider>
        <PWARegister />
        <Toaster position="top-center" toastOptions={{ style: { background: '#1e1e2e', color: '#fff', border: '1px solid #333' } }} />
      </body>
    </html>
  );
}