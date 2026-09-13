import { softwareApplicationJsonLd } from '@/lib/seo'

export function JsonLd() {
  const json = softwareApplicationJsonLd()
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}
