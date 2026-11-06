import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskTracker from './TaskTracker'
import type { Task, TaskInput } from './tracker'
import { projectFixtures, taskFixtures } from '@/test/fixtures'

const projects = projectFixtures.map((project) => project.name)

function renderTracker(
  overrides: {
    onSignOut?: () => void
    onCreateTask?: (input: TaskInput) => Promise<Task>
    onUpdateTask?: (id: string, input: TaskInput) => Promise<Task>
  } = {},
) {
  const onSignOut = overrides.onSignOut ?? vi.fn()
  const onCreateTask = overrides.onCreateTask ?? vi.fn()
  const onUpdateTask = overrides.onUpdateTask ?? vi.fn()

  render(
    <TaskTracker
      tasks={taskFixtures}
      projects={projects}
      username="team"
      onSignOut={onSignOut}
      onCreateTask={onCreateTask}
      onUpdateTask={onUpdateTask}
    />,
  )

  return { onSignOut, onCreateTask, onUpdateTask }
}

function fillField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function createDataTransfer() {
  const store = new Map<string, string>()

  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData(type: string, value: string) {
      store.set(type, value)
    },
    getData(type: string) {
      return store.get(type) ?? ''
    },
  } as unknown as DataTransfer
}

const cacheTaskInput = {
  reference: 'OPS-142',
  name: 'Cache project summaries',
  project: 'Data Platform',
  assignees: ['Mina Park', 'Ravi Shah'],
  storyPoints: 3,
  assignedDate: '2026-01-05',
  doneDate: null,
  status: 'In Progress',
  notes: 'Adds a read-through cache for project rollups.',
}

const createdTask: Task = {
  id: '00000000-0000-0000-0000-000000000199',
  reference: 'OPS-199',
  name: 'Rotate gateway certificates',
  project: 'Real Time Pickup',
  assignees: ['Jon Bell', 'Mina Park'],
  storyPoints: 5,
  assignedDate: '2026-02-02',
  doneDate: null,
  status: 'In Progress',
  notes: 'Track renewal dates.',
}

describe('TaskTracker', () => {
  it('renders the sheet-style columns, references, and task totals', () => {
    renderTracker()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Task tracker' }),
    ).toBeInTheDocument()
    expect(screen.getByText('5 of 5 tasks')).toBeInTheDocument()
    expect(screen.getByText('OPS-142')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Story points' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Signed in as team')).toBeInTheDocument()
  })

  it('filters tasks by search and status', () => {
    renderTracker()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), {
      target: { value: 'summaries' },
    })
    expect(screen.getByText('Cache project summaries')).toBeInTheDocument()
    expect(
      screen.queryByText('Align project tabs with workspace filters'),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'Blocked' },
    })
    expect(
      screen.getByText('Waiting on the shared cache rollout.'),
    ).toBeInTheDocument()
    expect(screen.getByText('1 of 5 tasks')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), {
      target: { value: 'no matching task' },
    })
    expect(screen.getByText('No tasks match these filters.')).toBeInTheDocument()
  })

  it('switches projects and resets the active filters', () => {
    renderTracker()

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'Blocked' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Real Time Pickup/ }))

    expect(screen.getByText('2 of 2 tasks')).toBeInTheDocument()
    expect(
      screen.getByText('Align project tabs with workspace filters'),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue(
      'All statuses',
    )
  })

  it('signs out through the header action', () => {
    const { onSignOut } = renderTracker()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('creates a task from the new task row with every column filled', async () => {
    const { onCreateTask } = renderTracker({
      onCreateTask: vi.fn().mockResolvedValue(createdTask),
    })

    fireEvent.click(screen.getByRole('button', { name: 'New task' }))

    fillField('Reference', 'OPS-199')
    fillField('Task name', 'Rotate gateway certificates')
    fillField('Project', 'Real Time Pickup')
    fillField('Assignees', 'Jon Bell, Mina Park')
    fillField('Story points', '5')
    fillField('Date assigned', '2026-02-02')
    fillField('Status', 'In Progress')
    fillField('Notes', 'Track renewal dates.')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(onCreateTask).toHaveBeenCalledWith({
        reference: 'OPS-199',
        name: 'Rotate gateway certificates',
        project: 'Real Time Pickup',
        assignees: ['Jon Bell', 'Mina Park'],
        storyPoints: 5,
        assignedDate: '2026-02-02',
        doneDate: null,
        status: 'In Progress',
        notes: 'Track renewal dates.',
      }),
    )
  })

  it('edits every field of an existing task', async () => {
    const { onUpdateTask } = renderTracker({
      onUpdateTask: vi.fn().mockResolvedValue(taskFixtures[0]),
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Cache project summaries' }),
    )

    fillField('Reference', 'OPS-142-EDIT')
    fillField('Task name', 'Cache project summaries v2')
    fillField('Project', 'Real Time Pickup')
    fillField('Assignees', 'Mina Park, Jon Bell')
    fillField('Story points', '8')
    fillField('Date assigned', '2026-01-06')
    fillField('Status', 'Reviewing')
    fillField('Date done', '2026-01-10')
    fillField('Notes', 'Updated notes.')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(onUpdateTask).toHaveBeenCalledWith(
        taskFixtures[0].id,
        {
          reference: 'OPS-142-EDIT',
          name: 'Cache project summaries v2',
          project: 'Real Time Pickup',
          assignees: ['Mina Park', 'Jon Bell'],
          storyPoints: 8,
          assignedDate: '2026-01-06',
          doneDate: '2026-01-10',
          status: 'Reviewing',
          notes: 'Updated notes.',
        },
      ),
    )
  })

  it('validates the draft before calling the API', () => {
    const { onCreateTask } = renderTracker()

    fireEvent.click(screen.getByRole('button', { name: 'New task' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Task name is required.')
    expect(onCreateTask).not.toHaveBeenCalled()
  })

  it('keeps the editor open and shows API errors', async () => {
    const { onCreateTask } = renderTracker({
      onCreateTask: vi
        .fn()
        .mockRejectedValue(
          new Error('That task reference is already in use.'),
        ),
    })

    fireEvent.click(screen.getByRole('button', { name: 'New task' }))
    fillField('Task name', 'Duplicate reference')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'That task reference is already in use.',
      ),
    )
    expect(onCreateTask).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Task name')).toHaveValue('Duplicate reference')
  })

  it('cancels the editor without saving', () => {
    const { onCreateTask } = renderTracker()

    fireEvent.click(screen.getByRole('button', { name: 'New task' }))
    fillField('Task name', 'Discarded draft')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Task name')).not.toBeInTheDocument()
    expect(onCreateTask).not.toHaveBeenCalled()
  })

  it('switches to a board view grouped by status', () => {
    renderTracker()

    fireEvent.click(screen.getByRole('button', { name: 'Board' }))

    const inProgress = screen.getByRole('region', {
      name: 'In Progress column',
    })
    const blocked = screen.getByRole('region', { name: 'Blocked column' })
    const resolved = screen.getByRole('region', { name: 'Resolved column' })

    expect(within(inProgress).getByText('Cache project summaries')).toBeInTheDocument()
    expect(
      within(blocked).getByText('Delete archived project data'),
    ).toBeInTheDocument()
    expect(within(resolved).getByText('Schedule nightly vacuum')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Shelved column' }),
    ).toHaveTextContent('Drop tasks here')
  })

  it('moves a task between columns with drag and drop', async () => {
    const { onUpdateTask } = renderTracker({
      onUpdateTask: vi.fn().mockResolvedValue(taskFixtures[0]),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Board' }))

    const card = screen.getByText('Cache project summaries').closest('article')
    const testColumn = screen.getByRole('region', { name: 'Test column' })
    const dataTransfer = createDataTransfer()

    expect(card).not.toBeNull()

    fireEvent.dragStart(card as HTMLElement, { dataTransfer })
    fireEvent.dragOver(testColumn, { dataTransfer })
    fireEvent.drop(testColumn, { dataTransfer })

    await waitFor(() =>
      expect(onUpdateTask).toHaveBeenCalledWith(taskFixtures[0].id, {
        ...cacheTaskInput,
        status: 'Test',
      }),
    )
  })

  it('moves a task with the keyboard-accessible status control', async () => {
    const { onUpdateTask } = renderTracker({
      onUpdateTask: vi.fn().mockResolvedValue(taskFixtures[0]),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Move Cache project summaries to status',
      }),
      { target: { value: 'Reviewing' } },
    )

    await waitFor(() =>
      expect(onUpdateTask).toHaveBeenCalledWith(taskFixtures[0].id, {
        ...cacheTaskInput,
        status: 'Reviewing',
      }),
    )
  })

  it('shows an error when a board move fails', async () => {
    renderTracker({
      onUpdateTask: vi
        .fn()
        .mockRejectedValue(
          new Error('That change conflicts with existing data.'),
        ),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Move Cache project summaries to status',
      }),
      { target: { value: 'Blocked' } },
    )

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'That change conflicts with existing data.',
      ),
    )
  })

  it('opens the list editor when editing from the board', () => {
    renderTracker()

    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Cache project summaries' }),
    )

    expect(screen.getByLabelText('Task name')).toHaveValue(
      'Cache project summaries',
    )
    expect(
      screen.queryByRole('region', { name: 'In Progress column' }),
    ).not.toBeInTheDocument()
  })
})
