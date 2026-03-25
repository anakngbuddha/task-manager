import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface TimeLog {
  id: string
  taskId: string
  userId: string
  durationMinutes: number
  note?: string | null
  loggedAt: string
  createdAt: string
  user?: {
    id: string
    name?: string | null
    email?: string | null
    avatar?: string | null
  }
}

export interface TimeReportTaskRow {
  taskId: string
  taskTitle: string
  totalHours: number
}

export interface TimeReportMemberRow {
  userId: string
  userName: string
  totalHours: number
  tasks: Array<{
    taskId: string
    taskTitle: string
    hours: number
  }>
}

export interface TimeReport {
  grandTotalHours: number
  byUser: Array<{ userId: string; name?: string; email?: string; totalHours: number }>
  byTask: TimeReportTaskRow[]
  members: TimeReportMemberRow[]
}

export function useTaskTimeLogs(taskId: string) {
  return useQuery({
    queryKey: ['task-time-logs', taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/${taskId}/time-logs`)
      return data as TimeLog[]
    },
    enabled: !!taskId,
  })
}

export function useCreateTaskTimeLog(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      taskId: string
      durationMinutes: number
      title: string
      description: string
      loggedAt?: string
    }) => {
      const { data } = await api.post(`/tasks/${payload.taskId}/time-logs`, {
        durationMinutes: payload.durationMinutes,
        title: payload.title,
        description: payload.description,
        loggedAt: payload.loggedAt,
      })
      return data as TimeLog
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['time-report', projectId] })
      qc.invalidateQueries({ queryKey: ['task-time-logs', variables.taskId] })
    },
  })
}

export function useDeleteTimeLog(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.delete(`/time-logs/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-report', projectId] })
    },
  })
}

export function useProjectTimeReport(projectId: string) {
  return useQuery({
    queryKey: ['time-report', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/time-report`)
      return data as TimeReport
    },
    enabled: !!projectId,
  })
}

