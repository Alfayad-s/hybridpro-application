import { redirect } from 'next/navigation'
import { checkoutUrl, isPricingPlanId } from '@/lib/subscriptions/plans'
import { createClient } from '@/utils/supabase/server'

export default async function ContinueCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { plan } = await searchParams
  if (!plan || !isPricingPlanId(plan)) {
    redirect('/?plans=1')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect(`/login?checkout=${plan}`)
  }

  redirect(
    checkoutUrl({
      planId: plan,
      email: user.email,
      userId: user.id,
    })
  )
}
