import { Link } from 'react-router-dom'
import { FolderKanban, Workflow, Activity, GitPullRequest, Code2, Clock, CheckCircle2, AlertCircle, Terminal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const DOC_CONTENTS = [
  {
    id: "introduction",
    title: "Introduction",
    icon: FolderKanban,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>Welcome to <strong>We Work IT</strong>, your centralized hub for software engineering project management and agile team collaboration.</p>
        <p>We Work IT is designed specifically for modern engineering teams. It brings together kanban boards, real-time syncs, automated sprint metrics, and deep GitHub integrations into a single, cohesive interface. Our goal is to make managing your software development lifecycle as seamless and unobtrusive as possible.</p>
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg mt-6">
          <AlertCircle className="size-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-foreground">Tip: We Work IT uses real-time WebSockets. Any change you make to a board, task, or dependency is instantly reflected on your teammates' screens without them needing to refresh.</p>
        </div>
      </div>
    )
  },
  {
    id: "kanban",
    title: "Projects & Kanban",
    icon: CheckCircle2,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>At the core of every workspace is a customizable Kanban board. This provides immediate visual feedback on the state of your work.</p>
        <ul className="list-disc pl-6 space-y-2 mt-4 marker:text-primary">
          <li><strong>Creating Tasks:</strong> Click "New Task" in any column. You can assign owners, due dates, estimates, and labels instantly from the board.</li>
          <li><strong>Custom Workflows:</strong> Unlike rigid tools, We Work IT allows you to define your custom statuses under Project Settings. You can create flows like <em>Backlog &rarr; To Do &rarr; In Review &rarr; QA &rarr; Done</em>.</li>
          <li><strong>Drag & Drop:</strong> Reorder your priorities rapidly by dragging tasks up and down a column, or transition their state by dragging them horizontally to another status column.</li>
        </ul>
      </div>
    )
  },
  {
    id: "sprints",
    title: "Sprint Management",
    icon: Activity,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>If your team practices Agile, the Sprint Management tools provide everything you need to execute effectively.</p>
        <p>Sprints isolate a specific timeframe and goal constraint. Use the <em>Sprint Backlog</em> view to quickly marshal tasks from your main backlog into an upcoming sprint.</p>
        <h4 className="text-foreground font-semibold mt-6 mb-2">Sprint Reports</h4>
        <p>When a sprint concludes, the system automatically aggregates the velocity, completed tasks versus rolled-over tasks, and generates visual pie charts showing team workload distribution. This empowers your retrospective meetings with empirical tracking data.</p>
      </div>
    )
  },
  {
    id: "dependencies",
    title: "Dependencies & Roadmaps",
    icon: Workflow,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>Complex engineering tasks rarely exist in a vacuum. We Work IT features highly interactive topological mapping of task blockers.</p>
        <p>Inside any task modal, use the "Linked Tasks" section to declare if a task is <code>Blocked By</code> another task, or if it <code>Blocks</code> something else. The system understands these relationships globally.</p>
        <p>The <strong>Dependency Diagram</strong> view then renders a beautiful, interactive node graph using Dagre, helping product managers identify massive bottlenecks or critical pathing instantly.</p>
      </div>
    )
  },
  {
    id: "time",
    title: "Time Tracking",
    icon: Clock,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>Tracking the time dedicated to specific issues is vital for evaluating accurate estimations and tracking burnout.</p>
        <ul className="list-disc pl-6 space-y-2 mt-4 marker:text-primary">
          <li><strong>Logging Time:</strong> Open a task and navigate to the "Time" tab. You can input hours and minutes natively.</li>
          <li><strong>Time Reports:</strong> Project managers can view aggregated time reports, filtering by user and timeframe to generate CSV exports suitable for invoicing.</li>
        </ul>
      </div>
    )
  },
  {
    id: "github",
    title: "GitHub Integrations",
    icon: GitPullRequest,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>Our native GitHub integration eliminates the manual overhead of updating ticket statuses.</p>
        <p>By connecting a repository in your Project Settings, the system listens for webhooks. When a developer creates a Pull Request and mentions a Task ID (e.g., <code>TSK-124</code>) in the description, the platform automatically links the PR. Furthermore, when the PR is merged, the task gracefully auto-transitions to the configured "Done" status.</p>
        <p>You can monitor active branches, recently opened PRs, and commit velocity directly on the "GitHub Activity" dashboard tab.</p>
      </div>
    )
  },
  {
    id: "api",
    title: "API Integrations",
    icon: Code2,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>For operations that demand custom automations, We Work IT exposes a robust, secure REST API.</p>
        <div className="bg-sidebar border border-sidebar-border rounded-lg p-4 font-mono text-sm overflow-x-auto text-sidebar-foreground">
          <span className="text-blue-400">GET</span> /api/v1/projects/:id/tasks <br />
          <span className="text-emerald-400">POST</span> /api/v1/tasks <br />
          <span className="text-emerald-400">POST</span> /api/v1/tasks/:id/comments
        </div>
        <p className="mt-4">You can provision organizational or personal access tokens securely within your user settings page. We strongly support webhook registrations for external services requiring realtime task state updates (e.g., Slack or custom internal CRMs).</p>
      </div>
    )
  },
  {
    id: "cli",
    title: "Command Line Interface (CLI)",
    icon: Terminal,
    content: (
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>We Work IT includes a powerful, retro-styled Virtual File System (VFS) terminal built directly into the UI. You can open it from anywhere inside a project by hitting <code>Ctrl + `</code> or clicking the terminal widget at the bottom left of your dashboard.</p>
        
        <h4 className="text-foreground font-semibold mt-6 mb-2">Read & Navigation Commands</h4>
        <div className="bg-sidebar border border-sidebar-border rounded-lg p-4 font-mono text-sm overflow-x-auto text-sidebar-foreground">
          <ul className="space-y-2">
            <li><span className="text-blue-400">pwd</span> - Print current virtual directory.</li>
            <li><span className="text-blue-400">cd</span> &lt;path&gt; - Change directory. <i>Ex: cd tasks/todo</i></li>
            <li><span className="text-blue-400">ls</span> [path] - List contents. <i>Ex: ls sprints</i></li>
            <li><span className="text-blue-400">cat</span> &lt;file&gt; - View JSON entity details. <i>Ex: cat tasks/todo/my-task__123.json</i></li>
            <li><span className="text-blue-400">find</span> &lt;path&gt; [--key=value...] - Search files. <i>Ex: find tasks/ --priority=HIGH</i></li>
            <li><span className="text-blue-400">stat</span> [path] - View directory stats. <i>Ex: stat tasks/</i></li>
            <li><span className="text-blue-400">whoami</span> - Show session info and project role.</li>
            <li><span className="text-blue-400">help</span> [cmd] - Show help documentation. <i>Ex: help ls</i></li>
          </ul>
        </div>

        <h4 className="text-foreground font-semibold mt-6 mb-2">Write Commands (Requires Admin/PM Role)</h4>
        <p>Most write commands mirror a standard UNIX system, allowing efficient, keyboard-centric management.</p>
        <div className="bg-sidebar border border-sidebar-border rounded-lg p-4 font-mono text-sm overflow-x-auto text-sidebar-foreground">
          <ul className="space-y-2">
            <li><span className="text-emerald-400">touch</span> &lt;type&gt; - Create an entity.
              <br/><span className="text-muted-foreground ml-4">Ex: touch tasks/todo/my-new-task.json --priority=HIGH --assignee=user@example.com</span>
              <br/><span className="text-muted-foreground ml-4">Ex: touch sprints/sprint-1.json --goal="MVP"</span>
              <br/><span className="text-muted-foreground ml-4">Ex: touch schedules/sync.json --at=2025-12-31T00:00:00Z --type=MEETING</span>
            </li>
            <li className="mt-2"><span className="text-emerald-400">rm</span> &lt;path&gt; - Delete an entity.
              <br/><span className="text-muted-foreground ml-4">Ex: rm tasks/todo/task__123.json</span>
            </li>
            <li className="mt-2"><span className="text-emerald-400">mv</span> &lt;src&gt; &lt;dest&gt; - Move task status column.
              <br/><span className="text-muted-foreground ml-4">Ex: mv tasks/todo/task__123.json tasks/in_progress/</span>
            </li>
          </ul>
        </div>

        <h4 className="text-foreground font-semibold mt-6 mb-2">Sprint & Team Management Commands</h4>
        <div className="bg-sidebar border border-sidebar-border rounded-lg p-4 font-mono text-sm overflow-x-auto text-sidebar-foreground">
          <ul className="space-y-2">
            <li><span className="text-indigo-400">start</span> &lt;sprint_path&gt; - Start a planning sprint.
              <br/><span className="text-muted-foreground ml-4">Ex: start sprints/sprint-1.json --start=2025-01-01 --end=2025-01-14</span>
            </li>
            <li className="mt-2"><span className="text-indigo-400">close</span> &lt;sprint_path&gt; - Complete an active sprint.
              <br/><span className="text-muted-foreground ml-4">Ex: close sprints/sprint-1.json --move-to=TODO</span>
            </li>
            <li className="mt-2"><span className="text-indigo-400">setrole</span> &lt;member_path&gt; --role=&lt;role&gt; - Change member role.
              <br/><span className="text-muted-foreground ml-4">Ex: setrole members/user@example.com --role=PROJECT_MANAGER</span>
            </li>
            <li className="mt-2"><span className="text-indigo-400">invite</span> &lt;email&gt; - Invite user to project.</li>
          </ul>
        </div>

        <h4 className="text-foreground font-semibold mt-6 mb-2">Collaboration & Tooling Commands</h4>
        <div className="bg-sidebar border border-sidebar-border rounded-lg p-4 font-mono text-sm overflow-x-auto text-sidebar-foreground">
          <ul className="space-y-2">
            <li><span className="text-purple-400">log</span> &lt;task_path&gt; - Log time against a task.
              <br/><span className="text-muted-foreground ml-4">Ex: log tasks/todo/task__123.json --minutes=120 --title="Frontend Dev" --desc="Built UI"</span>
            </li>
            <li className="mt-2"><span className="text-purple-400">msg</span> "&lt;text&gt;" - Broadcast to project chat.</li>
            <li className="mt-2"><span className="text-purple-400">dm</span> &lt;email&gt; "&lt;text&gt;" - Direct message user.</li>
            <li className="mt-2"><span className="text-purple-400">github status</span> - View GitHub connection health.</li>
            <li className="mt-2"><span className="text-purple-400">github setmap</span> - Update github PR mappings.
              <br/><span className="text-muted-foreground ml-4">Ex: github setmap --pr_merged=DONE --pr_opened=IN_REVIEW</span>
            </li>
          </ul>
        </div>
      </div>
    )
  }
]

export default function DocumentationPage() {
  const [activeHash, setActiveHash] = useState(DOC_CONTENTS[0].id)

  // Intersection observer to track which section is currently on screen
  useEffect(() => {
    const handleScroll = () => {
      const sections = DOC_CONTENTS.map(c => document.getElementById(c.id))
      const scrollPosition = window.scrollY + 100 // offset for fixed header

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveHash(section.id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    // Trigger once on mount
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToHash = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      const offset = 80 // Height of sticky nav + padding
      const bodyRect = document.body.getBoundingClientRect().top
      const elementRect = element.getBoundingClientRect().top
      const elementPosition = elementRect - bodyRect
      const offsetPosition = elementPosition - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
      window.history.pushState(null, '', `#${id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* ── Top Nav ── */}
      <nav className="h-16 border-b border-border/40 px-4 md:px-8 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <Link to="/" className="flex items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <img src="/logo.png" alt="We Work IT Logo" className="size-7 object-contain drop-shadow-sm" />
          <span className="font-bold tracking-tight text-lg">We Work IT <span className="font-normal text-muted-foreground ml-1">Docs</span></span>
        </Link>
        <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/50">
          Back to Home
        </Link>
      </nav>

      {/* ── Main Layout ── */}
      <main className="flex-1 w-full max-w-[90rem] mx-auto flex flex-col md:flex-row items-start relative px-4 md:px-8">

        {/* Left Sidebar Table of Contents (Sticky) */}
        <aside className="hidden md:block w-64 shrink-0 py-10 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto hidden-scrollbar border-r border-border/30 pr-6 mr-8">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6 pl-2">Documentation</h3>
          <nav className="space-y-1">
            {DOC_CONTENTS.map(doc => (
              <a
                key={doc.id}
                href={`#${doc.id}`}
                onClick={(e) => scrollToHash(doc.id, e)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors border",
                  activeHash === doc.id
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
                )}
              >
                <doc.icon className={cn("size-4", activeHash === doc.id && "text-primary")} />
                {doc.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1 max-w-4xl py-10 pb-32 w-full">
          {/* Mobile TOC Header Dropdown simulation or just let mobile scroll */}
          <div className="md:hidden mb-10 overflow-x-auto pb-4 flex gap-2 snap-x scrollbar-hide">
            {DOC_CONTENTS.map(doc => (
              <button
                key={doc.id}
                onClick={(e) => scrollToHash(doc.id, e as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 shrink-0 rounded-full text-sm border font-medium snap-start",
                  activeHash === doc.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border/50 hover:bg-muted"
                )}
              >
                {doc.title}
              </button>
            ))}
          </div>

          <div className="space-y-24">
            {DOC_CONTENTS.map(doc => (
              <section key={doc.id} id={doc.id} className="scroll-mt-24 group border-b border-border/30 pb-16 last:border-0">
                <div className="flex items-center gap-4 mb-8">
                  <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
                    <doc.icon className="size-6" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">{doc.title}</h2>
                </div>
                <div className="text-lg">
                  {doc.content}
                </div>
              </section>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
