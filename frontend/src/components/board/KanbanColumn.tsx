import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'

const columnDot: Record<string, string> = {
  TODO: 'bg-muted-foreground/45',
  IN_PROGRESS: 'bg-blue-500',
  IN_REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
  READY: 'bg-primary',
}

const columnLabels: Record<string, string> = {
  TODO:        'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW:   'In Review',
  DONE:        'Done',
  READY:       'Ready',
}

export default function KanbanColumn({ status, tasks, onTaskClick, onAddTask, canAddTask }: {
  status: string
  tasks: any[]
  onTaskClick: (task: any) => void
  onAddTask?: (status: string) => void
  canAddTask?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex w-64 shrink-0 flex-col sm:w-72">
      <div className="rounded-xl border border-border/60 bg-card/70 shadow-sm">
        <div className="sticky top-0 z-10 border-b border-border/60 bg-card/85 px-3 py-2 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className={['h-2 w-2 rounded-full translate-y-[1px]', columnDot[status] ?? 'bg-muted-foreground/45'].join(' ')} />
              <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                {columnLabels[status]}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums leading-none">
                {tasks.length}
              </span>
            </div>
          </div>
        </div>

        <SortableContext items={tasks.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={`min-h-32 space-y-2 overflow-auto p-3 transition-colors ${
              isOver ? 'bg-accent/40 ring-1 ring-primary/25' : 'bg-transparent'
            }`}
          >
            {tasks.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-border/70 bg-background/20 px-3 py-8 text-center text-xs text-muted-foreground">
                <div className="mx-auto max-w-[10rem] leading-relaxed">
                  Drop tasks here
                </div>
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard key={task.id} task={task} onClick={onTaskClick} />
              ))
            )}

            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              onClick={() => {
                if (!canAddTask) return
                onAddTask?.(status)
              }}
              disabled={!canAddTask}
            >
              <span className="text-base leading-none">+</span>
              Add task
            </button>
          </div>
        </SortableContext>
      </div>
    </div>
  )
}