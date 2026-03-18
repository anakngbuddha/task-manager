import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

const priorityColors: Record<string, string> = {
  LOW:    'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group cursor-default rounded-none border-border/60 bg-card/90 transition-colors hover:border-primary/60"
      onClick={() => {
        if (!isDragging) onClick(task)
      }}
    >
      <CardHeader className="px-2 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xs font-medium leading-snug line-clamp-2">
              {task.title}
            </CardTitle>
            {task.deadline && (
              <p className="text-[0.65rem] text-muted-foreground">
                Due {new Date(task.deadline).toLocaleString()}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Drag task"
            className="inline-flex shrink-0 items-center justify-center p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-0 space-y-1">
        {task.description && (
          <p className="text-[0.7rem] text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Badge className={`text-[0.68rem] px-1.5 py-0.5 ${priorityColors[task.priority]}`} variant="outline">
            {priorityLabels[task.priority] ?? task.priority}
          </Badge>
          {task.assignee && (
            <span className="text-[0.68rem] text-muted-foreground truncate max-w-[8rem]">{task.assignee.name}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}