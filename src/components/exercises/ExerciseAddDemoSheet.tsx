'use client'

import { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { DEFAULT_EXERCISE_IMAGE } from '@/data/exercises'
import { ExerciseMediaFields } from '@/components/exercises/ExerciseMediaFields'
import { Button } from '@/components/ui/button'
import { useExerciseStore } from '@/stores/exerciseStore'

type ExerciseAddDemoSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: string
  exerciseName: string
  initialImageUrl?: string
  initialVideoUrl?: string
}

export function ExerciseAddDemoSheet({
  open,
  onOpenChange,
  exerciseId,
  exerciseName,
  initialImageUrl,
  initialVideoUrl,
}: ExerciseAddDemoSheetProps) {
  const setExerciseMedia = useExerciseStore((s) => s.setExerciseMedia)
  const [imageUrl, setImageUrl] = useState(initialImageUrl || DEFAULT_EXERCISE_IMAGE)
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl || '')

  useEffect(() => {
    if (!open) return
    setImageUrl(initialImageUrl || DEFAULT_EXERCISE_IMAGE)
    setVideoUrl(initialVideoUrl || '')
  }, [open, exerciseId, initialImageUrl, initialVideoUrl])

  const canSave =
    Boolean(videoUrl.trim()) ||
    (Boolean(imageUrl.trim()) && imageUrl.trim() !== DEFAULT_EXERCISE_IMAGE)

  const handleSave = () => {
    if (!canSave) return
    setExerciseMedia(exerciseId, {
      imageUrl,
      videoUrl,
    })
    onOpenChange(false)
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-[2px]" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[90] mx-auto flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-border bg-background outline-none sm:max-w-[430px]">
          <Drawer.Handle className="mx-auto mt-3 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-muted" />

          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2 pb-3 border-b border-border/50">
            <div className="min-w-0">
              <Drawer.Title className="text-base font-bold text-foreground tracking-tight truncate">
                Add demo
              </Drawer.Title>
              <Drawer.Description className="text-[11px] text-muted-foreground truncate">
                {exerciseName} · photo and/or video
              </Drawer.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground cursor-pointer active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <ExerciseMediaFields
              imageUrl={imageUrl}
              videoUrl={videoUrl}
              exerciseKey={exerciseId}
              onImageUrlChange={setImageUrl}
              onVideoUrlChange={setVideoUrl}
            />
            <Button
              type="button"
              className="w-full h-12"
              disabled={!canSave}
              onClick={handleSave}
            >
              Save demo
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
