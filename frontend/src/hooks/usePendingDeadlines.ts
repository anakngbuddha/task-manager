import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface PendingDeadlineItem {
  kind: 'DEADLINE'
  id: string
  title: string
  deadline: string
  status: string
  project: { id: string; name: string }
}

export function usePendingDeadlines(opts?: { daysAhead?: number; limit?: number }) {
  const daysAhead = opts?.daysAhead ?? 14
  const limit = opts?.limit ?? 10

  return useQuery({
    queryKey: ['pending-deadlines', daysAhead, limit],
    queryFn: async () => {
      const now = new Date()
      const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

      const { data: projects } = await api.get('/projects')
      if (!Array.isArray(projects) || projects.length === 0) return [] as PendingDeadlineItem[]

      const results = await Promise.all(
        projects.map(async (p: any) => {
          const { data: tasks } = await api.get(`/projects/${p.id}/tasks`)
          if (!Array.isArray(tasks)) return [] as PendingDeadlineItem[]

          const filtered = tasks.filter((t: any) => {
            const deadline = t.deadline ? new Date(t.deadline) : null
            if (!deadline) return false
            if (deadline.getTime() <= now.getTime()) return false
            if (deadline.getTime() > end.getTime()) return false
            if (t.status === 'DONE' || t.status === 'READY') return false
            return true
          })

          return filtered.map((t: any) => ({
            kind: 'DEADLINE',
            id: t.id,
            title: t.title,
            deadline: t.deadline,
            status: t.status,
            project: { id: p.id, name: p.name },
          }))
        }),
      )

      const flat = results.flat()
      flat.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      return flat.slice(0, limit)
    },
    staleTime: 60 * 1000,
  })
}

