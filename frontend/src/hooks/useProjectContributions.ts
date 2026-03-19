import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export type ProjectContributionMember = {
  userId: string
  name: string | null
  email: string | null
  countsByDay: Record<string, number> // YYYY-MM-DD -> count
}

export type ProjectContributionsResponse = {
  days: number
  members: ProjectContributionMember[]
}

export function useProjectContributions(projectId: string, days = 365) {
  return useQuery({
    queryKey: ['project-task-contributions', projectId, days],
    queryFn: async () => {
      const { data } = await api.get<ProjectContributionsResponse>(`/projects/${projectId}/task-contributions`, {
        params: { days },
      })
      return data
    },
    enabled: !!projectId,
  })
}


