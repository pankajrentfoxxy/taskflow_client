import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import Providers from '@/components/providers';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Internal task tracker with SLAs, escalations, projects and a drawing pad',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geistSans.variable, geistMono.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
