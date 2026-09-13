import type { MetadataRoute } from 'next'
import { PRODUCTION_SITE_URL } from '@/lib/brand'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/llms.txt', '/full-llms.txt', '/llms-full.txt', '/sitemap.xml', '/opengraph-image'],
      disallow: [
        '/api/',
        '/auth/',
        '/login',
        '/forgot-password',
        '/dashboard',
        '/workout',
        '/profile',
        '/settings',
        '/plans',
        '/exercises',
        '/exercise',
        '/meals',
        '/meal-plans',
        '/recovery',
        '/calendar',
        '/challenges',
        '/personal-records',
        '/body-composition',
        '/ai',
        '/muscle-groups',
        '/history',
        '/progress',
      ],
    },
    sitemap: `${PRODUCTION_SITE_URL}/sitemap.xml`,
    host: PRODUCTION_SITE_URL,
  }
}
