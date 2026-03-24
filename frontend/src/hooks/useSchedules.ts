import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type ScheduleType = 'MEETING' | 'TRAINING' | 'REVIEW' | 'REMINDER' | 'OTHER'

export interface ScheduleAttendee {
  id?: string
  scheduleId?: string
  userId?: string | null
  email: string
  name?: string | null
}

export interface Schedule {
  id: string
  title: string
  type: ScheduleType
  scheduledAt: string | Date
  details?: string | null
  location?: string | null
  projectId?: string | null
  creatorId: string
  createdAt?: string | Date
  updatedAt?: string | Date
  creator?: { id: string; name?: string | null; email: string }
  attendees?: ScheduleAttendee[]
}

export function useSchedules(opts?: { from?: string; to?: string; projectId?: string }) {
  const { from, to, projectId } = opts ?? {}

  return useQuery({
    queryKey: ['schedules', from ?? null, to ?? null, projectId ?? null],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      if (projectId) params.projectId = projectId

      const { data } = await api.get('/schedules', { params })
      return data as Schedule[]
    },
    enabled: true,
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      title: string
      type: ScheduleType
      scheduledAt: string
      details?: string
      location?: string
      projectId?: string
      attendees?: Array<{ email: string; name?: string; userId?: string }>
    }) => {
      const { data } = await api.post('/schedules', payload)
      return data as Schedule
    },
    onSuccess: async () => {
      // Simplest invalidation: re-fetch any schedule lists.
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}

