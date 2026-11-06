import { describe, expect, it } from 'vitest'
import {
  buildTaskInput,
  draftFromTask,
  emptyTaskDraft,
  filterTasks,
  sortTasks,
  type TaskDraft,
} from './tracker'
import { projectFixtures, taskFixtures } from '@/test/fixtures'

const projects = projectFixtures.map((project) => project.name)

function draft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    reference: 'OPS-200',
    name: 'Rotate gateway certificates',
    project: 'Data Platform',
    assignees: 'Mina Park, Ravi Shah',
    storyPoints: '3',
    assignedDate: '2026-02-01',
    doneDate: '',
    status: 'In Progress',
    notes: 'Track renewal dates.',
    ...overrides,
  }
}

describe('buildTaskInput', () => {
  it('trims values, defaults optional fields, and dedupes assignees', () => {
    const { input, error } = buildTaskInput(
      draft({
        reference: '  OPS-200  ',
        name: '  Rotate gateway certificates  ',
        assignees: ' Mina Park , Ravi Shah, Mina Park, ',
        storyPoints: ' 5 ',
        notes: '  Track renewal dates.  ',
      }),
      projects,
    )

    expect(error).toBeNull()
    expect(input).toEqual({
      reference: 'OPS-200',
      name: 'Rotate gateway certificates',
      project: 'Data Platform',
      assignees: ['Mina Park', 'Ravi Shah'],
      storyPoints: 5,
      assignedDate: '2026-02-01',
      doneDate: null,
      status: 'In Progress',
      notes: 'Track renewal dates.',
    })
  })

  it('maps empty optional fields to null', () => {
    const { input } = buildTaskInput(
      draft({ storyPoints: '', doneDate: '' }),
      projects,
    )

    expect(input?.storyPoints).toBeNull()
    expect(input?.doneDate).toBeNull()
  })

  it('rejects an empty task name', () => {
    expect(buildTaskInput(draft({ name: '   ' }), projects)).toEqual({
      input: null,
      error: 'Task name is required.',
    })
  })

  it('rejects a project outside the configured list', () => {
    expect(
      buildTaskInput(draft({ project: 'Unknown project' }), projects).error,
    ).toBe('Choose an existing project.')
  })

  it.each(['abc', '1.5', '-1', '101'])(
    'rejects invalid story points %s',
    (value) => {
      expect(buildTaskInput(draft({ storyPoints: value }), projects).error).toBe(
        'Story points must be a whole number from 0 to 100.',
      )
    },
  )

  it('rejects a completion date before the assigned date', () => {
    expect(
      buildTaskInput(
        draft({ assignedDate: '2026-02-05', doneDate: '2026-02-01' }),
        projects,
      ).error,
    ).toBe('Completion date cannot be before the assigned date.')
  })

  it('rejects more than twenty assignees', () => {
    const assignees = Array.from(
      { length: 21 },
      (_, index) => `Person ${index}`,
    ).join(', ')

    expect(buildTaskInput(draft({ assignees }), projects).error).toBe(
      'A task can have at most 20 assignees.',
    )
  })
})

describe('drafts', () => {
  it('builds a draft from an existing task', () => {
    expect(draftFromTask(taskFixtures[0])).toEqual({
      reference: 'OPS-142',
      name: 'Cache project summaries',
      project: 'Data Platform',
      assignees: 'Mina Park, Ravi Shah',
      storyPoints: '3',
      assignedDate: '2026-01-05',
      doneDate: '',
      status: 'In Progress',
      notes: 'Adds a read-through cache for project rollups.',
    })
  })

  it('defaults a new draft to the active project and today', () => {
    const newDraft = emptyTaskDraft(projects, 'Real Time Pickup')

    expect(newDraft.project).toBe('Real Time Pickup')
    expect(newDraft.status).toBe('In Progress')
    expect(newDraft.assignedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(newDraft.doneDate).toBe('')
    expect(newDraft.reference).toBe('')
  })
})

describe('filterTasks', () => {
  const all = {
    project: 'All projects',
    status: 'All statuses',
    assignee: 'All assignees',
    query: '',
  } as const

  it('matches free text against notes', () => {
    expect(
      filterTasks(taskFixtures, { ...all, query: 'webhook' }).map(
        (task) => task.reference,
      ),
    ).toEqual(['OPS-146'])
  })

  it('combines project and status filters', () => {
    expect(
      filterTasks(taskFixtures, {
        ...all,
        project: 'Real Time Pickup',
        status: 'Reviewing',
      }).map((task) => task.reference),
    ).toEqual(['OPS-145'])
  })

  it('filters by assignee', () => {
    expect(
      filterTasks(taskFixtures, { ...all, assignee: 'Mina Park' }).map(
        (task) => task.reference,
      ),
    ).toEqual(['OPS-142', 'OPS-143', 'OPS-146'])
  })
})

describe('sortTasks', () => {
  it('sorts by assigned date and reference, newest first', () => {
    expect(sortTasks(taskFixtures).map((task) => task.reference)).toEqual([
      'OPS-146',
      'OPS-145',
      'OPS-143',
      'OPS-142',
      'OPS-144',
    ])
  })
})
