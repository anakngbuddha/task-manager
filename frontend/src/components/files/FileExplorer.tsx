import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Folder, FileText, ChevronLeft, Upload, Loader2,
  Image as ImageIcon, Plus, X, CheckCircle2, AlertTriangle
} from 'lucide-react'
import { useFiles, useCreateFolder, useUploadFile, useDeleteFile, type FileNode } from '@/hooks/useFiles'
import imageCompression from 'browser-image-compression'

export function getFileIcon(mime: string | null) {
  if (mime?.startsWith('image/')) return <ImageIcon className="size-4 text-blue-500" />
  return <FileText className="size-4 text-slate-500" />
}

interface StagedFile {
  original: File
  compressed: File | null
  isCompressing: boolean
  objectUrl: string | null      // preview URL for images
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function FileExplorer({
  onPick,
  className = "",
  projectId
}: {
  onPick?: (node: FileNode) => void
  className?: string
  projectId?: string
}) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderHistory, setFolderHistory] = useState<string[]>([])

  const { data: nodes = [], isLoading } = useFiles(currentFolderId, projectId)
  const createFolder = useCreateFolder()
  const uploadFile = useUploadFile()
  const deleteFile = useDeleteFile()

  const [newFolderName, setNewFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [staged, setStaged] = useState<StagedFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNavigateIn = (folderId: string) => {
    setFolderHistory(prev => [...prev, currentFolderId || 'root'])
    setCurrentFolderId(folderId)
  }

  const handleNavigateOut = () => {
    if (folderHistory.length > 0) {
      const prev = folderHistory[folderHistory.length - 1]
      setCurrentFolderId(prev === 'root' ? null : prev)
      setFolderHistory(h => h.slice(0, -1))
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    await createFolder.mutateAsync({ name: newFolderName, parentId: currentFolderId, projectId })
    setNewFolderName('')
    setIsCreatingFolder(false)
  }

  // Step 1: User selects file  → compress if image, stage for review
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return

    const isImage = raw.type.startsWith('image/') && !raw.type.includes('gif')
    const preview = isImage ? URL.createObjectURL(raw) : null

    setStaged({ original: raw, compressed: null, isCompressing: isImage, objectUrl: preview })

    if (isImage) {
      try {
        const comp = await imageCompression(raw, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
          onProgress: () => {}
        })
        const compFile = new File([comp], raw.name, { type: comp.type })

        // Revoke old preview and set one from compressed blob
        if (preview) URL.revokeObjectURL(preview)
        const compPreview = URL.createObjectURL(compFile)

        setStaged(prev => prev
          ? { ...prev, compressed: compFile, isCompressing: false, objectUrl: compPreview }
          : null
        )
      } catch {
        setStaged(prev => prev ? { ...prev, isCompressing: false } : null)
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Step 2: User confirms upload
  const handleConfirmUpload = async () => {
    if (!staged) return
    const fileToUpload = staged.compressed ?? staged.original
    const originalName = staged.original.name

    try {
      const uploadedNode = await uploadFile.mutateAsync({
        file: fileToUpload,
        parentId: currentFolderId,
        projectId
      })

      let msg = `✓ Uploaded "${uploadedNode.name}"`
      if (uploadedNode.name !== originalName) {
        msg += ` (renamed to avoid conflict)`
      }
      if (staged.compressed && staged.compressed.size < staged.original.size) {
        const saved = (((staged.original.size - staged.compressed.size) / staged.original.size) * 100).toFixed(1)
        msg += ` · Compressed ${formatBytes(staged.original.size)} → ${formatBytes(staged.compressed.size)} (${saved}% saved)`
      }

      setUploadSuccess(msg)
      setTimeout(() => setUploadSuccess(''), 6000)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed. Please try again.')
    } finally {
      if (staged.objectUrl) URL.revokeObjectURL(staged.objectUrl)
      setStaged(null)
    }
  }

  const handleCancelStage = () => {
    if (staged?.objectUrl) URL.revokeObjectURL(staged.objectUrl)
    setStaged(null)
  }

  const willCompress = staged?.compressed != null && staged.compressed.size < staged.original.size
  const compressionSaving = willCompress && staged
    ? (((staged.original.size - staged.compressed!.size) / staged.original.size) * 100).toFixed(1)
    : null

  return (
    <div className={`flex flex-col bg-background overflow-hidden ${className}`}>
      {/* ── Top Toolbar ── */}
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 border-b bg-muted/10 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleNavigateOut}
            disabled={folderHistory.length === 0}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground mr-1 hidden sm:inline">Path:</span>
          <span className="text-sm font-mono truncate max-w-[150px] sm:max-w-[200px]">
            {folderHistory.length > 0 ? `root/...` : 'root'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,text/plain"
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-2 flex-1 sm:flex-initial"
            disabled={uploadFile.isPending || !!staged}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Upload
          </Button>

          <Button
            size="sm"
            variant="default"
            className="gap-2 flex-1 sm:flex-initial"
            onClick={() => setIsCreatingFolder(!isCreatingFolder)}
          >
            <Plus className="size-4" />
            Folder
          </Button>
        </div>
      </div>

      {/* ── New Folder Input ── */}
      {isCreatingFolder && (
        <div className="p-3 bg-muted/50 border-b flex gap-2 items-center">
          <Input
            placeholder="Folder name"
            className="h-8 shadow-none"
            value={newFolderName}
            autoFocus
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder() }}
          />
          <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim() || createFolder.isPending}>
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsCreatingFolder(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* ── Upload Staging Panel ── */}
      {staged && (
        <div className="border-b bg-muted/5 p-4">
          <div className="flex items-start gap-4">
            {/* Image preview or file icon */}
            <div className="shrink-0 w-14 h-14 rounded-lg border bg-muted/30 overflow-hidden flex items-center justify-center">
              {staged.objectUrl ? (
                <img src={staged.objectUrl} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <FileText className="size-7 text-muted-foreground" />
              )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{staged.original.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{staged.original.type || 'Unknown type'}</p>

              <div className="mt-2 flex flex-wrap gap-2 items-center text-xs">
                {staged.isCompressing ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                    <Loader2 className="size-3 animate-spin" />
                    Compressing image…
                  </span>
                ) : willCompress ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                    <CheckCircle2 className="size-3" />
                    {formatBytes(staged.original.size)} → {formatBytes(staged.compressed!.size)}
                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                      {compressionSaving}% saved
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <AlertTriangle className="size-3" />
                    Size: {formatBytes(staged.original.size)}
                    {staged.original.type.startsWith('image/') && (
                      <span className="text-muted-foreground/60">(already optimized)</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Cancel button */}
            <button
              onClick={handleCancelStage}
              className="shrink-0 p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Confirm / Cancel */}
          <div className="flex gap-2 mt-4 justify-end">
            <Button size="sm" variant="ghost" onClick={handleCancelStage}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmUpload}
              disabled={staged.isCompressing || uploadFile.isPending}
              className="gap-1.5"
            >
              {uploadFile.isPending ? (
                <><Loader2 className="size-3.5 animate-spin" /> Uploading…</>
              ) : staged.isCompressing ? (
                <><Loader2 className="size-3.5 animate-spin" /> Compressing…</>
              ) : (
                <><Upload className="size-3.5" /> Confirm Upload</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Success Banner ── */}
      {uploadSuccess && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 p-2.5 text-center text-xs font-medium text-emerald-700">
          {uploadSuccess}
        </div>
      )}

      {/* ── File List ── */}
      <div className="flex-1 overflow-auto bg-card">
        {isLoading ? (
          <div className="p-8 flex justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full min-h-[200px] text-muted-foreground p-8">
            <Folder className="size-10 mb-2 opacity-20" />
            <p className="text-sm">This folder is empty.</p>
            <p className="text-xs mt-1">Upload a file or create a folder to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {nodes.map(node => (
              <div key={node.id} className="flex items-center justify-between p-3 hover:bg-muted/30 group">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  onClick={() => {
                    if (node.type === 'FOLDER') handleNavigateIn(node.id)
                    else if (onPick) onPick(node)
                  }}
                >
                  {node.type === 'FOLDER'
                    ? <Folder className="size-4 shrink-0 text-emerald-500" fill="currentColor" />
                    : getFileIcon(node.mimeType)
                  }
                  <span className="text-sm font-medium truncate">{node.name}</span>
                  {node.type === 'FILE' && node.size !== null && (
                    <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap hidden sm:inline">
                      ({formatBytes(node.size)})
                    </span>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {node.type === 'FILE' && !onPick && node.fileUrl && (
                    <Button variant="ghost" size="sm" className="text-xs shrink-0" asChild>
                      <a href={node.fileUrl} target="_blank" rel="noopener noreferrer">View</a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete "${node.name}"? This action cannot be undone.`)) {
                        deleteFile.mutate({ id: node.id, parentId: currentFolderId, projectId })
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
