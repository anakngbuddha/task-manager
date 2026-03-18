import Sidebar from '@/components/layout/Sidebar'

export default function ChangePasswordPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="border-b bg-background/80 backdrop-blur">
          <div className="px-6 py-6 sm:px-8">
            <h2 className="text-2xl font-semibold leading-tight">Change password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update your password to keep your account secure.
            </p>
          </div>
        </header>

        <section className="px-6 py-6 sm:px-8">
          <div className="border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            Change password UI coming next.
          </div>
        </section>
      </main>
    </div>
  )
}

