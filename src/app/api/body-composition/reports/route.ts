import { NextResponse } from 'next/server'
import { requireFeature } from '@/lib/subscriptions/require-feature'
import { BodyCompositionExtractSchema } from '@/lib/body-composition/types'
import { insertReport, listReportsForUser } from '@/lib/body-composition/db'
import { db } from '@/db'
import { notifications } from '@/db/schema'

export const runtime = 'nodejs'

export async function GET() {
  const gate = await requireFeature('body_composition')
  if (!gate.ok) return gate.response
  const { user } = gate

  try {
    const reports = await listReportsForUser(user.id)
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('List body composition reports failed:', error)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const gate = await requireFeature('body_composition')
  if (!gate.ok) return gate.response
  const { user } = gate

  let body: {
    extract?: unknown
    pdfUrl?: string | null
    imageUrl?: string | null
    rawText?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodyCompositionExtractSchema.safeParse(body.extract)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid report payload' }, { status: 400 })
  }

  try {
    const report = await insertReport({
      userId: user.id,
      extract: parsed.data,
      pdfUrl: body.pdfUrl ?? null,
      imageUrl: body.imageUrl ?? null,
      rawText: body.rawText ?? null,
    })

    try {
      await db.insert(notifications).values({
        userId: user.id,
        title: 'New report analyzed',
        body: 'Your body composition report is ready to review.',
        type: 'body_composition',
      })
    } catch {
      // non-fatal
    }

    try {
      const { formatDateKey, autoCompleteMatching } = await import('@/lib/challenges/db')
      await autoCompleteMatching(user.id, formatDateKey(new Date()), (c) => {
        const hay = `${c.title} ${c.description}`.toLowerCase()
        return /bia|body composition|inbody/i.test(hay)
      })
    } catch {
      // non-fatal
    }

    try {
      const { indexDocument, formatBodyCompositionChunk } = await import('@/lib/ai/rag')
      const chunk = formatBodyCompositionChunk({
        id: report.id,
        reportDate: report.reportDate,
        weight: report.weight,
        bodyFatPercent: report.bodyFatPercent,
        skeletalMuscleMass: report.skeletalMuscleMass,
        bmi: report.bmi,
        bodyScore: report.bodyScore,
        visceralFat: report.visceralFat,
        bmr: report.bmr,
      })
      void indexDocument({
        userId: user.id,
        sourceType: 'body_composition',
        sourceId: report.id,
        chunks: [chunk],
      }).catch((err) => console.warn('RAG index body composition failed:', err))
    } catch {
      // non-fatal
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Save body composition report failed:', error)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}
