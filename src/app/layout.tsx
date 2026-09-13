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
import { ActionLoadingProvider } from '@/components/feedback/ActionLoading'
import { JsonLd } from '@/components/seo/JsonLd'
import { BRAND, PRODUCTION_SITE_URL } from '@/lib/brand'
import { SEO } from '@/lib/seo'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_SITE_URL),
  applicationName: BRAND.name,
  title: {
    default: SEO.title,
    template: `%s · ${BRAND.name}`,
  },
  description: SEO.description,
  keywords: [...BRAND.keywords],
  authors: [{ name: BRAND.name, url: PRODUCTION_SITE_URL }],
  creator: BRAND.name,
  publisher: BRAND.name,
  category: 'fitness',
  alternates: {
    canonical: PRODUCTION_SITE_URL,
    types: {
      'text/markdown': [
        { url: '/llms.txt', title: 'llms.txt' },
        { url: '/full-llms.txt', title: 'full-llms.txt' },
      ],
    },
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.shortName,
  },
  icons: {
    icon: [
      { url: BRAND.logo, type: 'image/png' },
      { url: BRAND.icons.png192, sizes: '192x192', type: 'image/png' },
      { url: BRAND.icons.png512, sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: BRAND.icons.apple, sizes: '180x180', type: 'image/png' }],
    shortcut: BRAND.logo,
  },
  openGraph: {
    type: 'website',
    locale: SEO.locale,
    url: PRODUCTION_SITE_URL,
    siteName: BRAND.name,
    title: SEO.title,
    description: SEO.description,
    images: [SEO.ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO.title,
    description: SEO.description,
    images: [SEO.ogImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
        <link rel="describedby" href="/llms.txt" />
        <link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM index" />
        <link rel="alternate" type="text/markdown" href="/full-llms.txt" title="LLM full context" />
        <JsonLd />
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
                  <ActionLoadingProvider>
                    <MainShell>{children}</MainShell>
                    <RestTimer />
                    <BottomNavigation />
                  </ActionLoadingProvider>
                </MobileContainer>
              </SyncProvider>
            </AuthProvider>
          </HapticProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
