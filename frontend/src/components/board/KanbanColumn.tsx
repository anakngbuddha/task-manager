import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'

const columnStyles: Record<string, string> = {
  TODO:        'border-t-slate-400',
  IN_PROGRESS: 'border-t-blue-400',
  IN_REVIEW:   'border-t-yellow-400',
  DONE:        'border-t-green-400',
}

const columnLabels: Record<string, string> = {
  TODO:        'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW:   'In Review',
  DONE:        'Done',
}

export default function KanbanColumn({ status, tasks, onTaskClick }: {
  status: string
  tasks: any[]
  onTaskClick: (task: any) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className={`rounded-t-md border-t-4 ${columnStyles[status]} bg-muted/40 px-3 py-2 mb-2`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{columnLabels[status]}</span>
          <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5 border">
            {tasks.length}
          </span>
        </div>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2 min-h-32 rounded-md p-1 transition-colors ${
            isOver ? 'bg-accent' : ''
          }`}
        >
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}