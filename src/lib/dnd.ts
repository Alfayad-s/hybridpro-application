import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/** Long-press (~250ms) before drag so short taps still navigate / click. */
export function useLongPressSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
}

export function reorderIds(
  ids: UniqueIdentifier[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier
): string[] {
  const oldIndex = ids.indexOf(activeId)
  const newIndex = ids.indexOf(overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return ids.map(String)
  }
  return arrayMove(ids, oldIndex, newIndex).map(String)
}
