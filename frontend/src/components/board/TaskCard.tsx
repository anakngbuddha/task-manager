import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const priorityColors: Record<string, string> = {
  LOW:    'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

export default function TaskCard({ task, onClick }: {
  task: any
  onClick: (task: any) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
      onClick={() => onClick(task)}
    >
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm font-medium leading-snug">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-2">
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center justify-between">
          <Badge className={`text-xs px-1.5 py-0 ${priorityColors[task.priority]}`} variant="outline">
            {task.priority}
          </Badge>
          {task.assignee && (
            <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}