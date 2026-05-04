import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TagPill } from '@/components/board/TagInput'
import type { Tag } from '@/hooks/useTaskTags'
import { TASK_TYPE_CONFIG } from '@/lib/taskTypes'
import type { TaskType } from '@/lib/taskTypes'

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

export default function TaskCard({ task, onClick, onTagClick }: {
  task: any
  onClick: (task: any) => void
  onTagClick?: (tag: Tag) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(task.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const typeKey: TaskType = task.type ?? 'TASK'
  const typeConfig = TASK_TYPE_CONFIG[typeKey]

  const isCompleted = task.status === 'DONE' || task.status === 'READY'
  
  let isPastDue = false
  let isDueToday = false
  let hoursRemaining = 0

  if (task.deadline && !isCompleted) {
    const deadlineDate = new Date(task.deadline)
    const diffMs = deadlineDate.getTime() - Date.now()
    if (diffMs < 0) {
      isPastDue = true
    } else {
      const now = new Date()
      isDueToday = deadlineDate.getFullYear() === now.getFullYear() &&
                   deadlineDate.getMonth() === now.getMonth() &&
                   deadlineDate.getDate() === now.getDate()
      
      if (isDueToday || diffMs < 24 * 60 * 60 * 1000) {
        hoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
      }
    }
  }

  const columnBorderColor = isPastDue ? 'border-red-500' : (columnBorderColors[task.status] || 'border-border')
  const progressBgColor = columnBgColors[task.status] || 'bg-primary'
  const cardBgColor = isPastDue ? 'bg-red-50/50 dark:bg-red-950/20' : 'bg-card'

  const totalSubtasks = task.children?.length || 0
  const completedSubtasks = task.children?.filter((t: any) => t.status === 'DONE' || t.status === 'READY').length || 0
  const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group cursor-pointer rounded-lg shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        cardBgColor,
        isDragging ? 'shadow-none z-50' : '',
        'border-t border-r border-b border-l-2',
        isPastDue ? 'border-red-500' : `${columnBorderColor} ${typeConfig.borderColor}`,
      ].join(' ')}
      onClick={() => {
        if (!isDragging) onClick(task)
      }}
      {...attributes}
      {...listeners}
    >
      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Type badge */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${typeConfig.badgeColor} ${typeConfig.textColor}`}>
            <span>{typeConfig.icon}</span>
            <span>{typeConfig.label}</span>
          </span>
        </div>

        {/* Parent reference */}
        {task.parent && (
          <span className="text-[11px] text-muted-foreground truncate leading-tight">
            {TASK_TYPE_CONFIG[task.parent.type as TaskType]?.icon ?? ''} {task.parent.title}
          </span>
        )}

        {/* Title */}
        <h3 className="text-[13px] font-semibold leading-snug line-clamp-2 text-foreground">
          {task.title}
        </h3>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(task.tags as Array<{ tag: Tag }>).slice(0, 3).map(({ tag }) => (
              <TagPill
                key={tag.id}
                tag={tag}
                size="xs"
                onClick={onTagClick ? () => onTagClick(tag) : undefined}
              />
            ))}
            {task.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground font-medium self-center">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Children Progress */}
        {totalSubtasks > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-medium text-muted-foreground">
              {completedSubtasks}/{totalSubtasks} child tasks
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
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.deadline && (
              <div className={`text-[11px] font-medium ${isPastDue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-muted-foreground/80'}`}>
                {isPastDue ? 'Past Due' : `Due ${new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </div>
            )}
            {isDueToday && !isPastDue && (
              <div className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse" title={`${hoursRemaining} hours remaining`}>
                ⏳ {hoursRemaining > 0 ? `${hoursRemaining}h left` : '<1h left'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {task.timeTotalHours > 0 && (
              <span className="text-[10px] text-muted-foreground mr-1 font-medium bg-muted px-1.5 py-0.5 rounded">
                {task.timeTotalHours.toFixed(1)}h
              </span>
            )}
            {task.assignee ? (
              <Avatar className="h-6 w-6 border border-border" title={task.assignee.name ?? task.assignee.email}>
                <AvatarFallback className="text-[10px] font-medium">
                  {(task.assignee.name ?? task.assignee.email ?? 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Avatar className="h-6 w-6 border border-border" title="Assigned to Everyone">
                <AvatarFallback className="text-[9px] font-medium bg-primary/10 text-primary">
                  All
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}