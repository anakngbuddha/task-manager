import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, LogOut, Search } from 'lucide-react'
import { signOut } from '../../lib/auth-client'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { ADMIN_DOC_SECTIONS, type DocEntry } from '../../lib/adminDocumentation'
import { cn } from '../../lib/utils'

function matchesQuery(entry: DocEntry, query: string): boolean {
  const q = query.toLowerCase()
  return (
    entry.name.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    (entry.usage?.toLowerCase().includes(q) ?? false) ||
    entry.access.toLowerCase().includes(q)
  )
}

export default function AdminDocumentationPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState(ADMIN_DOC_SECTIONS[0]?.id ?? '')

  const filteredSections = useMemo(() => {
    const q = query.trim()
    if (!q) return ADMIN_DOC_SECTIONS

    return ADMIN_DOC_SECTIONS.map((section) => ({
      ...section,
      entries: section.entries.filter((e) => matchesQuery(e, q)),
    })).filter((section) => section.entries.length > 0)
  }, [query])

  const visibleSection =
    filteredSections.find((s) => s.id === activeSection) ?? filteredSections[0]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 border-r border-border overflow-y-auto p-4 hidden md:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Sections
          </p>
          <nav className="space-y-1">
            {ADMIN_DOC_SECTIONS.map((section) => {
              const count = query.trim()
                ? filteredSections.find((s) => s.id === section.id)?.entries.length ?? 0
                : section.entries.length
              if (query.trim() && count === 0) return null
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                    visibleSection?.id === section.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {section.title}
                  <span className="ml-1 text-xs opacity-60">({count})</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-6 h-6 text-primary" />
                <h2 className="text-3xl font-bold tracking-tight">Admin Documentation</h2>
              </div>
              <p className="text-muted-foreground text-sm max-w-2xl">
                Reference for admin console pages, API endpoints, terminal (VFS) commands, and
                WeBot chat slash commands — including role permissions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="destructive" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>

          <div className="relative mb-6 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands, routes, roles…"
              className="pl-9"
            />
          </div>

          <div className="md:hidden mb-4">
            <label className="text-xs text-muted-foreground mb-1 block">Section</label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={visibleSection?.id ?? ''}
              onChange={(e) => setActiveSection(e.target.value)}
            >
              {filteredSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {filteredSections.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No results for &ldquo;{query}&rdquo;.
              </CardContent>
            </Card>
          ) : (
            filteredSections
              .filter((s) => !query.trim() || s.id === visibleSection?.id)
              .map((section) => (
                <Card key={section.id} id={section.id} className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted/60 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Usage</th>
                          <th className="px-3 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 font-medium">Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.entries.map((entry) => (
                          <tr
                            key={`${section.id}-${entry.name}-${entry.usage ?? ''}`}
                            className="border-b border-border/50 align-top"
                          >
                            <td className="px-3 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                              {entry.name}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-primary/90 max-w-[220px]">
                              {entry.usage ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">{entry.description}</td>
                            <td className="px-3 py-3 text-xs whitespace-nowrap">
                              <span className="inline-flex rounded-full bg-muted px-2 py-0.5">
                                {entry.access}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))
          )}

          {!query.trim() && (
            <p className="text-xs text-muted-foreground pb-8">
              Tip: In the project terminal, type <code className="text-primary">help</code> or{' '}
              <code className="text-primary">help &lt;command&gt;</code> for live syntax. In WeBot,
              type <code className="text-primary">/knowledge-help</code> for chat commands.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
