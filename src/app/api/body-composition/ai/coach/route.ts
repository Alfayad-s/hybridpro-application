import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { completeGroqTextChat } from '@/lib/groq'
import { getReportForUser, listReportsForUser } from '@/lib/body-composition/db'
import { formatRagContextBlock, retrieveRagChunks } from '@/lib/ai/rag'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { question?: string; reportId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  const reports = await listReportsForUser(user.id)
  const report =
    (body.reportId ? await getReportForUser(user.id, body.reportId) : null) ??
    reports[0] ??
    null
  if (!report) {
    return NextResponse.json({ error: 'Upload a report first' }, { status: 404 })
  }

  let ragBlock = ''
  let ragHits = 0
  try {
    const chunks = await retrieveRagChunks({ userId: user.id, query: question, topK: 5 })
    ragHits = chunks.length
    ragBlock = formatRagContextBlock(chunks, 2000)
  } catch {
    // continue without RAG
  }

  try {
    const answer = await completeGroqTextChat([
      {
        role: 'system',
        content: `You are Hybrid Pro AI Coach for body composition. Answer using the provided report data and any retrieved memory about prior scans. If the report lacks data, say so. Be concise, actionable, and personalized. No medical diagnosis disclaimers longer than one short sentence.

Formatting:
- For multi-part answers use ## Section Title headings (e.g. ## BMI Assessment, ## Muscle Balance, ## Recommendations)
- Use - bullet lists for actionable steps
- Bold key numbers with **like this** inside sentences only — never wrap titles in **asterisks**
- Short answers can be plain prose`,
      },
      {
        role: 'user',
        content: `Report JSON:\n${JSON.stringify(report)}\n\n${ragBlock ? `${ragBlock}\n\n` : ''}Question: ${question.slice(0, 500)}`,
      },
    ])
    return NextResponse.json({ answer, ragHits })
  } catch (error) {
    console.error('Body composition coach failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Coach unavailable' },
      { status: 503 }
    )
  }
}
