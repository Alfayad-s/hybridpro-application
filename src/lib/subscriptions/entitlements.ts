import { getPricingPlan, type PricingPlanId } from './plans'

export type SubscriptionFeature =
  | 'tracking'
  | 'meals'
  | 'meal_plans'
  | 'ai'
  | 'body_composition'
  | 'body_composition_ai'

const FEATURE_MIN_RANK: Record<SubscriptionFeature, number> = {
  tracking: 1,
  meals: 1,
  meal_plans: 2,
  ai: 2,
  body_composition: 2,
  body_composition_ai: 3,
}

export function canAccess(
  feature: SubscriptionFeature,
  planId: PricingPlanId | string | null | undefined
) {
  if (!planId) return false
  const plan = getPricingPlan(planId)
  if (!plan) return false
  return plan.rank >= FEATURE_MIN_RANK[feature]
}

export function planRank(planId: string | null | undefined) {
  return getPricingPlan(planId || '')?.rank ?? 0
}
