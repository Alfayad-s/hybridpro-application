import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/LandingPage'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
}

export default function Home() {
  return <LandingPage />
}
