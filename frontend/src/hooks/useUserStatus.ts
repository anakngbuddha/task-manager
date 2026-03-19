import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type UserStatus = 'ONLINE' | 'WORKING' | 'BUSY' | 'AWAY' | 'IN_MEETING' | 'OFFLINE'

export type UserStatusInfo = {
  id: string
  name?: string | null
  email?: string | null
  status: UserStatus
  lastSeenAt: string
}

export function useMyStatus() {
  return useQuery({
    queryKey: ['my-status'],
    queryFn: async () => {
      const { data } = await api.get<UserStatusInfo>('/users/me')
      return data
    },
    staleTime: 30_000,
  })
}

export function useUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (status: UserStatus) => {
      const { data } = await api.patch('/users/me/status', { status })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-status'] })
    },
  })
}

export function useUserStatuses(userIds: string[]) {
  return useQuery({
    queryKey: ['user-statuses', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return []
      const { data } = await api.get<UserStatusInfo[]>('/users/status', {
        params: { ids: userIds.join(',') },
      })
      return data
    },
    enabled: userIds.length > 0,
    refetchInterval: 30_000, // poll every 30s for real-time feel
  })
}

export const STATUS_CONFIG: Record<UserStatus, { label: string; color: string; dotClass: string }> = {
  ONLINE:     { label: 'Online',      color: '#10b981', dotClass: 'bg-emerald-500' },
  WORKING:    { label: 'Working',     color: '#3b82f6', dotClass: 'bg-blue-500'    },
  BUSY:       { label: 'Busy',        color: '#ef4444', dotClass: 'bg-red-500'     },
  AWAY:       { label: 'Away',        color: '#f59e0b', dotClass: 'bg-amber-500'   },
  IN_MEETING: { label: 'In a meeting',color: '#8b5cf6', dotClass: 'bg-violet-500'  },
  OFFLINE:    { label: 'Offline',     color: '#6b7280', dotClass: 'bg-gray-400'    },
}
