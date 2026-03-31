import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DependencyDiagramLayout {
  layout: any
  updatedAt: string
}

export function useDependencyDiagramLayout(projectId?: string) {
  return useQuery({
    queryKey: ['dependency-diagram-layout', projectId ?? ''],
    queryFn: async () => {
      if (!projectId) throw new Error('Missing projectId')
      const res = await api.get(`/projects/${projectId}/dependency-diagram-layout`, {
        validateStatus: (s) => s === 200 || s === 204,
      })
      if (res.status === 204) return null
      return res.data as DependencyDiagramLayout
    },
    enabled: !!projectId,
    retry: false,
  })
}

export function useSaveDependencyDiagramLayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, layout }: { projectId: string; layout: any }) => {
      const { data } = await api.put(`/projects/${projectId}/dependency-diagram-layout`, { layout })
      return data as DependencyDiagramLayout
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(['dependency-diagram-layout', vars.projectId], data)
    },
  })
}

export function useResetDependencyDiagramLayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      await api.delete(`/projects/${projectId}/dependency-diagram-layout`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['dependency-diagram-layout', vars.projectId] })
      qc.removeQueries({ queryKey: ['dependency-diagram-layout', vars.projectId] })
    },
  })
}

