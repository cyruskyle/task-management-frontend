export const taskStatuses = [
  'Resolved',
  'Reviewing',
  'In Progress',
  'Test',
  'Blocked',
  'Shelved',
] as const

export type TaskStatus = (typeof taskStatuses)[number]

export type Task = {
  id: string
  reference: string
  name: string
  project: string
  assignees: string[]
  storyPoints: number | null
  assignedDate: string
  doneDate: string | null
  status: TaskStatus
  notes: string
}

export type TaskInput = {
  reference: string
  name: string
  project: string
  assignees: string[]
  storyPoints: number | null
  assignedDate: string
  doneDate: string | null
  status: TaskStatus
  notes: string
}

export type TaskDraft = {
  reference: string
  name: string
  project: string
  assignees: string
  storyPoints: string
  assignedDate: string
  doneDate: string
  status: TaskStatus
  notes: string
}

export type TaskFilters = {
  project: string
  status: TaskStatus | 'All statuses'
  assignee: string
  query: string
}

export function filterTasks(taskList: Task[], filters: TaskFilters) {
  const query = filters.query.trim().toLocaleLowerCase()

  return taskList.filter((task) => {
    if (filters.project !== 'All projects' && task.project !== filters.project) {
      return false
    }

    if (filters.status !== 'All statuses' && task.status !== filters.status) {
      return false
    }

    if (
      filters.assignee !== 'All assignees' &&
      !task.assignees.includes(filters.assignee)
    ) {
      return false
    }

    if (!query) {
      return true
    }

    return [
      task.reference,
      task.name,
      task.project,
      task.assignees.join(' '),
      task.notes,
    ].some((value) => value.toLocaleLowerCase().includes(query))
  })
}

export function summarizeTasks(taskList: Task[]) {
  return {
    total: taskList.length,
    inProgress: taskList.filter((task) => task.status === 'In Progress').length,
    inReview: taskList.filter(
      (task) => task.status === 'Reviewing' || task.status === 'Test',
    ).length,
    blocked: taskList.filter((task) => task.status === 'Blocked').length,
    resolved: taskList.filter((task) => task.status === 'Resolved').length,
  }
}

export function listAssignees(taskList: Task[]) {
  return [...new Set(taskList.flatMap((task) => task.assignees))].sort((a, b) =>
    a.localeCompare(b),
  )
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function todayIsoDate() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function emptyTaskDraft(
  projects: string[],
  defaultProject?: string,
): TaskDraft {
  return {
    reference: '',
    name: '',
    project:
      defaultProject && projects.includes(defaultProject)
        ? defaultProject
        : (projects[0] ?? ''),
    assignees: '',
    storyPoints: '',
    assignedDate: todayIsoDate(),
    doneDate: '',
    status: 'In Progress',
    notes: '',
  }
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    reference: task.reference,
    name: task.name,
    project: task.project,
    assignees: task.assignees.join(', '),
    storyPoints: task.storyPoints === null ? '' : String(task.storyPoints),
    assignedDate: task.assignedDate,
    doneDate: task.doneDate ?? '',
    status: task.status,
    notes: task.notes,
  }
}

export function buildTaskInput(
  draft: TaskDraft,
  projects: string[],
): { input: TaskInput | null; error: string | null } {
  const name = draft.name.trim()
  const reference = draft.reference.trim()
  const project = draft.project.trim()
  const notes = draft.notes.trim()

  if (!name) {
    return { input: null, error: 'Task name is required.' }
  }

  if (name.length > 300) {
    return { input: null, error: 'Task name must be 300 characters or fewer.' }
  }

  if (reference.length > 32) {
    return { input: null, error: 'Reference must be 32 characters or fewer.' }
  }

  if (!projects.includes(project)) {
    return { input: null, error: 'Choose an existing project.' }
  }

  let storyPoints: number | null = null

  if (draft.storyPoints.trim()) {
    storyPoints = Number(draft.storyPoints)

    if (
      !Number.isInteger(storyPoints) ||
      storyPoints < 0 ||
      storyPoints > 100
    ) {
      return {
        input: null,
        error: 'Story points must be a whole number from 0 to 100.',
      }
    }
  }

  if (!isoDatePattern.test(draft.assignedDate)) {
    return { input: null, error: 'Choose a valid assigned date.' }
  }

  const doneDate = draft.doneDate.trim() || null

  if (doneDate !== null && !isoDatePattern.test(doneDate)) {
    return { input: null, error: 'Choose a valid completion date.' }
  }

  if (doneDate !== null && doneDate < draft.assignedDate) {
    return {
      input: null,
      error: 'Completion date cannot be before the assigned date.',
    }
  }

  if (!taskStatuses.includes(draft.status)) {
    return { input: null, error: 'Choose a valid status.' }
  }

  const assignees = [
    ...new Set(
      draft.assignees
        .split(',')
        .map((assignee) => assignee.trim())
        .filter(Boolean),
    ),
  ]

  if (assignees.length > 20) {
    return { input: null, error: 'A task can have at most 20 assignees.' }
  }

  if (assignees.some((assignee) => assignee.length > 120)) {
    return {
      input: null,
      error: 'Each assignee must be 120 characters or fewer.',
    }
  }

  if (notes.length > 2000) {
    return { input: null, error: 'Notes must be 2000 characters or fewer.' }
  }

  return {
    input: {
      reference,
      name,
      project,
      assignees,
      storyPoints,
      assignedDate: draft.assignedDate,
      doneDate,
      status: draft.status,
      notes,
    },
    error: null,
  }
}

export function sortTasks(taskList: Task[]) {
  return [...taskList].sort((a, b) => {
    if (a.assignedDate !== b.assignedDate) {
      return a.assignedDate < b.assignedDate ? 1 : -1
    }

    return b.reference.localeCompare(a.reference)
  })
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  const [year, month, day] = value.split('-').map(Number)
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)))
}
