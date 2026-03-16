import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    DndContext, PointerSensor, useSensor, useSensors, closestCorners,
    DragOverlay,
  } from '@dnd-kit/core'
  import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import Sidebar from '@/components/layout/Sidebar'
import KanbanColumn from '@/components/board/KanbanColumn'
import TaskCard from '@/components/board/TaskCard'
import TaskDialog from '@/components/board/TaskDialog'
import { useTasks, useUpdateTask, useCreateTask } from '@/hooks/useTasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COLUMNS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: tasks = [], isLoading } = useTasks(projectId!)
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()

  const [activeTask, setActiveTask] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }))

  const getColumnTasks = (status: string) =>
    tasks.filter((t: any) => t.status === status)

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTask(tasks.find((t: any) => t.id === e.active.id))
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const task = tasks.find((t: any) => t.id === active.id)
    const newStatus = COLUMNS.includes(over.id as string)
      ? over.id as string
      : tasks.find((t: any) => t.id === over.id)?.status

    if (task && newStatus && newStatus !== task.status) {
      await updateTask.mutateAsync({
        id: task.id,
        projectId: projectId!,
        status: newStatus,
      })
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createTask.mutateAsync({
      title: newTitle.trim(),
      projectId: projectId!,
      priority: newPriority,
    })
    setNewTitle('')
    setNewPriority('MEDIUM')
    setCreateOpen(false)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Board</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">+ Add Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input
                    placeholder="Task title"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createTask.isPending}>
                  {createTask.isPending ? 'Creating...' : 'Create task'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading tasks...</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={getColumnTasks(status)}
                  onTaskClick={setSelectedTask}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <TaskCard task={activeTask} onClick={() => {}} />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {selectedTask && (
        <TaskDialog
          task={selectedTask}
          projectId={projectId!}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}