import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BRAND, PRODUCTION_SITE_URL } from '@/lib/brand'

export const alt = `${BRAND.name} — ${BRAND.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), 'public/company-logo.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  const host = PRODUCTION_SITE_URL.replace(/^https?:\/\//, '')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050505',
          backgroundImage:
            'radial-gradient(circle at 18% 18%, rgba(139,184,32,0.24), transparent 42%), radial-gradient(circle at 82% 78%, rgba(139,184,32,0.12), transparent 38%)',
        }}
      >
        <img
          src={logoSrc}
          width={200}
          height={200}
          alt=""
          style={{ borderRadius: 44, border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <div
          style={{
            marginTop: 36,
            fontSize: 72,
            fontWeight: 800,
            color: '#F4F4F6',
            letterSpacing: -2,
          }}
        >
          {BRAND.name}
        </div>
        <div style={{ marginTop: 10, fontSize: 32, color: '#8BB820', fontWeight: 600 }}>
          {BRAND.tagline}
        </div>
        <div style={{ marginTop: 22, fontSize: 22, color: '#9CA3AF' }}>{host}</div>
      </div>
    ),
    { ...size }
  )
}
