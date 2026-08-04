import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  exerciseNamesMatch,
  labelForAction,
  MAX_AGENT_ACTIONS,
  parseActionParams,
  riskForAction,
  type AgentContext,
} from './agent-types'
import { validateRawProposal } from './validate-proposal'

function mockContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    generatedAt: new Date().toISOString(),
    plans: [
      {
        id: 'plan-1',
        name: 'PPL',
        isActive: true,
        dayCount: 1,
        days: [
          {
            id: 'day-1',
            name: 'Push',
            muscleFocus: 'Chest',
            dayOfWeek: 1,
            exercises: [
              {
                rowId: 'row-1',
                exerciseId: 'bench-press',
                name: 'Bench Press',
                targetSets: 4,
                targetReps: 10,
              },
            ],
          },
        ],
      },
    ],
    activeWorkout: null,
    recentHistory: [],
    historyIds: ['hist-1'],
    progress: { goalWeight: null, recentBodyWeight: [{ id: 'bw-1', date: '2026-01-01', weight: 80 }] },
    recovery: [],
    customExercises: [
      {
        id: 'custom-1',
        name: 'My Curl',
        muscleGroup: 'Arms',
        equipment: 'Dumbbell',
        difficulty: 'beginner',
        instructions: ['Curl up', 'Lower slow'],
      },
    ],
    muscleGroups: [{ id: 'mg-1', name: 'Custom Chest', anatomyBaseGroup: 'Chest' }],
    profile: {
      fullName: 'Alex',
      experienceLevel: 'intermediate',
      heightCm: 180,
      weightUnit: 'kg',
    },
    settings: { theme: 'dark' },
    restTimer: { isActive: false, secondsRemaining: 0, duration: 90 },
    exerciseCatalog: [
      {
        id: 'bench-press',
        name: 'Bench Press',
        muscleGroup: 'Chest',
        equipment: 'Barbell',
      },
    ],
    meals: {
      today: '2026-07-20',
      dailyCalorieGoal: 2500,
      dailyProteinGoal: 160,
      dailyCarbsGoal: 250,
      dailyFatGoal: 70,
      dailyWaterGoalMl: 3000,
      waterTotalMl: 500,
      todaysMeals: [
        {
          id: 'meal-1',
          type: 'lunch',
          name: 'Chicken bowl',
          calories: 600,
          proteinG: 40,
          carbsG: 55,
          fatG: 18,
        },
      ],
      recentWater: [{ id: 'water-1', amountMl: 500 }],
      activeMealPlan: null,
    },
    ...overrides,
  }
}

describe('parseActionParams', () => {
  it('accepts valid create_plan params', () => {
    const result = parseActionParams('create_plan', { name: 'Leg Day' })
    assert.equal(result.ok, true)
  })

  it('rejects empty plan name', () => {
    const result = parseActionParams('create_plan', { name: '   ' })
    assert.equal(result.ok, false)
  })

  it('rejects unknown action', () => {
    const result = parseActionParams('not_real' as 'create_plan', {})
    assert.equal(result.ok, false)
  })
})

describe('riskForAction', () => {
  it('marks destructive actions as high risk', () => {
    assert.equal(riskForAction('delete_plan'), 'high')
    assert.equal(riskForAction('clear_history'), 'high')
    assert.equal(riskForAction('delete_meal'), 'high')
    assert.equal(riskForAction('remove_water'), 'high')
  })

  it('marks create actions as low risk', () => {
    assert.equal(riskForAction('create_plan'), 'low')
    assert.equal(riskForAction('start_workout'), 'low')
    assert.equal(riskForAction('log_meal'), 'low')
  })
})

describe('labelForAction', () => {
  it('builds readable labels', () => {
    const label = labelForAction('create_plan', { name: 'Upper Body' })
    assert.match(label, /Upper Body/)
  })
})

describe('validateRawProposal', () => {
  it('defaults summary when missing', () => {
    const result = validateRawProposal(
      { actions: [{ action: 'set_theme', params: { theme: 'dark' } }] },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.match(result.proposal.summary, /theme/i)
    }
  })

  it('rejects unknown plan ids', () => {
    const result = validateRawProposal(
      {
        summary: 'Delete missing plan',
        actions: [{ action: 'delete_plan', params: { planId: 'missing' } }],
      },
      mockContext()
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /Plan not found/)
  })

  it('rejects starting workout when one is active', () => {
    const result = validateRawProposal(
      {
        summary: 'Start workout',
        actions: [{ action: 'start_workout', params: { name: 'Push' } }],
      },
      mockContext({
        activeWorkout: {
          id: 'sess-1',
          name: 'Active',
          exerciseCount: 0,
          exercises: [],
        },
      })
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /already active/)
  })

  it('accepts valid multi-action proposal within limit', () => {
    const result = validateRawProposal(
      {
        summary: 'Update settings',
        actions: [
          { action: 'set_theme', params: { theme: 'light' } },
          { action: 'set_goal_weight', params: { weight: 75 } },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.proposal.actions.length, 2)
      assert.equal(result.proposal.actions[0].risk, 'low')
    }
  })

  it('rejects too many actions', () => {
    const actions = Array.from({ length: MAX_AGENT_ACTIONS + 1 }, () => ({
      action: 'set_theme',
      params: { theme: 'dark' },
    }))
    const result = validateRawProposal(
      { summary: 'Too many', actions },
      mockContext()
    )
    assert.equal(result.ok, false)
  })

  it('accepts bulk create of more than 8 exercises', () => {
    const names = [
      'Barbell Overhead Press',
      'Dumbbell Shoulder Press',
      'Dumbbell Lateral Raises',
      'Rear Delt Fly',
      'Cable Lateral Raises',
      'Face Pull',
      'Dumbbell Shrugs',
      'Reverse Curl',
      'Wrist Roller',
      'Plate Pinch Hold',
    ]
    const result = validateRawProposal(
      {
        summary: 'Create shoulder accessories',
        actions: names.map((name) => ({
          action: 'create_custom_exercise',
          params: { name },
        })),
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.proposal.actions.length, 10)
  })

  it('skips create when exercise already exists in catalog or custom', () => {
    const result = validateRawProposal(
      {
        summary: 'Create exercises',
        actions: [
          { action: 'create_custom_exercise', params: { name: 'Bench Press' } },
          { action: 'create_custom_exercise', params: { name: 'my curl' } },
          { action: 'create_custom_exercise', params: { name: 'Wrist Roller' } },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.proposal.actions.length, 1)
      assert.equal(result.proposal.actions[0].params.name, 'Wrist Roller')
      assert.match(result.proposal.summary, /Skipped existing/i)
    }
  })

  it('skips duplicate names within the same proposal', () => {
    const result = validateRawProposal(
      {
        summary: 'Create twice',
        actions: [
          { action: 'create_custom_exercise', params: { name: 'Face Pull' } },
          { action: 'create_custom_exercise', params: { name: 'face pulls' } },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.proposal.actions.length, 1)
  })

  it('fails softly when every create already exists', () => {
    const result = validateRawProposal(
      {
        summary: 'Create known',
        actions: [
          { action: 'create_custom_exercise', params: { name: 'Bench Press' } },
          { action: 'create_custom_exercise', params: { name: 'My Curl' } },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /Nothing new to create/i)
  })

  it('fills active planId and name for add_plan_day when omitted', () => {
    const generatedAt = '2026-07-19T12:00:00.000Z'
    const result = validateRawProposal(
      {
        summary: 'Tomorrow push',
        actions: [
          {
            action: 'add_plan_day',
            params: { dayOfWeek: 'tomorrow', muscleFocus: 'Push' },
          },
        ],
      },
      mockContext({ generatedAt })
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      const action = result.proposal.actions[0]
      assert.equal(action.action, 'add_plan_day')
      assert.equal(action.params.planId, 'plan-1')
      assert.equal(typeof action.params.dayOfWeek, 'number')
      assert.ok((action.params.dayOfWeek as number) >= 1 && (action.params.dayOfWeek as number) <= 7)
      assert.match(String(action.params.name), /Push/)
    }
  })

  it('accepts add_exercise_to_day with $last_day after add_plan_day', () => {
    const result = validateRawProposal(
      {
        summary: 'Build tomorrow day',
        actions: [
          {
            action: 'add_plan_day',
            params: {
              planId: 'plan-1',
              name: 'Push — Monday',
              dayOfWeek: 1,
              muscleFocus: 'Chest',
            },
          },
          {
            action: 'add_exercise_to_day',
            params: {
              planId: 'plan-1',
              dayId: '$last_day',
              exerciseId: 'bench-press',
              targetSets: 4,
              targetReps: 8,
            },
          },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.proposal.actions.length, 2)
      assert.equal(result.proposal.actions[1].params.dayId, '$last_day')
    }
  })

  it('resolves exercise name to catalog id for add_exercise_to_day', () => {
    const result = validateRawProposal(
      {
        summary: 'Add bench',
        actions: [
          {
            action: 'add_exercise_to_day',
            params: {
              planId: 'plan-1',
              dayId: 'day-1',
              name: 'Bench Press',
              targetSets: 3,
              targetReps: 10,
            },
          },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.proposal.actions[0].params.exerciseId, 'bench-press')
    }
  })

  it('matches exact exercise names only (not keyword/substring)', () => {
    assert.equal(exerciseNamesMatch('dumbell lateral raises', 'Dumbbell Lateral Raise'), true)
    assert.equal(exerciseNamesMatch('face pull', 'Face Pulls'), true)
    assert.equal(exerciseNamesMatch('Bench Press', 'bench press'), true)
    assert.equal(exerciseNamesMatch('Incline Barbell Bench Press', 'Bench Press'), false)
    assert.equal(exerciseNamesMatch('Close Grip Bench Press', 'Bench Press'), false)
    assert.equal(exerciseNamesMatch('Wrist Roller', 'Bench Press'), false)
  })

  it('defaults start_workout name when missing', () => {
    const result = validateRawProposal(
      {
        summary: 'Start today workout',
        actions: [{ action: 'start_workout', params: {} }],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(typeof result.proposal.actions[0].params.name, 'string')
      assert.ok(String(result.proposal.actions[0].params.name).length > 0)
    }
  })

  it('accepts start_workout with undefined params object fields', () => {
    const result = validateRawProposal(
      {
        summary: 'Start workout',
        actions: [{ action: 'start_workout', params: { name: undefined } }],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
  })

  it('infers create_custom_exercise fields from name only', () => {
    const result = validateRawProposal(
      {
        summary: 'Create Cable Fly',
        actions: [{ action: 'create_custom_exercise', params: { name: 'Cable Fly' } }],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      const p = result.proposal.actions[0].params
      assert.equal(p.name, 'Cable Fly')
      assert.equal(p.muscleGroup, 'Chest')
      assert.equal(p.equipment, 'Cable')
      assert.equal(p.difficulty, 'intermediate')
    }
  })

  it('accepts invalid difficulty and coerces it', () => {
    const result = parseActionParams('create_custom_exercise', {
      name: 'Cable Fly',
      difficulty: 'medium',
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.params.difficulty, 'intermediate')
  })

  it('infers create_muscle_group anatomyBaseGroup', () => {
    const result = validateRawProposal(
      {
        summary: 'Create chest group',
        actions: [{ action: 'create_muscle_group', params: { name: 'Upper Chest' } }],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.proposal.actions[0].params.anatomyBaseGroup, 'Chest')
    }
  })

  it('merges update_custom_exercise from existing exercise when fields missing', () => {
    const result = validateRawProposal(
      {
        summary: 'Add instructions',
        actions: [
          {
            action: 'update_custom_exercise',
            params: {
              exerciseId: 'custom-1',
              instructions: ['Stand tall', 'Curl to shoulders', 'Lower under control'],
            },
          },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      const p = result.proposal.actions[0].params
      assert.equal(p.exerciseId, 'custom-1')
      assert.equal(p.name, 'My Curl')
      assert.equal(p.muscleGroup, 'Arms')
      assert.equal(p.equipment, 'Dumbbell')
      assert.equal(p.difficulty, 'beginner')
      assert.deepEqual(p.instructions, [
        'Stand tall',
        'Curl to shoulders',
        'Lower under control',
      ])
    }
  })

  it('resolves update_custom_exercise by name when id missing', () => {
    const result = validateRawProposal(
      {
        summary: 'Update curl',
        actions: [
          {
            action: 'update_custom_exercise',
            params: { name: 'My Curl', equipment: 'Cable' },
          },
        ],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.proposal.actions[0].params.exerciseId, 'custom-1')
      assert.equal(result.proposal.actions[0].params.equipment, 'Cable')
    }
  })

  it('resolves update_custom_exercise "that" to latest custom exercise', () => {
    const result = validateRawProposal(
      {
        summary: 'Update that exercise',
        actions: [
          {
            action: 'update_custom_exercise',
            params: { name: 'that' },
          },
        ],
      },
      mockContext({
        customExercises: [
          {
            id: 'custom-fly',
            name: 'Cable Fly',
            muscleGroup: 'Chest',
            equipment: 'Cable',
            difficulty: 'intermediate',
            instructions: [],
          },
          {
            id: 'custom-1',
            name: 'My Curl',
            muscleGroup: 'Arms',
            equipment: 'Dumbbell',
            difficulty: 'beginner',
            instructions: [],
          },
        ],
        exerciseCatalog: [
          {
            id: 'cable-fly',
            name: 'Cable Fly',
            muscleGroup: 'Chest',
            equipment: 'Cable',
            instructions: ['Set cables', 'Hug motion', 'Squeeze'],
          },
        ],
      })
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      const p = result.proposal.actions[0].params
      assert.equal(p.exerciseId, 'custom-fly')
      assert.equal(p.name, 'Cable Fly')
      assert.deepEqual(p.instructions, ['Set cables', 'Hug motion', 'Squeeze'])
    }
  })

  it('resolves delete_custom_exercise by name', () => {
    const result = validateRawProposal(
      {
        summary: 'Delete curl',
        actions: [{ action: 'delete_custom_exercise', params: { name: 'My Curl' } }],
      },
      mockContext()
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.proposal.actions[0].params.exerciseId, 'custom-1')
    }
  })

  it('validates history workout id against historyIds', () => {
    const ok = validateRawProposal(
      {
        summary: 'Remove workout',
        actions: [{ action: 'remove_history_workout', params: { workoutId: 'hist-1' } }],
      },
      mockContext()
    )
    assert.equal(ok.ok, true)

    const bad = validateRawProposal(
      {
        summary: 'Remove workout',
        actions: [{ action: 'remove_history_workout', params: { workoutId: 'missing' } }],
      },
      mockContext()
    )
    assert.equal(bad.ok, false)
  })
})
