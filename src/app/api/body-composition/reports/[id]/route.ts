import { NextResponse } from 'next/server'
import { deleteReportForUser, getReportForUser } from '@/lib/body-composition/db'
import { requireFeature } from '@/lib/subscriptions/require-feature'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const gate = await requireFeature('body_composition')
  if (!gate.ok) return gate.response

  const report = await getReportForUser(gate.user.id, id)
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ report })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const gate = await requireFeature('body_composition')
  if (!gate.ok) return gate.response

  await deleteReportForUser(gate.user.id, id)
  return NextResponse.json({ ok: true })
}
