import React from 'react';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { StudioProvider } from '../components/StudioProvider';
import { AppShell } from '../components/AppShell';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://clipforge.vercel.app'),
  title: 'ClipForge — Free On-Device Video, Audio & Photo Studio',
  description:
    'Private, zero-upload browser studio for AI background removal, video compression to exact MB, lossless trimming, MP4 to GIF, audio waveform videos, exact-KB image compression, and passport photos.',
  keywords: [
    'ai background remover local',
    'compress video to 10mb',
    'free online video trimmer',
    'mp4 to gif high quality',
    'extract audio from video',
    'compress image to 50kb',
    'passport photo maker 4x6',
    'audio to waveform video',
  ],
  openGraph: {
    title: 'ClipForge — Free On-Device Video, Audio & Photo Studio',
    description:
      'Private, zero-upload browser studio for AI background removal, exact-MB video compression, lossless trimming, MP4 to GIF, waveform audiograms, exact-KB image optimization, and passport photos.',
    url: 'https://clipforge.vercel.app',
    siteName: 'ClipForge',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClipForge — Free On-Device Video, Audio & Photo Studio',
    description:
      'Remove photo backgrounds with local AI, compress videos to exact MB, trim clips losslessly, and build 4x6 passport sheets right in your browser.',
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <body className="font-sans antialiased bg-canvas-100 text-ink-900">
        <StudioProvider>
          <AppShell>{children}</AppShell>
        </StudioProvider>
      </body>
    </html>
  );
}
