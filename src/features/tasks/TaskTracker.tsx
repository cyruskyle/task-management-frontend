import { useState } from 'react'
import {
  Check,
  Columns3,
  List as ListIcon,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import TaskBoard from './TaskBoard'
import StatusBadge from './TaskStatusBadge'
import {
  buildTaskInput,
  draftFromTask,
  emptyTaskDraft,
  filterTasks,
  formatDate,
  listAssignees,
  summarizeTasks,
  taskStatuses,
  type Task,
  type TaskDraft,
  type TaskInput,
  type TaskStatus,
} from './tracker'

type TaskTrackerProps = {
  tasks: Task[]
  projects: string[]
  username: string
  onSignOut: () => void
  onCreateTask: (input: TaskInput) => Promise<Task>
  onUpdateTask: (id: string, input: TaskInput) => Promise<Task>
}

type DraftChange = <K extends keyof TaskDraft>(
  key: K,
  value: TaskDraft[K],
) => void

const allProjects = 'All projects'
const allStatuses = 'All statuses'
const allAssignees = 'All assignees'

const cellInputClassName =
  'h-8 w-full rounded-md border bg-background px-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-60'

type EditableRowProps = {
  draft: TaskDraft
  projects: string[]
  isSaving: boolean
  onChange: DraftChange
  onSave: () => void
  onCancel: () => void
}

function EditableRow({
  draft,
  projects,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: EditableRowProps) {
  return (
    <tr className="bg-muted/20 align-top">
      <td className="min-w-[240px] px-4 py-3">
        <input
          aria-label="Reference"
          value={draft.reference}
          maxLength={32}
          placeholder="Auto-generated"
          disabled={isSaving}
          onChange={(event) => onChange('reference', event.target.value)}
          className={cellInputClassName}
        />
        <input
          aria-label="Task name"
          value={draft.name}
          maxLength={300}
          placeholder="Task name"
          disabled={isSaving}
          onChange={(event) => onChange('name', event.target.value)}
          className={cn(cellInputClassName, 'mt-1.5')}
        />
      </td>
      <td className="min-w-[150px] px-4 py-3">
        <select
          aria-label="Project"
          value={draft.project}
          disabled={isSaving}
          onChange={(event) => onChange('project', event.target.value)}
          className={cellInputClassName}
        >
          {projects.map((project) => (
            <option key={project} value={project}>
              {project}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-[170px] px-4 py-3">
        <input
          aria-label="Assignees"
          value={draft.assignees}
          maxLength={1200}
          placeholder="Comma-separated names"
          disabled={isSaving}
          onChange={(event) => onChange('assignees', event.target.value)}
          className={cellInputClassName}
        />
      </td>
      <td className="px-4 py-3">
        <input
          aria-label="Story points"
          type="number"
          min={0}
          max={100}
          step={1}
          value={draft.storyPoints}
          disabled={isSaving}
          onChange={(event) => onChange('storyPoints', event.target.value)}
          className={cn(cellInputClassName, 'w-20 text-center')}
        />
      </td>
      <td className="px-4 py-3">
        <input
          aria-label="Date assigned"
          type="date"
          required
          value={draft.assignedDate}
          disabled={isSaving}
          onChange={(event) => onChange('assignedDate', event.target.value)}
          className={cellInputClassName}
        />
      </td>
      <td className="px-4 py-3">
        <select
          aria-label="Status"
          value={draft.status}
          disabled={isSaving}
          onChange={(event) =>
            onChange('status', event.target.value as TaskStatus)
          }
          className={cellInputClassName}
        >
          {taskStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          aria-label="Date done"
          type="date"
          value={draft.doneDate}
          disabled={isSaving}
          onChange={(event) => onChange('doneDate', event.target.value)}
          className={cellInputClassName}
        />
      </td>
      <td className="min-w-[200px] px-4 py-3">
        <textarea
          aria-label="Notes"
          value={draft.notes}
          maxLength={2000}
          rows={2}
          placeholder="Optional notes"
          disabled={isSaving}
          onChange={(event) => onChange('notes', event.target.value)}
          className={cn(
            cellInputClassName,
            'h-auto min-h-16 resize-y px-2 py-1.5',
          )}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {isSaving ? 'Saving' : 'Save'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  )
}

function TaskTracker({
  tasks,
  projects,
  username,
  onSignOut,
  onCreateTask,
  onUpdateTask,
}: TaskTrackerProps) {
  const [selectedProject, setSelectedProject] = useState(allProjects)
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'All statuses'>(
    allStatuses,
  )
  const [selectedAssignee, setSelectedAssignee] = useState(allAssignees)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<{ taskId: string | null; draft: TaskDraft } | null>(
    null,
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [view, setView] = useState<'list' | 'board'>('list')

  const projectTasks =
    selectedProject === allProjects
      ? tasks
      : tasks.filter((task) => task.project === selectedProject)
  const visibleTasks = filterTasks(projectTasks, {
    project: allProjects,
    status: selectedStatus,
    assignee: selectedAssignee,
    query,
  })
  const metrics = summarizeTasks(projectTasks)
  const assignees = listAssignees(projectTasks)
  const hasFilters =
    selectedStatus !== allStatuses ||
    selectedAssignee !== allAssignees ||
    query.trim().length > 0

  const resetFilters = () => {
    setSelectedStatus(allStatuses)
    setSelectedAssignee(allAssignees)
    setQuery('')
  }

  const startCreate = () => {
    if (isSaving || editor) {
      return
    }

    setView('list')
    setEditor({
      taskId: null,
      draft: emptyTaskDraft(
        projects,
        selectedProject === allProjects ? undefined : selectedProject,
      ),
    })
    setSaveError(null)
  }

  const startEdit = (task: Task) => {
    if (isSaving || editor) {
      return
    }

    setView('list')
    setEditor({ taskId: task.id, draft: draftFromTask(task) })
    setSaveError(null)
  }

  const cancelEdit = () => {
    if (isSaving) {
      return
    }

    setEditor(null)
    setSaveError(null)
  }

  const updateDraft: DraftChange = (key, value) => {
    setEditor((current) =>
      current
        ? { ...current, draft: { ...current.draft, [key]: value } }
        : current,
    )
    setSaveError(null)
  }

  const saveDraft = async () => {
    if (!editor || isSaving) {
      return
    }

    const { input, error } = buildTaskInput(editor.draft, projects)

    if (!input) {
      setSaveError(error)
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      if (editor.taskId === null) {
        await onCreateTask(input)
        setSelectedProject(allProjects)
        resetFilters()
      } else {
        await onUpdateTask(editor.taskId, input)
      }

      setEditor(null)
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Could not save the task.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const summary = [
    { label: 'Total tasks', value: metrics.total, detail: 'In current view' },
    {
      label: 'In progress',
      value: metrics.inProgress,
      detail: 'Actively being delivered',
    },
    {
      label: 'Awaiting review',
      value: metrics.inReview,
      detail: 'Reviewing or in test',
    },
    { label: 'Blocked', value: metrics.blocked, detail: 'Needs an unblock' },
    { label: 'Resolved', value: metrics.resolved, detail: 'Completed work' },
  ]

  return (
    <div className="min-h-svh bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-64 bg-[radial-gradient(ellipse_at_top,var(--muted),transparent_70%)]"
      />
      <main className="relative mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1">
                Infrastructure operations
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">
                Live from PostgreSQL
              </span>
            </div>
            <h1 className="text-3xl font-medium tracking-[-0.04em] text-balance sm:text-4xl lg:text-5xl">
              Task tracker
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Track delivery across projects with clear ownership, status, and
              completion dates in one operational view.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Current view
                </p>
                <p className="mt-1 text-sm font-medium">
                  {visibleTasks.length} of {projectTasks.length} tasks
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={startCreate}
                disabled={editor !== null}
              >
                <Plus aria-hidden="true" />
                New task
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-2">
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                Signed in as {username}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSignOut}
              >
                <LogOut aria-hidden="true" />
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <section aria-label="Task summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {summary.map((item) => (
            <Card key={item.label} size="sm" className="bg-card/90 shadow-sm">
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-3xl font-medium tracking-[-0.04em]">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <nav
            aria-label="Filter by project"
            className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-2"
          >
            {[allProjects, ...projects].map((project) => {
              const count =
                project === allProjects
                  ? tasks.length
                  : tasks.filter((task) => task.project === project).length
              const isActive = selectedProject === project

              return (
                <button
                  key={project}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setSelectedProject(project)
                    resetFilters()
                  }}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    isActive
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                  )}
                >
                  {project}
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
              )
            })}
          </nav>

          <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <label htmlFor="task-search" className="sr-only">
                Search tasks
              </label>
              <input
                id="task-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks, people, or notes"
                className="h-9 w-full rounded-lg border bg-background pr-9 pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div>
                <label htmlFor="status-filter" className="sr-only">
                  Filter by status
                </label>
                <select
                  id="status-filter"
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(
                      event.target.value as TaskStatus | 'All statuses',
                    )
                  }
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                >
                  <option value={allStatuses}>{allStatuses}</option>
                  {taskStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="assignee-filter" className="sr-only">
                  Filter by assignee
                </label>
                <select
                  id="assignee-filter"
                  value={selectedAssignee}
                  onChange={(event) => setSelectedAssignee(event.target.value)}
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                >
                  <option value={allAssignees}>{allAssignees}</option>
                  {assignees.map((assignee) => (
                    <option key={assignee} value={assignee}>
                      {assignee}
                    </option>
                  ))}
                </select>
              </div>

              {hasFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              ) : null}

              <div
                role="group"
                aria-label="Task view"
                className="flex items-center gap-0.5 rounded-lg border p-0.5"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'list' ? 'secondary' : 'ghost'}
                  aria-pressed={view === 'list'}
                  disabled={editor !== null}
                  onClick={() => setView('list')}
                >
                  <ListIcon aria-hidden="true" />
                  List
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'board' ? 'secondary' : 'ghost'}
                  aria-pressed={view === 'board'}
                  disabled={editor !== null}
                  onClick={() => setView('board')}
                >
                  <Columns3 aria-hidden="true" />
                  Board
                </Button>
              </div>
            </div>
          </div>

          {saveError ? (
            <div
              role="alert"
              className="border-t bg-destructive/5 px-4 py-2 text-sm text-destructive"
            >
              {saveError}
            </div>
          ) : null}

          {view === 'list' ? (
            <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <caption className="sr-only">
                Tasks with reference, name, project, assignee, story points,
                assigned date, status, completion date, and notes. Every column
                is editable.
              </caption>
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Task name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Project
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Assigned to
                  </th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">
                    Story points
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date assigned
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date done
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Notes
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editor && editor.taskId === null ? (
                  <EditableRow
                    draft={editor.draft}
                    projects={projects}
                    isSaving={isSaving}
                    onChange={updateDraft}
                    onSave={() => void saveDraft()}
                    onCancel={cancelEdit}
                  />
                ) : null}

                {visibleTasks.map((task) =>
                  editor && editor.taskId === task.id ? (
                    <EditableRow
                      key={task.id}
                      draft={editor.draft}
                      projects={projects}
                      isSaving={isSaving}
                      onChange={updateDraft}
                      onSave={() => void saveDraft()}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <tr key={task.id} className="transition-colors hover:bg-muted/30">
                      <td className="max-w-[310px] px-4 py-3.5">
                        <p className="font-medium">{task.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.reference}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                        {task.project}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {task.assignees.join(', ')}
                      </td>
                      <td className="px-4 py-3.5 text-center tabular-nums">
                        {task.storyPoints ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                        {formatDate(task.assignedDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                        {formatDate(task.doneDate)}
                      </td>
                      <td
                        className="max-w-[240px] truncate px-4 py-3.5 text-muted-foreground"
                        title={task.notes || undefined}
                      >
                        {task.notes || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(task)}
                          disabled={editor !== null}
                          aria-label={`Edit ${task.name}`}
                        >
                          <Pencil aria-hidden="true" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ),
                )}

                {visibleTasks.length === 0 && editor === null ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <p className="font-medium">No tasks match these filters.</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Adjust your search or return to the full project view.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={resetFilters}
                      >
                        Reset filters
                      </Button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          ) : (
            <TaskBoard
              tasks={visibleTasks}
              onEditTask={startEdit}
              onUpdateTask={onUpdateTask}
            />
          )}

          <footer className="flex flex-col gap-1 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Task content is rendered as text and treated as untrusted.</span>
            <span aria-live="polite">
              Showing {visibleTasks.length} of {projectTasks.length} tasks
            </span>
          </footer>
        </section>
      </main>
    </div>
  )
}

export default TaskTracker
