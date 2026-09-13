import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { completeGroqTextChat, completeGroqVisionChat } from '@/lib/ai/complete'
import { extractDocumentText } from '@/lib/ocr/extract-text'
import { bodyCompositionPreviewUrl } from '@/lib/cloudinary'
import { EXTRACT_JSON_PROMPT } from '@/lib/body-composition/types'
import {
  parseBodyCompositionJson,
  scoreExtractCompleteness,
} from '@/lib/body-composition/parse-report'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { fileUrl?: string; kind?: 'image' | 'pdf' }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : ''
  const kind = body.kind === 'pdf' ? 'pdf' : 'image'
  if (!fileUrl) {
    return NextResponse.json({ error: 'fileUrl is required' }, { status: 400 })
  }

  try {
    let buffer: Buffer | undefined
    try {
      const res = await fetch(fileUrl)
      if (res.ok) buffer = Buffer.from(await res.arrayBuffer())
    } catch {
      // continue without buffer — vision path still works
    }

    const { rawText, method } = await extractDocumentText({
      url: fileUrl,
      kind,
      buffer,
    })

    const preview = bodyCompositionPreviewUrl(fileUrl, kind)
    const candidates: Array<{
      extract: NonNullable<ReturnType<typeof parseBodyCompositionJson>>
      source: string
    }> = []

    // Path A: OCR text → structured JSON
    if (rawText.length >= 40) {
      try {
        const jsonRaw = await completeGroqTextChat([
          { role: 'system', content: EXTRACT_JSON_PROMPT },
          {
            role: 'user',
            content: `Extract body composition fields from this OCR text. Be precise — match labels to values carefully.\n\n${rawText.slice(0, 14000)}`,
          },
        ])
        const extracted = parseBodyCompositionJson(jsonRaw)
        if (extracted) candidates.push({ extract: extracted, source: 'text' })
      } catch (err) {
        console.warn('Text extract failed:', err)
      }
    }

    // Path B: vision → JSON directly from preview (more reliable for photos / bad PDF text)
    try {
      const visionJson = await completeGroqVisionChat(
        [
          { role: 'system', content: EXTRACT_JSON_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Extract all body composition metrics from this InBody/BIA report image. Read labels carefully — do not confuse PBF (%) with BFM (kg), or SMM with weight.',
              },
              { type: 'image_url', image_url: { url: preview } },
            ],
          },
        ],
        { maxTokens: 2000, temperature: 0.1 }
      )
      const extracted = parseBodyCompositionJson(visionJson)
      if (extracted) candidates.push({ extract: extracted, source: 'vision' })
    } catch (err) {
      console.warn('Vision extract failed:', err)
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not extract metrics from this report. Try a clearer photo of the full InBody page, or a higher-quality PDF.',
          rawText,
          method,
        },
        { status: 422 }
      )
    }

    // Prefer the more complete extract (vision often wins on photos)
    candidates.sort(
      (a, b) => scoreExtractCompleteness(b.extract) - scoreExtractCompleteness(a.extract)
    )
    const best = candidates[0]

    if (scoreExtractCompleteness(best.extract) < 4) {
      return NextResponse.json(
        {
          error:
            'Extraction looked incomplete. Check the preview below, fix any wrong values, or re-upload a clearer scan.',
          report: best.extract,
          rawText,
          method: `${method}+${best.source}`,
          lowConfidence: true,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      report: best.extract,
      rawText,
      method: `${method}+${best.source}`,
    })
  } catch (error) {
    console.error('Body composition analyze failed:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'AI analysis failed. Please try again.',
      },
      { status: 503 }
    )
  }
}
