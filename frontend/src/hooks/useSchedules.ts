import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type ScheduleType = 'MEETING' | 'TRAINING' | 'REVIEW' | 'REMINDER' | 'OTHER'

export interface ScheduleAttendee {
  id?: string
  scheduleId?: string
  userId?: string | null
  email: string
  name?: string | null
  response?: 'PENDING' | 'ACCEPTED' | 'DECLINED'
}

export interface Schedule {
  id: string
  title: string
  type: ScheduleType
  scheduledAt: string | Date
  endAt?: string | Date | null
  details?: string | null
  location?: string | null
  isVirtual?: boolean
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
    enabled: Boolean(from || to),
  })
}

export function useScheduleById(scheduleId: string | undefined) {
  return useQuery({
    queryKey: ['schedule', scheduleId],
    enabled: !!scheduleId,
    queryFn: async () => {
      const { data } = await api.get(`/schedules/${scheduleId}`)
      return data as Schedule
    },
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      title: string
      type: ScheduleType
      scheduledAt: string
      endAt?: string | null
      details?: string
      location?: string
      isVirtual?: boolean
      projectId?: string
      attendees?: Array<{ email: string; name?: string; userId?: string }>
    }) => {
      const { data } = await api.post('/schedules', payload)
      return data as Schedule
    },
    onSuccess: async () => {
      // Simplest invalidation: re-fetch any schedule lists.
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useRespondScheduleInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { scheduleId: string; response: 'ACCEPTED' | 'DECLINED' | 'PENDING' }) => {
      const { data } = await api.patch(`/schedules/${payload.scheduleId}/respond`, { response: payload.response })
      return data as { scheduleId: string; response: 'PENDING' | 'ACCEPTED' | 'DECLINED' }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

