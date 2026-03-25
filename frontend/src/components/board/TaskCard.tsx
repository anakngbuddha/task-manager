import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const columnBorderColors: Record<string, string> = {
  TODO: 'border-blue-500',
  IN_PROGRESS: 'border-purple-500',
  IN_REVIEW: 'border-amber-500',
  DONE: 'border-emerald-500',
  READY: 'border-primary',
}

const columnBgColors: Record<string, string> = {
  TODO: 'bg-blue-500',
  IN_PROGRESS: 'bg-purple-500',
  IN_REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
  READY: 'bg-primary',
}

export default function TaskCard({ task, onClick }: {
  task: any
  onClick: (task: any) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(task.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const borderColor = columnBorderColors[task.status] || 'border-border'
  const progressBgColor = columnBgColors[task.status] || 'bg-primary'

  const totalSubtasks = task.subtasks?.length || 0
  const completedSubtasks = task.subtasks?.filter((t: any) => t.status === 'DONE' || t.status === 'READY').length || 0
  const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group cursor-pointer rounded-lg bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        isDragging ? 'shadow-none z-50' : '',
        'border',
        borderColor,
      ].join(' ')}
      onClick={() => {
        if (!isDragging) onClick(task)
      }}
      {...attributes}
      {...listeners}
    >
      <div className="p-3.5 flex flex-col gap-3">
        {/* Title */}
        <h3 className="text-[13px] font-semibold leading-snug line-clamp-2 text-foreground">
          {task.title}
        </h3>

        {/* Subtasks Progress */}
        {totalSubtasks > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">
              {completedSubtasks}/{totalSubtasks} subtasks
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full ${progressBgColor} transition-all duration-300`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom row: Due Date & Avatar */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] font-medium text-muted-foreground/80">
            {task.deadline ? `Due ${new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </div>

          <div className="flex items-center gap-1">
            {task.timeTotalHours > 0 && (
              <span className="text-[10px] text-muted-foreground mr-1 font-medium bg-muted px-1.5 py-0.5 rounded">
                {task.timeTotalHours.toFixed(1)}h
              </span>
            )}
            {task.assignee && (
              <Avatar className="h-6 w-6 border border-border">
                <AvatarFallback className="text-[10px] font-medium">
                  {(task.assignee.name ?? task.assignee.email ?? 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}