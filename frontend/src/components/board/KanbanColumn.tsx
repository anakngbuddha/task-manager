import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'

const columnTopBorder: Record<string, string> = {
  TODO: 'border-t-blue-500',
  IN_PROGRESS: 'border-t-purple-500',
  IN_REVIEW: 'border-t-amber-500',
  DONE: 'border-t-emerald-500',
  READY: 'border-t-primary',
}

const columnTextColor: Record<string, string> = {
  TODO: 'text-blue-600 dark:text-blue-400',
  IN_PROGRESS: 'text-purple-600 dark:text-purple-400',
  IN_REVIEW: 'text-amber-600 dark:text-amber-400',
  DONE: 'text-emerald-600 dark:text-emerald-400',
  READY: 'text-primary',
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
      <div className={`rounded-lg bg-transparent flex flex-col h-full`}>
        <div className={`sticky top-0 z-10 bg-card px-3 py-3 border-t-4 rounded-t-lg shadow-sm border-x border-x-border/40 ${columnTopBorder[status] || 'border-t-muted-foreground'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[13px] font-semibold tracking-wide uppercase ${columnTextColor[status] || 'text-muted-foreground'}`}>
              {columnLabels[status]} <span className="text-muted-foreground ml-1 font-medium tabular-nums">({tasks.length})</span>
            </p>
            <div className="flex items-center gap-1">
              <button className="text-muted-foreground hover:text-foreground">
                <span className="text-lg leading-none tracking-widest translate-y-[-4px] block">...</span>
              </button>
            </div>
          </div>
        </div>

        <SortableContext items={tasks.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={`min-h-[150px] space-y-3 overflow-auto py-3 transition-colors ${
              isOver ? 'bg-accent/40 ring-1 ring-primary/25 rounded-b-lg' : 'bg-transparent'
            }`}
          >
            {tasks.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-border/70 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">
                <div className="mx-auto leading-relaxed">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-card py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground shadow-sm transition-colors"
              onClick={() => {
                if (!canAddTask) return
                onAddTask?.(status)
              }}
              disabled={!canAddTask}
            >
              + Quick Add
            </button>
          </div>
        </SortableContext>
      </div>
    </div>
  )
}