import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

const priorityColors: Record<string, string> = {
  LOW:    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  MEDIUM: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  HIGH:   'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  URGENT: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}

const SPRINT_BORDER = '#1D9E75'

export default function TaskCard({ task, onClick }: {
  task: any
  onClick: (task: any) => void
}) {
  const isSprintTask = !!task?.sprintId
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(task.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={{
        ...style,
        ...(isSprintTask ? { borderLeftColor: SPRINT_BORDER } : null),
      }}
      className={[
        'group cursor-pointer rounded-xl border-border/60 bg-card/90',
        'transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_14px_50px_-35px_rgba(0,0,0,.35)]',
        isDragging ? 'shadow-none' : '',
        isSprintTask ? 'border-l-[3px] border-l-transparent' : 'border-l-[3px] border-l-transparent',
      ].join(' ')}
      onClick={() => {
        if (!isDragging) onClick(task)
      }}
    >
      <CardHeader className="px-3 pb-1.5 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
              {task.title}
            </CardTitle>
          </div>
          <button
            type="button"
            aria-label="Drag task"
            className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 group-hover:opacity-100"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        {task.description && (
          <p className="text-xs line-clamp-2 text-muted-foreground">
            {task.description}
          </p>
        )}
        {task.deadline && (
          <p className="text-[0.7rem] text-muted-foreground">
            Due {new Date(task.deadline).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              className={`text-[0.68rem] px-2 py-0.5 ${priorityColors[task.priority] ?? ''}`}
              variant="secondary"
            >
              {priorityLabels[task.priority] ?? task.priority}
            </Badge>

              {task.sprintId && (
                <Badge
                  className="text-[0.68rem] px-2 py-0.5"
                  variant="secondary"
                >
                  {task.sprintName ?? 'Sprint'}
                </Badge>
              )}

            {typeof task.timeTotalHours === 'number' && task.timeTotalHours > 0 && (
              <Badge variant="secondary" className="text-[0.68rem] px-2 py-0.5 rounded-none">
                {task.timeTotalHours.toFixed(1)}h
              </Badge>
            )}
          </div>

          {task.assignee && (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[0.65rem]">
                {(task.assignee.name ?? task.assignee.email ?? 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </CardContent>
    </Card>
  )
}