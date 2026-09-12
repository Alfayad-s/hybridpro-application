import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { completeGroqTextChat } from '@/lib/groq'
import { listReportsForUser } from '@/lib/body-composition/db'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reports = await listReportsForUser(user.id)
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const monthly = reports.filter(
    (r) => new Date(r.reportDate).getTime() >= monthAgo
  )

  if (monthly.length === 0) {
    return NextResponse.json(
      { error: 'Need at least one report in the last 30 days' },
      { status: 404 }
    )
  }

  try {
    const report = await completeGroqTextChat([
      {
        role: 'system',
        content: `You write Hybrid Pro monthly body composition summaries using ## markdown headings:
## Monthly Summary
## Overall Progress
## Muscle Gain
## Fat Loss
## Strength Recommendation
## Nutrition Recommendation
## Workout Recommendation
## Recovery Recommendation
## Motivational Insight

Rules: use ## headings only (never wrap titles in **asterisks**), short paragraphs and - bullets, bold key numbers inside sentences with **like this**. Be specific to the data. Under 650 words.`,
      },
      {
        role: 'user',
        content: `Reports (newest first):\n${JSON.stringify(monthly.slice(0, 8))}`,
      },
    ])
    return NextResponse.json({ report })
  } catch (error) {
    console.error('Monthly body composition report failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Monthly report failed' },
      { status: 503 }
    )
  }
}
