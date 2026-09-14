import { NextResponse } from 'next/server'
import { backendActivateSubscription } from '@/lib/subscriptions/backend'
import { isInternalApiAuthorized } from '@/lib/subscriptions/internal-auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isInternalApiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const result = await backendActivateSubscription(body as Record<string, unknown>)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not activate subscription' },
      { status: 502 }
    )
  }
}
