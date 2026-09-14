import { NextResponse } from 'next/server'
import { backendGetPlans } from '@/lib/subscriptions/backend'
import { pricingPlans } from '@/lib/subscriptions/plans'

export async function GET() {
  try {
    return NextResponse.json(await backendGetPlans())
  } catch {
    return NextResponse.json({ plans: pricingPlans })
  }
}
