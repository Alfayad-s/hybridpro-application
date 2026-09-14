import { NextResponse } from 'next/server'
import { uploadBodyCompositionFile } from '@/lib/cloudinary'
import { requireFeature } from '@/lib/subscriptions/require-feature'

export const runtime = 'nodejs'
export const maxDuration = 60

const IMAGE_MAX_BYTES = 8 * 1024 * 1024
const PDF_MAX_BYTES = 15 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
const PDF_TYPES = new Set(['application/pdf'])

export async function POST(request: Request) {
  const gate = await requireFeature('body_composition')
  if (!gate.ok) return gate.response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  const isPdf = PDF_TYPES.has(file.type) || file.name.toLowerCase().endsWith('.pdf')
  const isImage = IMAGE_TYPES.has(file.type)

  if (!isPdf && !isImage) {
    return NextResponse.json({ error: 'Use a JPG, PNG, or PDF file' }, { status: 400 })
  }

  if (isPdf && file.size > PDF_MAX_BYTES) {
    return NextResponse.json({ error: 'PDF must be under 15MB' }, { status: 400 })
  }
  if (isImage && file.size > IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 8MB' }, { status: 400 })
  }

  const kind = isPdf ? 'pdf' : 'image'
  const fileKey = String(form.get('fileKey') ?? `report-${Date.now().toString(36)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadBodyCompositionFile({
      userId: user.id,
      fileKey: fileKey || `report-${Date.now().toString(36)}`,
      buffer,
      kind,
    })

    return NextResponse.json({
      url: uploaded.url,
      kind,
      publicId: uploaded.publicId,
      fileName: file.name,
    })
  } catch (err) {
    console.error('Body composition upload failed:', err)
    const message =
      err instanceof Error && err.message.includes('Cloudinary is not configured')
        ? err.message
        : 'Failed to upload file'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
