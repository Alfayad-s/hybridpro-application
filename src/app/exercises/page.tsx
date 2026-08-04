'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, ChevronRight, Plus, Layers3, Film, Sparkles } from 'lucide-react'
import {
  DEFAULT_EXERCISE_IMAGE,
  EXERCISE_CATALOG,
  type ExerciseDifficulty,
} from '@/data/exercises'
import { MuscleFocusPreview } from '@/components/muscle-map'
import { useMergedExercises } from '@/hooks/useMergedExercises'
import { useMuscleGroups } from '@/hooks/useMuscleGroups'
import { AiExerciseSuggestSheet } from '@/components/exercises/AiExerciseSuggestSheet'
import { useExerciseStore } from '@/stores/exerciseStore'

const DIFFICULTY_STYLE: Record<ExerciseDifficulty, string> = {
  beginner: 'text-primary bg-primary/10 border-primary/20',
  intermediate: 'text-warning bg-warning/10 border-warning/20',
  advanced: 'text-destructive bg-destructive/10 border-destructive/20',
}

export default function ExerciseLibraryPage() {
  const router = useRouter()
  const allExercises = useMergedExercises()
  const muscleGroups = useMuscleGroups()
  const createExercise = useExerciseStore((s) => s.createExercise)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string>('All')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSeedName, setAiSeedName] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allExercises.filter((ex) => {
      const matchesGroup = group === 'All' || ex.muscleGroup === group
      const matchesSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.muscleGroup.toLowerCase().includes(q) ||
        ex.target.toLowerCase().includes(q) ||
        ex.equipment.toLowerCase().includes(q) ||
        ex.secondary.some((s) => s.toLowerCase().includes(q))
      return matchesGroup && matchesSearch
    })
  }, [search, group, allExercises])

  const customCount = allExercises.length - EXERCISE_CATALOG.length

  return (
    <div className="p-5 space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Exercise Library</h1>
            <p className="text-xs text-muted-foreground">
              {allExercises.length} exercises
              {customCount > 0 ? ` · ${customCount} custom` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Link
            href="/muscle-groups"
            className="h-10 w-10 rounded-[14px] bg-muted border border-border text-foreground flex items-center justify-center shrink-0 active:scale-95"
            aria-label="Manage muscle groups"
          >
            <Layers3 className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => {
              setAiSeedName(search.trim())
              setAiOpen(true)
            }}
            className="h-10 w-10 rounded-[14px] bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
            aria-label="Create exercise with AI"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <Link
            href="/exercises/new"
            className="h-10 px-3 rounded-[14px] bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, muscle, equipment…"
          className="w-full h-12 bg-card border border-border rounded-2xl pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {['All', ...muscleGroups.map((item) => item.name)].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setGroup(cat)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold cursor-pointer ${
              group === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-xs text-muted-foreground">No exercises found.</p>
            <button
              type="button"
              onClick={() => {
                setAiSeedName(search.trim())
                setAiOpen(true)
              }}
              className="text-xs font-bold text-primary cursor-pointer"
            >
              {search.trim()
                ? `Create “${search.trim()}” with AI`
                : 'Create a custom exercise with AI'}
            </button>
          </div>
        ) : (
          filtered.map((ex) => (
            <Link
              key={ex.id}
              href={`/exercises/${ex.id}`}
              className="flex gap-3 bg-card border border-border rounded-[22px] p-3.5 hover:bg-muted/80 active:scale-[0.99] transition-all"
            >
              <div className="w-[84px] h-[84px] rounded-[20px] bg-background border border-border flex items-center justify-center overflow-hidden shrink-0 relative">
                {ex.imageUrl && ex.imageUrl !== DEFAULT_EXERCISE_IMAGE ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full p-2">
                    <MuscleFocusPreview
                      view={ex.anatomy.view}
                      primary={ex.anatomy.primary}
                      secondary={ex.anatomy.secondary}
                      className="w-full h-full"
                      size="list"
                    />
                  </div>
                )}
                {ex.videoUrl && (
                  <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-background/90 border border-border flex items-center justify-center">
                    <Film className="w-2.5 h-2.5 text-primary" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-sm font-bold text-foreground leading-tight truncate">
                      {ex.name}
                    </h3>
                    {ex.isCustom && (
                      <span className="shrink-0 rounded-full bg-primary/15 border border-primary/25 px-1.5 py-0.5 text-[8px] font-bold text-primary uppercase">
                        Custom
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {ex.equipment} · {ex.muscleGroup}
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[9px] font-semibold text-primary">
                    {ex.target}
                  </span>
                  {ex.secondary.slice(0, 2).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-semibold text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold capitalize ${DIFFICULTY_STYLE[ex.difficulty]}`}
                >
                  {ex.difficulty}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      <AiExerciseSuggestSheet
        open={aiOpen}
        onOpenChange={(open) => {
          setAiOpen(open)
          if (!open) setAiSeedName('')
        }}
        createMode
        initialName={aiSeedName}
        existingExercises={allExercises.map((e) => ({ id: e.id, name: e.name }))}
        onApply={(suggestion) => {
          const id = createExercise(suggestion)
          router.push(`/exercises/${id}`)
        }}
      />
    </div>
  )
}
