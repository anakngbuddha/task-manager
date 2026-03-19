import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'

export default function SettingsPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Profile / Settings</span>}
          title="Settings"
          subtitle="Account and workspace preferences."
        />

        <section className="px-6 py-6 sm:px-8">
          <div className="border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            Settings UI coming next.
          </div>
        </section>
      </main>
    </div>
  )
}

