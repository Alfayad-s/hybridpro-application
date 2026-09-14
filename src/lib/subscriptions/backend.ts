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

export async function backendGetSubscription(input: { email?: string | null; userId?: string | null }) {
  const params = new URLSearchParams()
  if (input.email) params.set('email', input.email)
  if (input.userId) params.set('userId', input.userId)
  const data = await backendFetch(`/api/subscriptions/status?${params}`)
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
