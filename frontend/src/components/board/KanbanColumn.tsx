import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'

const columnStyles: Record<string, string> = {
  TODO:        'bg-[oklch(0.96_0.01_245)] text-[oklch(0.22_0.04_250)]',
  IN_PROGRESS: 'bg-[oklch(0.94_0.03_192)] text-[oklch(0.22_0.04_250)]',
  IN_REVIEW:   'bg-[oklch(0.96_0.02_95)] text-[oklch(0.22_0.04_250)]',
  DONE:        'bg-[oklch(0.95_0.03_150)] text-[oklch(0.22_0.04_250)]',
  READY:       'bg-[oklch(0.95_0.02_40)] text-[oklch(0.22_0.04_250)]',
}

const columnLabels: Record<string, string> = {
  TODO:        'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW:   'In Review',
  DONE:        'Done',
  READY:       'Ready',
}

export default function KanbanColumn({ status, tasks, onTaskClick }: {
  status: string
  tasks: any[]
  onTaskClick: (task: any) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex w-64 shrink-0 flex-col sm:w-72">
      <div className="border border-border/60 bg-card/70 shadow-sm">
        <div className="sticky top-0 z-10 border-b border-border/60 bg-card/85 px-2 py-1.5 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {columnLabels[status]}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex h-5 items-center rounded-full px-1.5 text-[0.7rem] font-medium ${columnStyles[status]}`}>
                  {columnLabels[status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
            </div>
            <span className="grid size-7 place-items-center border border-border/60 bg-background/60 text-xs font-semibold">
              {tasks.length}
            </span>
          </div>
        </div>

        <SortableContext items={tasks.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={`min-h-32 space-y-1.5 overflow-auto p-2 transition-colors ${
              isOver ? 'bg-accent/40 ring-1 ring-primary/25' : 'bg-transparent'
            }`}
          >
            {tasks.length === 0 ? (
              <div className="border border-dashed border-border/70 bg-background/40 p-3 text-center text-xs text-muted-foreground">
                Drop tasks here
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard key={task.id} task={task} onClick={onTaskClick} />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}