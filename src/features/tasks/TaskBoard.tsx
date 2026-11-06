import { useState, type DragEvent } from 'react'
import { LoaderCircle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import StatusBadge from './TaskStatusBadge'
import {
  groupTasksByStatus,
  taskStatuses,
  taskToInput,
  type Task,
  type TaskInput,
  type TaskStatus,
} from './tracker'

type TaskBoardProps = {
  tasks: Task[]
  onEditTask: (task: Task) => void
  onUpdateTask: (id: string, input: TaskInput) => Promise<Task>
}

function TaskBoard({ tasks, onEditTask, onUpdateTask }: TaskBoardProps) {
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const groups = groupTasksByStatus(tasks)

  const moveTask = async (task: Task, status: TaskStatus) => {
    if (task.status === status || movingTaskId !== null) {
      return
    }

    setMoveError(null)
    setMovingTaskId(task.id)

    try {
      await onUpdateTask(task.id, { ...taskToInput(task), status })
    } catch (error) {
      setMoveError(
        error instanceof Error ? error.message : 'Could not move the task.',
      )
    } finally {
      setMovingTaskId(null)
    }
  }

  const handleDragStart = (event: DragEvent<HTMLElement>, task: Task) => {
    event.dataTransfer.setData('text/plain', task.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (event: DragEvent<HTMLElement>, status: TaskStatus) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOver(status)
  }

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragOver(null)
    }
  }

  const handleDrop = (event: DragEvent<HTMLElement>, status: TaskStatus) => {
    event.preventDefault()
    setDragOver(null)

    const taskId = event.dataTransfer.getData('text/plain')
    const task = tasks.find((item) => item.id === taskId)

    if (task) {
      void moveTask(task, status)
    }
  }

  return (
    <div className="overflow-x-auto border-t bg-muted/10 p-4">
      {moveError ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {moveError}
        </div>
      ) : null}

      <div className="flex min-w-max items-start gap-3">
        {groups.map(({ status, tasks: columnTasks }) => (
          <section
            key={status}
            aria-label={`${status} column`}
            onDragOver={(event) => handleDragOver(event, status)}
            onDragLeave={handleDragLeave}
            onDrop={(event) => handleDrop(event, status)}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-xl border bg-card shadow-sm transition-shadow',
              dragOver === status && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
            )}
          >
            <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <StatusBadge status={status} />
              <span className="text-xs tabular-nums text-muted-foreground">
                {columnTasks.length}
              </span>
            </header>

            <div className="flex min-h-32 flex-col gap-2 p-2">
              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  draggable={movingTaskId === null}
                  onDragStart={(event) => handleDragStart(event, task)}
                  className={cn(
                    'cursor-grab rounded-lg border bg-background p-3 shadow-xs transition-opacity active:cursor-grabbing',
                    movingTaskId === task.id && 'opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">
                        {task.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.reference} · {task.project}
                      </p>
                    </div>
                    {movingTaskId === task.id ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
                      />
                    ) : null}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {task.assignees.length > 0
                      ? task.assignees.join(', ')
                      : 'Unassigned'}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {task.storyPoints === null
                        ? 'No estimate'
                        : `${task.storyPoints} pts`}
                    </span>
                    <span>{task.doneDate ?? 'Open'}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <select
                      aria-label={`Move ${task.name} to status`}
                      value={task.status}
                      disabled={movingTaskId !== null}
                      onChange={(event) =>
                        void moveTask(task, event.target.value as TaskStatus)
                      }
                      className="h-7 min-w-0 flex-1 rounded-md border bg-background px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-60"
                    >
                      {taskStatuses.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onEditTask(task)}
                      disabled={movingTaskId !== null}
                      aria-label={`Edit ${task.name}`}
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </Button>
                  </div>
                </article>
              ))}

              {columnTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Drop tasks here
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default TaskBoard
