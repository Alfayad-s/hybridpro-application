import 'server-only'

import { completeGroqVisionChat } from '@/lib/ai/complete'
import { bodyCompositionPreviewUrl } from '@/lib/cloudinary'
import { OCR_TRANSCRIBE_PROMPT } from '@/lib/body-composition/types'
import { looksLikeInBodyText } from '@/lib/body-composition/parse-report'

/**
 * Lightweight PDF text-layer extraction (no pdfjs).
 * Pulls printable strings from PDF content streams / literal strings.
 */
export function extractPdfTextLayer(buffer: Buffer): string {
  const raw = buffer.toString('latin1')
  const chunks: string[] = []

  const literalRe = /\((?:\\.|[^\\)])+\)/g
  let match: RegExpExecArray | null
  while ((match = literalRe.exec(raw)) != null) {
    const inner = match[0]
      .slice(1, -1)
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    if (/[A-Za-z0-9]/.test(inner) && inner.trim().length > 1) {
      chunks.push(inner.trim())
    }
  }

  const hexRe = /<([0-9A-Fa-f\s]+)>/g
  while ((match = hexRe.exec(raw)) != null) {
    const hex = match[1].replace(/\s/g, '')
    if (hex.length < 4 || hex.length % 2 !== 0) continue
    try {
      let s = ''
      for (let i = 0; i < hex.length; i += 2) {
        s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
      }
      if (/[A-Za-z0-9]/.test(s) && s.trim().length > 1) chunks.push(s.trim())
    } catch {
      // skip
    }
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

export async function visionTranscribeImage(imageUrl: string): Promise<string> {
  return completeGroqVisionChat(
    [
      {
        role: 'system',
        content: OCR_TRANSCRIBE_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Transcribe this InBody / BIA report image completely. List every label with its number.',
          },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    { maxTokens: 2500 }
  )
}

export type ExtractTextResult = {
  rawText: string
  method: 'pdf-text' | 'vision'
}

export async function extractDocumentText(params: {
  url: string
  kind: 'image' | 'pdf'
  buffer?: Buffer
}): Promise<ExtractTextResult> {
  // Only trust PDF text-layer when it looks like a real InBody report.
  // Compressed/CID PDFs often yield garbage that misleads extraction.
  if (params.kind === 'pdf' && params.buffer) {
    const layer = extractPdfTextLayer(params.buffer)
    if (looksLikeInBodyText(layer)) {
      return { rawText: layer, method: 'pdf-text' }
    }
  }

  const previewUrl = bodyCompositionPreviewUrl(params.url, params.kind)
  const rawText = await visionTranscribeImage(previewUrl)
  return { rawText: rawText.trim(), method: 'vision' }
}
