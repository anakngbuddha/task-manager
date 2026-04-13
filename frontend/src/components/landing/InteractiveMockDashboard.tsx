import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Clock, LayoutGrid, CheckSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

type MockTaskInfo = { id: number; title: string; status: 'todo' | 'in-progress' | 'done'; tag: string }

const INITIAL_TASKS: MockTaskInfo[] = [
  { id: 1, title: 'Design Landing Page', status: 'done', tag: 'Design' },
  { id: 2, title: 'Setup Authentication Flow', status: 'done', tag: 'Engineering' },
  { id: 3, title: 'Implement Interactive Preview', status: 'in-progress', tag: 'Feature' },
  { id: 4, title: 'Integrate Documentation API', status: 'todo', tag: 'Engineering' },
  { id: 5, title: 'Configure CI/CD Pipeline', status: 'todo', tag: 'DevOps' },
]

export default function InteractiveMockDashboard() {
  const [tasks, setTasks] = useState<MockTaskInfo[]>(INITIAL_TASKS)
  const [activeTab, setActiveTab] = useState<'board' | 'list'>('board')

  const cycleStatus = (id: number) => {
    setTasks(current => current.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'todo' ? 'in-progress' : t.status === 'in-progress' ? 'done' : 'todo'
        return { ...t, status: nextStatus }
      }
      return t
    }))
  }

  const columns = [
    { id: 'todo', title: 'To Do', icon: Circle, color: 'text-muted-foreground' },
    { id: 'in-progress', title: 'In Progress', icon: Clock, color: 'text-blue-500' },
    { id: 'done', title: 'Done', icon: CheckCircle2, color: 'text-emerald-500' }
  ]

  return (
    <div className="w-full h-full text-foreground flex overflow-hidden">
      {/* Mock Sidebar */}
      <div className="hidden sm:flex flex-col w-48 lg:w-56 bg-sidebar border-r border-sidebar-border/50 shrink-0 select-none">
        <div className="p-4 flex items-center gap-2">
          <div className="size-6 rounded bg-primary" />
          <span className="font-semibold text-xs tracking-wide">Workspace</span>
        </div>
        <div className="flex-1 px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 text-primary bg-primary/10 px-2 py-1.5 rounded text-sm font-medium">
            <LayoutGrid className="size-4" /> Board
          </div>
          <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent px-2 py-1.5 rounded text-sm font-medium transition-colors cursor-not-allowed">
            <CheckSquare className="size-4" /> My Tasks
          </div>
          <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent px-2 py-1.5 rounded text-sm font-medium transition-colors cursor-not-allowed">
            <Settings className="size-4" /> Settings
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-background relative overflow-hidden select-none">
        
        {/* Header */}
        <div className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-card/30 backdrop-blur-sm z-10 shrink-0">
          <h2 className="font-semibold text-lg">Project NextGen Overview</h2>
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button 
              onClick={() => setActiveTab('board')}
              className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", activeTab === 'board' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
            >
              Board
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", activeTab === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
            >
              List
            </button>
          </div>
        </div>

        {/* Board Workspace */}
        <div className="flex-1 p-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'board' ? (
              <motion.div 
                key="board"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-start"
              >
                {columns.map(col => (
                  <div key={col.id} className="bg-muted/40 rounded-xl p-3 flex flex-col gap-3 min-h-[14rem] border border-border/40">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <col.icon className={cn("size-4", col.color)} />
                        <span className="font-semibold text-sm">{col.title}</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground bg-muted w-5 h-5 rounded-full flex items-center justify-center">
                        {tasks.filter(t => t.status === col.id).length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <AnimatePresence>
                        {tasks.filter(t => t.status === col.id).map(task => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={() => cycleStatus(task.id)}
                            className="bg-card border border-border/50 rounded-lg p-3 shadow-sm cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                          >
                            <div className="flex flex-col gap-2 relative z-10">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary w-fit">
                                {task.tag}
                              </span>
                              <span className="text-sm font-medium group-hover:text-primary transition-colors">{task.title}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to move status
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="bg-muted/30 border border-border/40 rounded-xl flex flex-col overflow-hidden"
              >
                {tasks.map((task, i) => (
                  <div key={task.id} 
                    className={cn(
                      "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                      i !== tasks.length - 1 && "border-b border-border/40"
                    )}
                    onClick={() => cycleStatus(task.id)}
                  >
                    <div className="flex items-center gap-3">
                      {task.status === 'done' && <CheckCircle2 className="size-4 text-emerald-500" />}
                      {task.status === 'in-progress' && <Clock className="size-4 text-blue-500" />}
                      {task.status === 'todo' && <Circle className="size-4 text-muted-foreground" />}
                      <span className={cn("text-sm font-medium", task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{task.tag}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Informative Floating Badge */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-md border border-border rounded-full px-4 py-2 shadow-lg shadow-black/5 flex items-center gap-2 pointer-events-none z-20 hidden md:flex">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
          </span>
          <span className="text-xs font-semibold">Interactive Mockup - Click cards to move them!</span>
        </div>
      </div>
    </div>
  )
}
