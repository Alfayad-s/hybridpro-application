import { NextResponse } from 'next/server'
import { requireFeature } from '@/lib/subscriptions/require-feature'
import { completeGroqTextChat } from '@/lib/ai/complete'
import {
  getReportForUser,
  listReportsForUser,
  updateReportAnalysis,
} from '@/lib/body-composition/db'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const gate = await requireFeature('body_composition_ai')
  if (!gate.ok) return gate.response
  const { user } = gate

  let body: { reportId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const reports = await listReportsForUser(user.id)
  const current =
    (body.reportId ? await getReportForUser(user.id, body.reportId) : null) ??
    reports[0] ??
    null
  if (!current) {
    return NextResponse.json({ error: 'No report found' }, { status: 404 })
  }
  const previous = reports.find((r) => r.id !== current.id) ?? null

  try {
    const analysis = await completeGroqTextChat([
      {
        role: 'system',
        content: `You are Hybrid Pro's body composition coach. Write a personalized analysis using these exact markdown headings (## Title), in this order when data allows:

## Overall Health
## BMI Assessment
## Muscle Balance
## Fat Distribution
## Body Composition Summary
## Training Recommendations
## Recovery Suggestions
## Nutrition Suggestions
## Risk Factors
## Improvement Priority

Rules:
- Use ## headings only (never wrap titles in **asterisks**)
- Use short paragraphs and - bullet lists
- Bold key numbers with **like this** inside sentences only
- Be specific to the report numbers (include BMI value and category under BMI Assessment)
- Keep under 700 words
- Skip a section only if there is truly no relevant data`,
      },
      {
        role: 'user',
        content: `Current report:\n${JSON.stringify(current, null, 2)}\n\nPrevious report:\n${
          previous ? JSON.stringify(previous, null, 2) : 'none'
        }`,
      },
    ])

    await updateReportAnalysis(user.id, current.id, analysis)
    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Body composition analysis failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 503 }
    )
  }
}
