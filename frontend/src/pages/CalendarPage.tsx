import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useTasks } from '@/hooks/useTasks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Render a monthly calendar view
export default function CalendarPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: tasks = [], isLoading } = useTasks(projectId!)

  const [currentDate, setCurrentDate] = useState(new Date())

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const { daysInMonth, firstDayOfMonth, monthName, year } = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    return {
      daysInMonth: new Date(y, m + 1, 0).getDate(),
      firstDayOfMonth: new Date(y, m, 1).getDay(), // 0 = Sunday
      monthName: currentDate.toLocaleDateString(undefined, { month: 'long' }),
      year: y,
    }
  }, [currentDate])

  const calendarDays = useMemo(() => {
    const days: { date: Date | null; tasks: any[] }[] = []
    
    // Empty cells for days before the 1st
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push({ date: null, tasks: [] })
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, currentDate.getMonth(), i)
        
        // Find tasks whose deadline falls on this day
        const dayTasks = tasks.filter((t: any) => {
            if (!t.deadline) return false
            const tDate = new Date(t.deadline)
            return tDate.getFullYear() === d.getFullYear() && 
                   tDate.getMonth() === d.getMonth() && 
                   tDate.getDate() === d.getDate()
        })

        days.push({ date: d, tasks: dayTasks })
    }
    
    // Fill remaining cells to complete the grid (multiple of 7)
    while (days.length % 7 !== 0) {
        days.push({ date: null, tasks: [] })
    }

    return days
  }, [daysInMonth, firstDayOfMonth, year, currentDate, tasks])

  const today = new Date()

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background flex flex-col">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Calendar</span>}
          title="Calendar"
          subtitle="View tasks by their deadlines."
          actions={
            <div className="flex items-center gap-3">
               <div className="flex items-center bg-card rounded-md border shadow-sm">
                 <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 p-0"><ChevronLeft className="size-4" /></Button>
                 <span className="text-sm font-semibold w-32 text-center">{monthName} {year}</span>
                 <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 p-0"><ChevronRight className="size-4" /></Button>
               </div>
               <Link to={`/projects/${projectId}`}>
                  <Badge variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-muted text-sm border-primary/20 bg-background h-9 rounded-md items-center justify-center flex font-medium">← Back to Board</Badge>
               </Link>
            </div>
          }
        />
        
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {isLoading ? (
             <div className="p-8 text-center text-muted-foreground flex items-center justify-center h-full">Loading calendar...</div>
          ) : (
            <div className="flex-1 bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r last:border-0">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              <div className="flex-1 grid grid-cols-7 overflow-y-auto">
                {calendarDays.map((cell, idx) => {
                  const isToday = cell.date && 
                    cell.date.getDate() === today.getDate() && 
                    cell.date.getMonth() === today.getMonth() && 
                    cell.date.getFullYear() === today.getFullYear()
                  
                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "p-2 border-r border-b min-h-[120px] bg-background hover:bg-muted/10 transition-colors flex flex-col gap-1",
                        !cell.date && "bg-muted/5"
                      )}
                    >
                      {cell.date && (
                        <div className="flex justify-between items-start mb-1">
                          <span className={cn(
                            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                            isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                          )}>
                            {cell.date.getDate()}
                          </span>
                        </div>
                      )}
                      
                      {cell.tasks.map((t: any) => (
                        <div 
                           key={t.id} 
                           className={cn(
                             "text-xs p-1.5 rounded border shadow-sm truncate font-medium",
                             t.status === 'DONE' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" :
                             t.status === 'IN_PROGRESS' ? "bg-blue-500/10 border-blue-500/20 text-blue-700" :
                             "bg-card border-border"
                           )}
                           title={t.title}
                        >
                          {t.title}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
