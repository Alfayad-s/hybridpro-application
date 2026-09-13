import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MobileContainer } from '@/components/layout/MobileContainer'
import { BottomNavigation } from '@/components/layout/BottomNavigation'
import { MainShell } from '@/components/layout/MainShell'
import { RestTimer } from '@/components/workout/RestTimer'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { ServiceWorkerCleanup } from '@/components/theme/ServiceWorkerCleanup'
import { PwaRegister } from '@/components/pwa/PwaRegister'
import { SyncProvider } from '@/components/sync/SyncProvider'
import { HapticProvider } from '@/components/haptics/HapticProvider'
import { BRAND, PRODUCTION_SITE_URL } from '@/lib/brand'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : PRODUCTION_SITE_URL)

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: BRAND.name,
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  keywords: [...BRAND.keywords],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  category: 'fitness',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.shortName,
  },
  icons: {
    icon: [
      { url: BRAND.icons.png192, sizes: '192x192', type: 'image/png' },
      { url: BRAND.icons.png512, sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: BRAND.icons.apple, sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: [
      {
        url: BRAND.logo,
        width: 512,
        height: 512,
        alt: `${BRAND.name} logo`,
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: [BRAND.logo],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F4F6' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('gymtrack-theme');
    if (!stored) { document.documentElement.classList.add('dark'); return; }
    var parsed = JSON.parse(stored);
    var theme = parsed && parsed.state && parsed.state.theme;
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground selection:bg-primary/30`}
      >
        <ThemeProvider>
          <ServiceWorkerCleanup />
          <PwaRegister />
          <HapticProvider>
            <AuthProvider>
              <SyncProvider>
                <MobileContainer>
                  <MainShell>{children}</MainShell>
                  <RestTimer />
                  <BottomNavigation />
                </MobileContainer>
              </SyncProvider>
            </AuthProvider>
          </HapticProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
