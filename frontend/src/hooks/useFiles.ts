import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type FileType = 'FILE' | 'FOLDER'

export interface FileNode {
  id: string
  userId: string
  parentId: string | null
  name: string
  type: FileType
  mimeType: string | null
  size: number | null
  fileUrl: string | null
  createdAt: string
  updatedAt: string
}

export function useFiles(parentId?: string | null, projectId?: string | null) {
  return useQuery<FileNode[]>({
    queryKey: ['files', parentId, projectId],
    queryFn: async () => {
      const res = await api.get('/files', { params: { parentId, projectId } })
      return res.data
    }
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; parentId?: string | null; projectId?: string | null }) => {
      const res = await api.post('/files/folder', payload)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['files', variables.parentId, variables.projectId] })
    }
  })
}

export function useUploadFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; parentId?: string | null; projectId?: string | null }) => {
      const formData = new FormData()
      formData.append('file', payload.file, payload.file.name)
      if (payload.parentId) {
        formData.append('parentId', payload.parentId)
      }
      if (payload.projectId) {
        formData.append('projectId', payload.projectId)
      }
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['files', variables.parentId, variables.projectId] })
    }
  })
}

export function useDeleteFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (param: { id: string, parentId?: string | null, projectId?: string | null }) => {
      await api.delete(`/files/${param.id}`)
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['files', variables.parentId, variables.projectId] })
    }
  })
}

// Attachments
export interface TaskAttachment {
  id: string
  taskId: string
  fileNodeId: string
  createdAt: string
  fileNode: FileNode & {
    user: { id: string; name: string | null; email: string; image: string | null; avatar: string | null }
  }
}

export function useTaskAttachments(taskId?: string) {
  return useQuery<TaskAttachment[]>({
    queryKey: ['task-attachments', taskId],
    queryFn: async () => {
      if (!taskId) return []
      const res = await api.get(`/files/tasks/${taskId}/attachments`)
      return res.data
    },
    enabled: !!taskId
  })
}

export function useLinkTaskAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { taskId: string; fileNodeId: string }) => {
      const res = await api.post('/files/tasks/attachments', payload)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['task-attachments', variables.taskId] })
    }
  })
}

export function useUnlinkTaskAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { attachmentId: string; taskId: string }) => {
      const res = await api.delete(`/files/tasks/attachments/${payload.attachmentId}`)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['task-attachments', variables.taskId] })
    }
  })
}
