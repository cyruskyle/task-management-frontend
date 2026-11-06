import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TaskStatus } from './tracker'

const statusStyles: Record<TaskStatus, { pill: string; dot: string }> = {
  Resolved: {
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  Reviewing: {
    pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  'In Progress': {
    pill: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  Test: {
    pill: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  Blocked: {
    pill: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    dot: 'bg-red-500',
  },
  Shelved: {
    pill: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
    dot: 'bg-zinc-400',
  },
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const style = statusStyles[status]

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 rounded-full px-2.5 py-1 font-normal', style.pill)}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', style.dot)}
      />
      {status}
    </Badge>
  )
}

export default StatusBadge
