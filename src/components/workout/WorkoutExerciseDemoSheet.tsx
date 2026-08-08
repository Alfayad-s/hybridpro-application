'use client'

import { Drawer } from 'vaul'
import { ImagePlus, X } from 'lucide-react'
import { ExerciseVideoPreview } from '@/components/exercises/ExerciseVideoPreview'
import { Button } from '@/components/ui/button'

type WorkoutExerciseDemoSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseName: string
  videoUrl: string
  /** Opens the photo/video editor for this exercise. */
  onEditDemo?: () => void
}

export function WorkoutExerciseDemoSheet({
  open,
  onOpenChange,
  exerciseName,
  videoUrl,
  onEditDemo,
}: WorkoutExerciseDemoSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-[2px]" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[90] mx-auto flex w-full flex-col rounded-t-[28px] border border-border bg-background outline-none sm:max-w-[430px]"
          style={{ height: '96dvh', maxHeight: '96dvh' }}
        >
          <Drawer.Handle className="mx-auto mt-3 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-muted" />

          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2 pb-3 border-b border-border/50">
            <div className="min-w-0">
              <Drawer.Title className="text-base font-bold text-foreground tracking-tight truncate">
                {exerciseName}
              </Drawer.Title>
              <Drawer.Description className="text-[11px] text-muted-foreground">
                Demo video
              </Drawer.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground cursor-pointer active:scale-95"
              aria-label="Close demo video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 bg-black">
            <ExerciseVideoPreview
              url={videoUrl}
              title={`${exerciseName} demo`}
              controls
              autoPlay
              className="h-full"
            />
          </div>

          {onEditDemo && (
            <div className="shrink-0 border-t border-border/50 bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                onClick={onEditDemo}
                className="w-full h-12 rounded-[16px] bg-muted hover:bg-muted/80 text-foreground border-0 gap-2 font-bold"
              >
                <ImagePlus className="w-4 h-4 text-primary" />
                Edit demo video or image
              </Button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
