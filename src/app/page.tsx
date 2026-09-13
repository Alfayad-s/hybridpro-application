import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/LandingPage'
import { PRODUCTION_SITE_URL } from '@/lib/brand'
import { SEO } from '@/lib/seo'

export const metadata: Metadata = {
  title: { absolute: SEO.title },
  description: SEO.description,
  alternates: {
    canonical: PRODUCTION_SITE_URL,
  },
  openGraph: {
    url: PRODUCTION_SITE_URL,
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
}

export default function Home() {
  return <LandingPage />
}
