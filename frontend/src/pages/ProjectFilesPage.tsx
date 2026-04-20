import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import Sidebar from '@/components/layout/Sidebar'
import { useProject } from '@/hooks/useProject'
import { FileExplorer } from '@/components/files/FileExplorer'

export default function ProjectFilesPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background flex flex-col">
        <PageHeader 
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Files</span>}
          title="Project Workspace"
          subtitle="Shared files and assets for this project. Anyone on the team can view and upload here."
        />
        
        <div className="px-4 py-6 sm:px-8 flex-1">
          <div className="border border-border/60 rounded-xl overflow-hidden h-[calc(100vh-12rem)] bg-card shadow-sm">
             <FileExplorer projectId={projectId} className="h-full" />
          </div>
        </div>
      </main>
    </div>
  )
}
