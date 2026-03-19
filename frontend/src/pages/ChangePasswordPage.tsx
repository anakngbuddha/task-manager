import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'

export default function ChangePasswordPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Profile / Security</span>}
          title="Change password"
          subtitle="Update your password to keep your account secure."
        />

        <section className="px-6 py-6 sm:px-8">
          <div className="border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            Change password UI coming next.
          </div>
        </section>
      </main>
    </div>
  )
}

