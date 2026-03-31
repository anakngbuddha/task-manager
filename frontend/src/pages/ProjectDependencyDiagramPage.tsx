import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useTasks, useCreateTaskDependency, useDeleteTaskDependency } from '@/hooks/useTasks'
import TaskDialog from '@/components/board/TaskDialog'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, LayoutGrid, RefreshCw, Save, Search } from 'lucide-react'
import dagre from '@dagrejs/dagre'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDependencyDiagramLayout, useResetDependencyDiagramLayout, useSaveDependencyDiagramLayout } from '@/hooks/useDependencyDiagramLayout'

function layoutNodes(inputNodes: Node[], inputEdges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 90, nodesep: 40 })
  inputNodes.forEach((n) => g.setNode(n.id, { width: 280, height: 100 }))
  inputEdges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return inputNodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - 140, y: p.y - 50 } }
  })
}

function TaskNode({ data }: any) {
  const isDone = data.status === 'DONE' || data.status === 'READY'
  return (
    <div className={`rounded-xl border px-3 py-2 shadow-sm min-w-[280px] ${isDone ? 'bg-zinc-100 border-zinc-300 dark:bg-zinc-900/40 dark:border-zinc-700' : 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800'}`}>
      <Handle type="target" position={Position.Left} />
      <p className="text-sm font-semibold truncate">{data.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/70">{data.status}</Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/70">{data.priority}</Badge>
        {(data.blockingCount ?? 0) > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100/80 border-amber-300">Blocking {data.blockingCount}</Badge>
        )}
        {(data.blockedByCount ?? 0) > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-100/80 border-rose-300">Blocked by {data.blockedByCount}</Badge>
        )}
      </div>
      {data.assignee && <p className="mt-1 text-[11px] text-muted-foreground truncate">@{data.assignee}</p>}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { taskNode: TaskNode }

export default function ProjectDependencyDiagramPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: tasks = [] } = useTasks(projectId!)
  const { data: members = [] } = useProjectMembers(projectId!)
  const createDep = useCreateTaskDependency()
  const deleteDep = useDeleteTaskDependency()
  const { data: savedLayout } = useDependencyDiagramLayout(projectId!)
  const saveLayout = useSaveDependencyDiagramLayout()
  const resetLayout = useResetDependencyDiagramLayout()

  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [pendingConn, setPendingConn] = useState<Connection | null>(null)
  const [directionOpen, setDirectionOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const rfRef = useRef<ReactFlowInstance | null>(null)

  const filteredTasks = useMemo(() => {
    return (tasks as any[]).filter((t) => {
      const statusOk = statusFilter === 'ALL' || t.status === statusFilter
      const searchOk = !search.trim() || String(t.title).toLowerCase().includes(search.trim().toLowerCase())
      return statusOk && searchOk
    })
  }, [tasks, search, statusFilter])

  const base = useMemo(() => {
    const visibleIds = new Set(filteredTasks.map((t) => t.id))
    const blockCount = new Map<string, number>()
    const blockedByCount = new Map<string, number>()
    filteredTasks.forEach((t) => {
      blockCount.set(t.id, 0)
      blockedByCount.set(t.id, 0)
    })

    const nodes: Node[] = filteredTasks.map((task) => ({
      id: task.id,
      type: 'taskNode',
      data: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee?.name ?? task.assignee?.email ?? null,
        blockingCount: 0,
        blockedByCount: 0,
      },
      position: { x: 0, y: 0 },
    }))

    const edges: Edge[] = []
    for (const task of filteredTasks) {
      for (const dep of task.blockingTasks ?? []) {
        if (!visibleIds.has(dep.blockingTaskId) || !visibleIds.has(dep.blockedTaskId)) continue
        blockCount.set(dep.blockingTaskId, (blockCount.get(dep.blockingTaskId) ?? 0) + 1)
        blockedByCount.set(dep.blockedTaskId, (blockedByCount.get(dep.blockedTaskId) ?? 0) + 1)
        edges.push({
          id: dep.id,
          source: dep.blockingTaskId,
          target: dep.blockedTaskId,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#0ea5e9', strokeWidth: 1.8 },
          data: { depId: dep.id },
        })
      }
    }

    for (const n of nodes) {
      n.data = {
        ...n.data,
        blockingCount: blockCount.get(n.id) ?? 0,
        blockedByCount: blockedByCount.get(n.id) ?? 0,
      }
    }

    return { nodes: layoutNodes(nodes, edges), edges }
  }, [filteredTasks])

  const [nodes, setNodes, onNodesChange] = useNodesState(base.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(base.edges)

  useEffect(() => {
    setNodes(base.nodes)
    setEdges(base.edges)
  }, [base.nodes, base.edges, setNodes, setEdges])

  useEffect(() => {
    if (!savedLayout?.layout) return
    const layout = savedLayout.layout as any
    if (Array.isArray(layout?.nodes)) {
      setNodes((prev) => {
        const map = new Map(layout.nodes.map((n: any) => [n.id, n]))
        return prev.map((n) => {
          const saved = map.get(n.id) as { position?: { x: number; y: number } } | undefined
          return saved?.position ? { ...n, position: saved.position } : n
        })
      })
    }
    if (layout?.viewport && rfRef.current) rfRef.current.setViewport(layout.viewport)
  }, [savedLayout?.layout, setNodes])

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    setPendingConn(connection)
    setDirectionOpen(true)
  }

  const createDependency = async (mode: 'BLOCKS' | 'IS_BLOCKED_BY') => {
    if (!pendingConn?.source || !pendingConn.target || !projectId) return
    const source = mode === 'BLOCKS' ? pendingConn.source : pendingConn.target
    const target = mode === 'BLOCKS' ? pendingConn.target : pendingConn.source
    try {
      const dep = await createDep.mutateAsync({
        taskId: source,
        targetTaskId: target,
        type: mode,
        projectId,
      })
      setEdges((prev) => [
        ...prev,
        {
          id: dep?.id ?? `${source}-${target}-${Date.now()}`,
          source,
          target,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#0ea5e9', strokeWidth: 1.8 },
          data: { depId: dep?.id },
        },
      ])
    } finally {
      setDirectionOpen(false)
      setPendingConn(null)
    }
  }

  const onEdgeDoubleClick = async (_: any, edge: Edge) => {
    if (!projectId) return
    const depId = edge.data?.depId as string | undefined
    if (!depId) return
    await deleteDep.mutateAsync({ taskId: edge.source, depId, projectId })
    setEdges((prev) => prev.filter((e) => e.id !== edge.id))
  }

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    ;(tasks as any[]).forEach((t) => set.add(String(t.status)))
    return Array.from(set)
  }, [tasks])

  const buildLayoutPayload = () => ({
    nodes: nodes.map((n) => ({ id: n.id, position: n.position })),
    viewport: rfRef.current?.getViewport?.(),
  })

  return (
    <div className="flex h-screen bg-background">
      <aside className="relative z-[100] shrink-0 pointer-events-auto">
        <Sidebar />
      </aside>
      <main className="relative z-0 flex-1 min-w-0 overflow-hidden bg-gradient-to-b from-cyan-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <PageHeader
          breadcrumb={<span className="text-muted-foreground">Projects / {project?.name ?? 'Project'} / Dependency Diagram</span>}
          title="Dependency Diagram"
          subtitle="Cleaner visual flow of blockers and blocked tasks"
          actions={
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search task..." className="h-9 pl-8 w-[200px]" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {statusOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="h-9 gap-2" onClick={() => setNodes((prev) => layoutNodes(prev, edges))}>
                <LayoutGrid className="size-4" />
                Auto Layout
              </Button>
              <Button variant="outline" className="h-9 gap-2" onClick={async () => projectId && saveLayout.mutateAsync({ projectId, layout: buildLayoutPayload() })}>
                <Save className="size-4" />
                Save
              </Button>
              <Button
                variant="outline"
                className="h-9 gap-2"
                onClick={async () => {
                  if (!projectId) return
                  await resetLayout.mutateAsync({ projectId })
                  setNodes((prev) => layoutNodes(prev, edges))
                  rfRef.current?.fitView?.()
                }}
              >
                <RefreshCw className="size-4" />
                Reset
              </Button>
              <Button variant="outline" className="h-9 gap-2" asChild>
                <Link to={`/projects/${projectId}`}>
                  <ArrowLeft className="size-4" />
                  Back to Board
                </Link>
              </Button>
            </div>
          }
        />

        <div className="relative h-[calc(100vh-5rem)] overflow-hidden p-3">
          <div className="h-full rounded-xl border bg-white/60 dark:bg-slate-950/50 backdrop-blur-sm">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={(instance) => { rfRef.current = instance }}
              onNodeClick={(_, node) => {
                const task = (tasks as any[]).find((t) => t.id === node.id)
                if (task) setSelectedTask(task)
              }}
              onEdgeDoubleClick={onEdgeDoubleClick}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </div>
      </main>

      <Dialog open={directionOpen} onOpenChange={(open) => { setDirectionOpen(open); if (!open) setPendingConn(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dependency direction</DialogTitle>
            <DialogDescription>Select how these two tasks are related.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button className="w-full justify-start" onClick={() => createDependency('BLOCKS')}>Source blocks target</Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => createDependency('IS_BLOCKED_BY')}>Source is blocked by target</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDirectionOpen(false); setPendingConn(null) }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDialog
        task={selectedTask}
        projectId={projectId!}
        projectMembers={members as any[]}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  )
}

