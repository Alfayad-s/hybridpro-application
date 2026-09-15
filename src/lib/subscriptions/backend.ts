const DEFAULT_BACKEND_URL = process.env.HYBRID_BACKEND_URL?.trim().replace(/\/$/, '') || 'http://localhost:3002'

function internalHeaders() {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is missing. Use the same secret as Hybrid Pro Backend.')
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
  }
}

async function backendFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${DEFAULT_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...internalHeaders(),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Backend ${res.status}`)
  }
  return data
}

export async function backendGetPlans() {
  return backendFetch('/api/subscriptions/plans')
}

export async function backendGetPlan(input: { email?: string | null; userId?: string | null }) {
  const params = new URLSearchParams()
  if (input.email) params.set('email', input.email)
  if (input.userId) params.set('userId', input.userId)
  const query = params.toString()

  try {
    return await backendFetch(`/api/subscriptions/plan?${query}`)
  } catch (planError) {
    console.error('[backendGetPlan] plan', planError)
    const data = await backendFetch(`/api/subscriptions/status?${query}`)
    const subscription = (data.subscription ?? null) as {
      planId?: string | null
      planName?: string | null
      status?: string | null
      expiresAt?: string | null
    } | null
    const active = Boolean(
      subscription &&
        subscription.status === 'active' &&
        (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() > Date.now()),
    )
    const daysRemaining =
      active && subscription?.expiresAt
        ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 86_400_000))
        : null
    return {
      active,
      planId: active ? subscription?.planId ?? null : null,
      planName: active ? subscription?.planName ?? null : null,
      expiresAt: subscription?.expiresAt ?? null,
      daysRemaining,
      subscription,
    }
  }
}

export async function backendGetSubscription(input: { email?: string | null; userId?: string | null }) {
  const data = await backendGetPlan(input)
  return data.subscription ?? null
}

export async function backendAttachSubscription(input: { userId: string; email: string }) {
  const data = await backendFetch('/api/subscriptions/attach', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.subscription ?? null
}

export async function backendActivateSubscription(payload: Record<string, unknown>) {
  return backendFetch('/api/subscriptions/activate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
