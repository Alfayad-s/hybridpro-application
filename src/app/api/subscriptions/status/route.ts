import { NextResponse } from 'next/server'
import { backendGetSubscription } from '@/lib/subscriptions/backend'
import { isInternalApiAuthorized } from '@/lib/subscriptions/internal-auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!isInternalApiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  try {
    const subscription = await backendGetSubscription({
      email: searchParams.get('email'),
      userId: searchParams.get('userId'),
    })
    return NextResponse.json({ subscription })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status failed' },
      { status: 502 }
    )
  }
}
