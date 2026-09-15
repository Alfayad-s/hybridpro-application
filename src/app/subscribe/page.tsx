import { redirect } from 'next/navigation'
import { LANDING_PLANS_PATH, LANDING_PLANS_UPGRADE_PATH } from '@/lib/subscriptions/plans'

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>
}) {
  const { upgrade } = await searchParams
  redirect(upgrade === 'performance' ? LANDING_PLANS_UPGRADE_PATH : LANDING_PLANS_PATH)
}
