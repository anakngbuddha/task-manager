import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'

type DocItem = {
  title: string
  details: string
}

type DocSection = {
  title: string
  summary: string
  items: DocItem[]
}

const DOC_SECTIONS: DocSection[] = [
  {
    title: 'Getting Started',
    summary: 'Core steps to start using Task Manager quickly.',
    items: [
      { title: 'Create an account', details: 'Register with email and sign in to access your workspace.' },
      { title: 'Create your first project', details: 'Use the Dashboard to create a project and start organizing tasks.' },
      { title: 'Invite team members', details: 'Generate an invite link from the project board and share it with teammates.' },
    ],
  },
  {
    title: 'Projects and Tasks',
    summary: 'Plan, assign, and track work using the board.',
    items: [
      { title: 'Kanban board', details: 'Drag and drop tasks between statuses to update progress.' },
      { title: 'Custom statuses', details: 'Use Project Settings > Board Columns, or type a custom status when creating/editing tasks.' },
      { title: 'Task details', details: 'Open any task to edit title, description, assignee, priority, status, sprint, and deadline.' },
      { title: 'Dependencies', details: 'Add blockers and blocked-by relationships to highlight task sequencing.' },
      { title: 'Comments and mentions', details: 'Collaborate in task threads and mention teammates using @name.' },
    ],
  },
  {
    title: 'Sprints and Planning',
    summary: 'Structure delivery by sprint cycles and backlog work.',
    items: [
      { title: 'Create sprints', details: 'Define sprint name, goal, start date, and end date from the board.' },
      { title: 'Sprint backlog', details: 'Review sprint and non-sprint tasks in dedicated backlog views.' },
      { title: 'Roadmap and calendar', details: 'Track scheduling and timelines using roadmap and calendar pages.' },
    ],
  },
  {
    title: 'Logs, Activity, and Time Tracking',
    summary: 'Understand team activity and time spent.',
    items: [
      { title: 'Project logs', details: 'Project Logs show activity events with your local user log time for easier reading.' },
      { title: 'Global activity feed', details: 'See organization-wide activity grouped by day and contributor.' },
      { title: 'Time logging', details: 'Log task hours/minutes and review project time reports and sprint reports.' },
      { title: 'Dashboard insights', details: 'Use widgets and charts to view completion trends and workload distribution.' },
    ],
  },
  {
    title: 'Communication and Notifications',
    summary: 'Stay aligned with built-in messaging and alerts.',
    items: [
      { title: 'Project chat', details: 'Use project messages for team-wide communication.' },
      { title: 'Direct messages', details: 'Chat one-on-one with project members when needed.' },
      { title: 'Notifications', details: 'Receive updates for assignments, status changes, and activity events.' },
    ],
  },
  {
    title: 'Integrations and Settings',
    summary: 'Configure project behavior and external integrations.',
    items: [
      { title: 'GitHub integration', details: 'Connect a GitHub App to link pull requests and automate task status updates.' },
      { title: 'Board configuration', details: 'Edit project columns/statuses from Project Settings and apply workflow changes instantly.' },
      { title: 'Profile and presence', details: 'Update your status (Online, Busy, Away, etc.) and manage account settings.' },
    ],
  },
]

export default function DocumentationPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-background">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Documentation</span>}
          title="User Guide"
          subtitle="Feature overview and step-by-step guidance for using Task Manager."
        />

        <div className="h-[calc(100vh-5rem)] overflow-auto">
          <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-8">
            {DOC_SECTIONS.map((section) => (
              <section key={section.title} className="overflow-hidden border border-border/60 bg-card">
                <div className="border-b border-border/40 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="rounded-sm text-[10px] uppercase tracking-wide">
                      Section
                    </Badge>
                    <h2 className="text-base font-semibold">{section.title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{section.summary}</p>
                </div>

                <div className="space-y-3 px-6 py-5">
                  {section.items.map((item) => (
                    <div key={item.title} className="rounded-md border border-border/40 bg-muted/20 p-4">
                      <h3 className="text-sm font-medium">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{item.details}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
