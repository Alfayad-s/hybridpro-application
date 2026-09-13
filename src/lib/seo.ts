import { BRAND, PRODUCTION_SITE_URL } from '@/lib/brand'

export function getSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return PRODUCTION_SITE_URL
}

export const SEO = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  url: PRODUCTION_SITE_URL,
  locale: 'en_IN',
  ogImage: {
    url: '/opengraph-image',
    width: 1200,
    height: 630,
    alt: `${BRAND.name} logo`,
  },
} as const

export function absoluteUrl(path = '/') {
  const base = PRODUCTION_SITE_URL.replace(/\/$/, '')
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: BRAND.name,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'iOS, Android, Web',
    url: PRODUCTION_SITE_URL,
    description: BRAND.description,
    image: absoluteUrl(BRAND.logo),
    screenshot: absoluteUrl('/landing/1.jpg'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      url: PRODUCTION_SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl(BRAND.logo),
      },
    },
  }
}
