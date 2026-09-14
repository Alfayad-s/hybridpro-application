import { timingSafeEqual } from 'crypto'

export function isInternalApiAuthorized(request: Request) {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) return false

  const header = request.headers.get('authorization') || ''
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : request.headers.get('x-internal-api-secret')?.trim() || ''

  if (!token) return false

  const expected = Buffer.from(secret)
  const received = Buffer.from(token)
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
