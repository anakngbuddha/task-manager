import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type AuditLogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE'
export type AuditLogEntityType =
  | 'TASK'
  | 'PROJECT'
  | 'SPRINT'
  | 'MEMBER'
  | 'AUTOMATION'
  | 'SETTINGS'
  | 'FILE'
  | 'SCHEDULE'

export interface AuditLogItem {
  id: string
  userId: string
  userEmail: string
  userName: string | null
  action: AuditLogAction | string
  entityType: AuditLogEntityType | string
  entityId: string
  entityName: string | null
  projectId: string | null
  changes: any | null
  ipAddress: string | null
  userAgent: string | null
  metadata: any | null
  createdAt: string
}

export interface AuditLogListResponse {
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AuditLogFilters {
  entityType?: string
  action?: string
  userId?: string
  projectId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  pageSize?: number
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['admin-audit-logs', filters],
    queryFn: async () => {
      const { data } = await api.get('/admin/audit-logs', { params: filters })
      return data as AuditLogListResponse
    },
  })
}

export function useAuditLog(id: string | null | undefined) {
  return useQuery({
    queryKey: ['admin-audit-log', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/audit-logs/${id}`)
      return data as AuditLogItem
    },
    enabled: !!id,
  })
}

export function useAuditLogExport() {
  return useMutation({
    mutationFn: async (filters: AuditLogFilters) => {
      const res = await api.get('/admin/audit-logs/export', {
        params: filters,
        responseType: 'blob',
      })
      return res.data as Blob
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'audit-logs.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  })
}

