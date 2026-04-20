import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileExplorer } from '@/components/files/FileExplorer'
import { type FileNode } from '@/hooks/useFiles'

export function FileExplorerDialog({
  open,
  onClose,
  onPick,
  projectId
}: {
  open: boolean
  onClose: () => void
  onPick: (node: FileNode) => void
  projectId?: string
}) {
  const [tab, setTab] = useState<'PERSONAL' | 'PROJECT'>('PERSONAL')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl rounded-none p-0 overflow-hidden flex flex-col max-h-[85vh]">
        <DialogHeader className="p-4 border-b shrink-0 bg-muted/20 flex flex-row items-center justify-between">
          <DialogTitle>Attach File</DialogTitle>
          {projectId && (
            <div className="flex bg-muted/50 p-1 rounded-lg w-fit border border-border/50">
              <button 
                onClick={() => setTab('PERSONAL')} 
                className={tab === 'PERSONAL' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-xs font-medium' : 'px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground'}
              >
                My Files
              </button>
              <button 
                onClick={() => setTab('PROJECT')} 
                className={tab === 'PROJECT' ? 'bg-background shadow-sm rounded-md px-4 py-1.5 text-xs font-medium' : 'px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground'}
              >
                Project Workspace
              </button>
            </div>
          )}
        </DialogHeader>
        
        {tab === 'PERSONAL' ? (
          <FileExplorer 
            onPick={onPick} 
            className="flex-1 min-h-[400px] sm:min-h-[500px]"
          />
        ) : (
          <FileExplorer 
            onPick={onPick} 
            projectId={projectId}
            className="flex-1 min-h-[400px] sm:min-h-[500px]"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
