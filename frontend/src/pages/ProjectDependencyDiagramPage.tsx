import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProject } from '@/hooks/useProject'
import { useTasks, useCreateTaskDependency, useDeleteTaskDependency } from '@/hooks/useTasks'
import {
  useDependencyDiagramLayout,
  useSaveDependencyDiagramLayout,
  useResetDependencyDiagramLayout,
} from '@/hooks/useDependencyDiagramLayout'
import { useSprints } from '@/hooks/useSprints'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  Filter,
  Focus,
  Keyboard,
  LayoutGrid,
  Map as MapIcon,
  Maximize2,
  Palette,
  Save,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import dagre from '@dagrejs/dagre'
import {
  ReactFlow,
  ReactFlowProvider,
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
  type ReactFlowInstance,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  Panel,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

type DiagramTask = {
  id: string
  title: string
  status: string
  priority: string
  sprintId?: string | null
  assigneeId?: string | null
  assignee?: { id: string; name?: string | null; email?: string } | null
  subtasks?: DiagramTask[]
  blockingTasks?: { id: string; blockingTaskId: string; blockedTaskId: string }[]
}

type PersistedLayout = {
  nodePositions?: Record<string, { x: number; y: number }>
  viewport?: { x: number; y: number; zoom: number }
}

function extractApiError(err: unknown): string {
  const ax = err as { response?: { data?: { error?: string } }; message?: string }
  return ax?.response?.data?.error ?? ax?.message ?? 'Request failed'
}

function computeDagreLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })

  nodes.forEach((n) => {
    const w = n.data?.isSubtask ? 220 : 260
    const h = n.data?.isSubtask ? 64 : 90
    g.setNode(n.id, { width: w, height: h })
  })
  edges.forEach((e) => {
    if (String(e.id).startsWith('nest-')) return
    g.setEdge(e.source, e.target)
  })
  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    if (!pos) return n
    const w = n.data?.isSubtask ? 110 : 130
    const h = n.data?.isSubtask ? 32 : 45
    return { ...n, position: { x: pos.x - w, y: pos.y - h } }
  })
}

function layoutWithStatusLanes(
  nodes: Node[],
  depEdges: Edge[],
  columnOrder: string[],
): Node[] {
  const laneGap = 56
  const laneHeight = 280
  let yOffset = 0
  const posById = new Map<string, { x: number; y: number }>()

  for (const status of columnOrder) {
    const laneNodes = nodes.filter((n) => !n.data?.isSubtask && n.data?.status === status)
    if (laneNodes.length === 0) continue
    const ids = new Set(laneNodes.map((n) => n.id))
    const laneEdges = depEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
    const laid = computeDagreLayout(laneNodes, laneEdges)
    for (const n of laid) {
      posById.set(n.id, { x: n.position.x, y: n.position.y + yOffset })
    }
    yOffset += laneHeight + laneGap
  }

  const unmatched = nodes.filter((n) => !n.data?.isSubtask && !posById.has(n.id))
  if (unmatched.length) {
    const ids = new Set(unmatched.map((n) => n.id))
    const laneEdges = depEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
    const laid = computeDagreLayout(unmatched, laneEdges)
    for (const n of laid) {
      posById.set(n.id, { x: n.position.x, y: n.position.y + yOffset })
    }
    yOffset += laneHeight + laneGap
  }

  return nodes.map((n) => {
    const base = posById.get(n.id)
    if (base) return { ...n, position: base }
    if (n.data?.isSubtask && n.data.parentTaskId) {
      const p = posById.get(n.data.parentTaskId as string)
      const idx = (n.data.subtaskIndex as number) ?? 0
      if (p) {
        return {
          ...n,
          position: { x: p.x + 28, y: p.y + 96 + idx * 68 },
        }
      }
    }
    return n
  })
}

function applySubtaskOffsets(nodes: Node[]): Node[] {
  const posById = new Map(nodes.map((n) => [n.id, { ...n.position }]))
  for (const n of nodes) {
    if (!n.data?.isSubtask || !n.data.parentTaskId) continue
    const p = posById.get(n.data.parentTaskId as string)
    if (!p) continue
    const idx = (n.data.subtaskIndex as number) ?? 0
    posById.set(n.id, { x: p.x + 28, y: p.y + 96 + idx * 68 })
  }
  return nodes.map((n) => ({ ...n, position: posById.get(n.id) ?? n.position }))
}

function layoutWithAssigneeLanes(nodes: Node[], depEdges: Edge[]): Node[] {
  const laneGap = 56
  const laneHeight = 280
  let yOffset = 0
  const posById = new Map<string, { x: number; y: number }>()

  const rootIds = nodes.filter((n) => !n.data?.isSubtask).map((n) => n.id)
  const keys = [
    ...new Set(
      nodes
        .filter((n) => !n.data?.isSubtask)
        .map((n) => ((n.data?.assigneeId as string | null) ?? '') || '__unassigned__'),
    ),
  ].sort()

  for (const key of keys) {
    const laneNodes = nodes.filter(
      (n) =>
        !n.data?.isSubtask &&
        (((n.data?.assigneeId as string | null) ?? '') || '__unassigned__') === key,
    )
    if (laneNodes.length === 0) continue
    const ids = new Set(laneNodes.map((n) => n.id))
    const laneEdges = depEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
    const laid = computeDagreLayout(laneNodes, laneEdges)
    for (const n of laid) {
      posById.set(n.id, { x: n.position.x, y: n.position.y + yOffset })
    }
    yOffset += laneHeight + laneGap
  }

  if (rootIds.some((id) => !posById.has(id))) {
    const missing = nodes.filter((n) => !n.data?.isSubtask && !posById.has(n.id))
    const ids = new Set(missing.map((n) => n.id))
    const laneEdges = depEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
    const laid = computeDagreLayout(missing, laneEdges)
    for (const n of laid) {
      posById.set(n.id, { x: n.position.x, y: n.position.y + yOffset })
    }
  }

  return nodes.map((n) => {
    const base = posById.get(n.id)
    if (base) return { ...n, position: base }
    if (n.data?.isSubtask && n.data.parentTaskId) {
      const p = posById.get(n.data.parentTaskId as string)
      const idx = (n.data.subtaskIndex as number) ?? 0
      if (p) {
        return {
          ...n,
          position: { x: p.x + 28, y: p.y + 96 + idx * 68 },
        }
      }
    }
    return n
  })
}

function buildRawGraph(
  tasks: DiagramTask[],
  expandedParentIds: Set<string>,
  laneMode: 'none' | 'status' | 'assignee',
  columnOrder: string[],
): { nodes: Node[]; edges: Edge[]; depEdgeIds: Set<string> } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const depEdgeIds = new Set<string>()

  const blockingCount = new Map<string, number>()
  const blockedByCount = new Map<string, number>()
  for (const t of tasks) {
    blockingCount.set(t.id, 0)
    blockedByCount.set(t.id, 0)
  }
  for (const t of tasks) {
    for (const dep of t.blockingTasks ?? []) {
      blockingCount.set(dep.blockingTaskId, (blockingCount.get(dep.blockingTaskId) ?? 0) + 1)
      blockedByCount.set(dep.blockedTaskId, (blockedByCount.get(dep.blockedTaskId) ?? 0) + 1)
    }
  }

  for (const t of tasks) {
    const subtasks = t.subtasks ?? []
    const expanded = expandedParentIds.has(t.id)
    nodes.push({
      id: t.id,
      type: 'taskNode',
      data: {
        taskId: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        sprintId: t.sprintId ?? null,
        assigneeId: t.assigneeId ?? null,
        assigneeName: t.assignee?.name || t.assignee?.email || null,
        blockingCount: blockingCount.get(t.id) ?? 0,
        blockedByCount: blockedByCount.get(t.id) ?? 0,
        subtaskCount: subtasks.length,
        expanded,
        isSubtask: false,
        isDoneLike: ['DONE', 'READY'].includes(String(t.status || '').toUpperCase()),
      },
      position: { x: 0, y: 0 },
    })

    if (expanded && subtasks.length) {
      subtasks.forEach((st, i) => {
        nodes.push({
          id: st.id,
          type: 'taskNode',
          data: {
            taskId: st.id,
            title: st.title,
            status: st.status,
            priority: st.priority,
            sprintId: st.sprintId ?? null,
            assigneeId: st.assigneeId ?? null,
            assigneeName: st.assignee?.name || st.assignee?.email || null,
            blockingCount: 0,
            blockedByCount: 0,
            subtaskCount: 0,
            expanded: false,
            isSubtask: true,
            parentTaskId: t.id,
            subtaskIndex: i,
            isDoneLike: ['DONE', 'READY'].includes(String(st.status || '').toUpperCase()),
          },
          position: { x: 0, y: 0 },
        })
        edges.push({
          id: `nest-${t.id}-${st.id}`,
          source: t.id,
          target: st.id,
          style: { strokeDasharray: '6 4', stroke: '#94a3b8', strokeWidth: 1.5 },
          selectable: false,
          focusable: false,
        })
      })
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const t of tasks) {
    for (const dep of t.blockingTasks ?? []) {
      if (!nodeIds.has(dep.blockingTaskId) || !nodeIds.has(dep.blockedTaskId)) continue
      depEdgeIds.add(dep.id)
      edges.push({
        id: dep.id,
        source: dep.blockingTaskId,
        target: dep.blockedTaskId,
        type: 'dependency',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#b45309' },
        data: { depId: dep.id },
      })
    }
  }

  const depOnly = edges.filter((e) => depEdgeIds.has(e.id))
  let laidNodes =
    laneMode === 'status' && columnOrder.length
      ? layoutWithStatusLanes(nodes, depOnly, columnOrder)
      : laneMode === 'assignee'
        ? layoutWithAssigneeLanes(nodes, depOnly)
        : computeDagreLayout(nodes, edges)

  laidNodes = applySubtaskOffsets(laidNodes)

  return { nodes: laidNodes, edges, depEdgeIds }
}

function getFocusNodeSet(
  focusId: string,
  edges: Edge[],
  depth: number,
): Set<string> {
  const depEdges = edges.filter((e) => !String(e.id).startsWith('nest-'))
  const seen = new Set<string>([focusId])

  let frontier = [focusId]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of depEdges) {
        if (e.target === id && !seen.has(e.source)) {
          seen.add(e.source)
          next.push(e.source)
        }
      }
    }
    frontier = next
  }

  frontier = [focusId]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of depEdges) {
        if (e.source === id && !seen.has(e.target)) {
          seen.add(e.target)
          next.push(e.target)
        }
      }
    }
    frontier = next
  }

  return seen
}

function DependencyEdgeFixed(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    data,
    selected,
  } = props
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const onDelete = data?.onDelete as ((edgeId: string) => void) | undefined
  const canDelete = Boolean(data?.depId && onDelete)
  const gradId = `dep-grad-${id}`
  const theme = (data?.theme as string) || 'default'

  let gradStart = '#f59e0b', gradEnd = '#f43f5e'
  let labelBg = 'bg-white/95', labelBorder = 'border-slate-200/80'
  
  if (theme === 'ocean') {
    gradStart = '#0ea5e9'; gradEnd = '#14b8a6'
    labelBg = 'bg-sky-50/95'; labelBorder = 'border-cyan-200/80'
  } else if (theme === 'sunset') {
    gradStart = '#f59e0b'; gradEnd = '#d946ef'
    labelBg = 'bg-orange-50/95'; labelBorder = 'border-orange-200/80'
  } else if (theme === 'midnight') {
    gradStart = '#3b82f6'; gradEnd = '#8b5cf6'
    labelBg = 'bg-slate-800/95'; labelBorder = 'border-slate-600/80'
  }

  const isDark = theme === 'midnight'

  return (
    <>
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor={gradStart} />
          <stop offset="100%" stopColor={gradEnd} />
        </linearGradient>
      </defs>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: `url(#${gradId})`,
          strokeWidth: selected ? 3.5 : 2.25,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="group absolute z-10 nopan nodrag pointer-events-auto -translate-x-1/2 -translate-y-1/2"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
        >
          <div className={['flex items-center gap-1 overflow-hidden fill-none rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md cursor-pointer',
            labelBg, labelBorder,
            selected ? 'ring-2 ring-indigo-500 scale-105' : ''
          ].join(' ')}>
            <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>Blocks</span>
            <span className={isDark ? 'text-slate-500' : 'text-slate-300 leading-none'}>→</span>
            <span className={isDark ? 'text-rose-400' : 'text-rose-600'}>Blocked</span>
            {canDelete && (
              <button
                type="button"
                className="ml-1 flex h-4 w-4 items-center justify-center rounded p-0 text-rose-500 transition-colors hover:bg-rose-100 hover:text-rose-700"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(id)
                }}
                title="Remove dependency"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

function getStatusColor(s: string) {
  const up = String(s || '').toUpperCase()
  if (['DONE', 'READY', 'COMPLETED'].includes(up)) return 'bg-emerald-500'
  if (['IN_PROGRESS', 'DOING', 'ACTIVE'].includes(up)) return 'bg-blue-500'
  if (['IN_REVIEW', 'REVIEW'].includes(up)) return 'bg-purple-500'
  return 'bg-slate-400'
}
function getPriorityColor(p: string) {
  const up = String(p || '').toUpperCase()
  if (up === 'URGENT') return 'bg-red-600'
  if (up === 'HIGH') return 'bg-orange-500'
  if (up === 'MEDIUM') return 'bg-amber-400'
  return 'bg-slate-400'
}

function TaskNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const toggleExpand = data.onToggleExpand as ((id: string) => void) | undefined
  const subCount = (data.subtaskCount as number) ?? 0
  const expanded = Boolean(data.expanded)
  const isSubtask = Boolean(data.isSubtask)
  const dim = Boolean(data.dimmed)
  const searchHit = Boolean(data.searchHit)
  const blockingCount = (data.blockingCount as number) ?? 0
  const blockedByCount = (data.blockedByCount as number) ?? 0
  const isDoneLike = Boolean(data.isDoneLike)
  const isBlocker = blockingCount > 0
  const isBlocked = blockedByCount > 0

  const statusColor = getStatusColor(data.status as string)
  const priorColor = getPriorityColor(data.priority as string)

  const theme = (data.theme as string) || 'default'

  let bgClass = 'bg-white/95'
  let borderClass = 'border-slate-200/80'
  let textClass = 'text-slate-800'
  let ringClass = 'ring-indigo-500'
  let expandBtn = 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
  let subCardBase = 'bg-slate-100 text-slate-400'
  let statBase = 'text-slate-600'
  let assigneeText = 'text-slate-500'
  let blockBd = 'bg-amber-100 text-amber-800 border-amber-200'
  let blockedBd = 'bg-rose-100 text-rose-800 border-rose-200'

  if (theme === 'ocean') {
    bgClass = 'bg-sky-50/95'
    borderClass = 'border-cyan-200/80'
    textClass = 'text-cyan-950'
    ringClass = 'ring-cyan-500'
    expandBtn = 'text-cyan-600 hover:bg-cyan-100'
    subCardBase = 'bg-cyan-100/50 text-cyan-600'
    statBase = 'text-cyan-800'
    assigneeText = 'text-cyan-700/80'
    blockBd = 'bg-amber-50 text-amber-800 border-amber-200/60'
    blockedBd = 'bg-rose-50 text-rose-800 border-rose-200/60'
  } else if (theme === 'sunset') {
    bgClass = 'bg-orange-50/95'
    borderClass = 'border-orange-200/80'
    textClass = 'text-orange-950'
    ringClass = 'ring-orange-500'
    expandBtn = 'text-orange-600 hover:bg-orange-100'
    subCardBase = 'bg-orange-100/50 text-orange-600'
    statBase = 'text-orange-800'
    assigneeText = 'text-orange-700/80'
    blockBd = 'bg-amber-100/50 text-amber-800 border-amber-200/60'
    blockedBd = 'bg-rose-100/50 text-rose-800 border-rose-200/60'
  } else if (theme === 'midnight') {
    bgClass = 'bg-slate-900/95'
    borderClass = 'border-slate-700'
    textClass = 'text-slate-100'
    ringClass = 'ring-indigo-400'
    expandBtn = 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    subCardBase = 'bg-slate-800 text-slate-400'
    statBase = 'text-slate-400'
    assigneeText = 'text-slate-500'
    blockBd = 'bg-amber-950/50 text-amber-400 border-amber-900/50'
    blockedBd = 'bg-rose-950/50 text-rose-400 border-rose-900/50'
  }

  return (
    <div
      className={[
        'group relative flex flex-col rounded-xl border px-3 py-2.5 shadow-sm backdrop-blur transition-all duration-300 hover:shadow-md',
        bgClass,
        borderClass,
        isSubtask ? 'min-w-[200px] max-w-[240px]' : 'min-w-[240px] max-w-[280px]',
        dim ? 'opacity-20 grayscale-[40%]' : 'opacity-100',
        isDoneLike && !dim ? 'opacity-70 saturate-75' : '',
        searchHit ? `ring-2 ${ringClass} ring-offset-2` : '',
        selected ? `ring-2 ${ringClass} shadow-md scale-[1.02] z-10` : '',
        isBlocker && !isSubtask ? (theme === 'midnight' ? 'border-l-4 border-l-amber-600' : 'border-l-4 border-l-amber-400') : '',
        isBlocked && !isSubtask ? (theme === 'midnight' ? 'border-r-4 border-r-rose-600' : 'border-r-4 border-r-rose-400') : '',
      ].filter(Boolean).join(' ')}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border !border-rose-400 !bg-white transition-transform group-hover:!scale-125"
      />
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className={`line-clamp-2 text-sm font-semibold tracking-tight ${textClass}`}>{data.title as string}</p>
        {!isSubtask && subCount > 0 && toggleExpand && (
          <button
            type="button"
            className={`shrink-0 rounded p-0.5 transition-colors ${expandBtn}`}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(data.taskId as string)
            }}
            title={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
      </div>
      {data.assigneeName && (
        <div className={`mb-2 truncate text-[10px] ${assigneeText}`}>{data.assigneeName as string}</div>
      )}
      
      {/* Node stats/badges */}
      <div className="mt-1 flex flex-wrap gap-1.5 text-[9px] font-medium tracking-wide">
        {isBlocker && (
          <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 border ${blockBd}`}>
             Blocks {blockingCount}
          </div>
        )}
        {isBlocked && (
          <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 border ${blockedBd}`}>
             Blocked by {blockedByCount}
          </div>
        )}
      </div>

      <div className={`mt-auto flex flex-wrap items-center gap-2.5 pt-2 text-[10px] font-medium ${statBase}`}>
        <div className="flex items-center gap-1">
          <div className={`size-1.5 rounded-full ${statusColor}`} />
          <span>{data.status as string}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`size-1.5 rounded-full ${priorColor}`} />
          <span>{data.priority as string}</span>
        </div>
        {!isSubtask && subCount > 0 && (
          <div className="flex items-center gap-1">
             <span className={`rounded px-1 py-0.5 ${subCardBase}`}>{subCount} sub</span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border !border-amber-400 !bg-white transition-transform group-hover:!scale-125"
      />
    </div>
  )
}

const nodeTypes = { taskNode: TaskNode }
const edgeTypes = { dependency: DependencyEdgeFixed }

type ConnectModalState = {
  source: string
  target: string
} | null

type CtxMenu = { x: number; y: number; taskId: string } | null

function DiagramCanvas({
  projectId,
  columnOrder,
  canPersistLayout,
  rawGraph,
  flash,
  triggerAutoLayout,
  triggerSaveLayout,
  triggerResetLayout,
}: {
  projectId: string
  columnOrder: string[]
  canPersistLayout: boolean
  rawGraph: { nodes: Node[]; edges: Edge[]; depEdgeIds: Set<string> }
  flash: (msg: string, kind?: 'ok' | 'err') => void
  triggerAutoLayout: number
  triggerSaveLayout: number
  triggerResetLayout: number
}) {
  const savedLayoutQuery = useDependencyDiagramLayout(projectId)
  const saveLayoutMutation = useSaveDependencyDiagramLayout()
  const resetLayoutMutation = useResetDependencyDiagramLayout()
  const createDep = useCreateTaskDependency()
  const deleteDep = useDeleteTaskDependency()

  const rfRef = useRef<ReactFlowInstance<Node, Edge> | null>(null)
  const savedRef = useRef<Record<string, { x: number; y: number }>>({})
  const viewportRestored = useRef(false)

  useEffect(() => {
    viewportRestored.current = false
  }, [projectId])

  useEffect(() => {
    const layout = savedLayoutQuery.data?.layout as PersistedLayout | undefined
    const np = layout?.nodePositions
    if (np && typeof np === 'object') savedRef.current = np
  }, [savedLayoutQuery.data])

  useEffect(() => {
    if (viewportRestored.current) return
    const v = (savedLayoutQuery.data?.layout as PersistedLayout | undefined)?.viewport
    if (
      !v ||
      typeof v.x !== 'number' ||
      typeof v.y !== 'number' ||
      typeof v.zoom !== 'number' ||
      !rfRef.current
    ) {
      return
    }
    rfRef.current.setViewport(v)
    viewportRestored.current = true
  }, [savedLayoutQuery.data])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [connectModal, setConnectModal] = useState<ConnectModalState>(null)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null)
  const [filterStatus, setFilterStatus] = useState<string>('__all__')
  const [filterAssignee, setFilterAssignee] = useState<string>('__all__')
  const [filterSprint, setFilterSprint] = useState<string>('__all__')
  const [filterPriority, setFilterPriority] = useState<string>('__all__')
  const [search, setSearch] = useState('')
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
  const [focusDepth, setFocusDepth] = useState(2)
  const [laneMode, setLaneMode] = useState<'none' | 'status' | 'assignee'>('none')
  const [showMinimap, setShowMinimap] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [theme, setTheme] = useState<'default' | 'ocean' | 'sunset' | 'midnight'>('default')
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => new Set())

  const graph = useMemo(() => {
    const tasks = (rawGraph as unknown as { __tasks?: DiagramTask[] }).__tasks
    if (!tasks) return rawGraph
    return buildRawGraph(tasks, expandedParents, laneMode, columnOrder)
  }, [rawGraph, expandedParents, laneMode, columnOrder])

  useEffect(() => {
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]))
      return graph.nodes.map((n) => ({
        ...n,
        position: prevPos.get(n.id) ?? savedRef.current[n.id] ?? n.position,
      }))
    })
    setEdges(graph.edges)
  }, [graph, setNodes, setEdges])

  const decorateNodeData = useCallback(
    (n: Node): Node => {
      const q = search.trim().toLowerCase()
      const title = String(n.data?.title ?? '').toLowerCase()
      const searchHit = q.length > 0 && title.includes(q)

      let dim = false
      if (focusTaskId) {
        const focusSet = getFocusNodeSet(focusTaskId, edges, focusDepth)
        if (!focusSet.has(n.id)) dim = true
      }

      if (filterStatus !== '__all__' && n.data?.status !== filterStatus) dim = true
      if (filterAssignee !== '__all__') {
        const aid = (n.data?.assigneeId as string | null) ?? null
        if (filterAssignee === '__unassigned__') {
          if (aid) dim = true
        } else if (aid !== filterAssignee) dim = true
      }
      if (filterSprint !== '__all__') {
        const sid = (n.data?.sprintId as string | null) ?? null
        if (filterSprint === '__none__') {
          if (sid) dim = true
        } else if (sid !== filterSprint) dim = true
      }
      if (filterPriority !== '__all__' && n.data?.priority !== filterPriority) dim = true

      return {
        ...n,
        data: {
          ...n.data,
          theme,
          dimmed: dim,
          searchHit,
          onToggleExpand: (id: string) => {
            setExpandedParents((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          },
        },
      }
    },
    [
      search,
      focusTaskId,
      edges,
      focusDepth,
      filterStatus,
      filterAssignee,
      filterSprint,
      filterPriority,
      theme,
    ],
  )

  const displayNodes = useMemo(() => nodes.map(decorateNodeData), [nodes, decorateNodeData])

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId)
      const depId = edge?.data?.depId as string | undefined
      if (!depId || !edge) return
      try {
        await deleteDep.mutateAsync({ taskId: edge.source, depId, projectId })
        setEdges((prev) => prev.filter((e) => e.id !== edgeId))
        flash('Dependency removed', 'ok')
      } catch (e) {
        flash(extractApiError(e), 'err')
      }
    },
    [deleteDep, edges, projectId, setEdges, flash],
  )

  const decoratedEdges = useMemo(
    () =>
      edges.map((e) =>
        e.type === 'dependency'
          ? {
              ...e,
              type: 'dependency' as const,
              data: { ...(e.data ?? {}), theme, onDelete: handleDeleteEdge },
            }
          : e,
      ),
    [edges, theme, handleDeleteEdge],
  )

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    setConnectModal({ source: c.source, target: c.target })
  }, [])

  const confirmConnect = useCallback(
    async (mode: 'BLOCKS' | 'IS_BLOCKED_BY') => {
      if (!connectModal) return
      const { source, target } = connectModal
      setConnectModal(null)
      try {
        const dep = await createDep.mutateAsync({
          taskId: source,
          targetTaskId: target,
          type: mode,
          projectId,
        })
        setEdges((prev) => [
          ...prev.filter((e) => e.id !== dep.id),
          {
            id: dep.id,
            source: dep.blockingTaskId,
            target: dep.blockedTaskId,
            type: 'dependency',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#b45309' },
            data: { depId: dep.id },
          },
        ])
        flash('Dependency created', 'ok')
      } catch (e) {
        flash(extractApiError(e), 'err')
      }
    },
    [connectModal, createDep, projectId, setEdges, flash],
  )

  const saveLayout = useCallback(async () => {
    if (!canPersistLayout) {
      flash('Only project managers can save the layout', 'err')
      return
    }
    const nodePositions: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) {
      nodePositions[n.id] = { x: n.position.x, y: n.position.y }
    }
    try {
      await saveLayoutMutation.mutateAsync({
        projectId,
        layout: { nodePositions, viewport: rfRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 } },
      })
      savedRef.current = nodePositions
      flash('Layout saved', 'ok')
    } catch (e) {
      flash(extractApiError(e), 'err')
    }
  }, [canPersistLayout, nodes, projectId, saveLayoutMutation, flash])

  const resetLayout = useCallback(async () => {
    if (!canPersistLayout) {
      flash('Only project managers can reset the layout', 'err')
      return
    }
    try {
      await resetLayoutMutation.mutateAsync({ projectId })
      savedRef.current = {}
      viewportRestored.current = true
      setNodes((prev) => computeDagreLayout(prev, edges))
      rfRef.current?.setViewport({ x: 0, y: 0, zoom: 1 })
      setTimeout(() => rfRef.current?.fitView({ padding: 0.2 }), 0)
      flash('Layout reset', 'ok')
    } catch (e) {
      flash(extractApiError(e), 'err')
    }
  }, [canPersistLayout, resetLayoutMutation, projectId, setNodes, edges, flash])

  const autoLayout = useCallback(() => {
    setNodes((prev) => {
      const depOnly = edges.filter((e) => e.type === 'dependency')
      if (laneMode === 'status' && columnOrder.length) {
        return layoutWithStatusLanes(prev, depOnly, columnOrder)
      }
      if (laneMode === 'assignee') {
        return layoutWithAssigneeLanes(prev, depOnly)
      }
      return computeDagreLayout(prev, edges)
    })
    setTimeout(() => rfRef.current?.fitView({ padding: 0.2 }), 0)
  }, [setNodes, edges, laneMode, columnOrder])

  useEffect(() => {
    if (triggerAutoLayout > 0) autoLayout()
  }, [triggerAutoLayout, autoLayout])

  useEffect(() => {
    if (triggerSaveLayout > 0) void saveLayout()
  }, [triggerSaveLayout, saveLayout])

  useEffect(() => {
    if (triggerResetLayout > 0) void resetLayout()
  }, [triggerResetLayout, resetLayout])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        rfRef.current?.fitView({ padding: 0.2 })
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = edges.filter((ed) => ed.selected && ed.data?.depId)
        if (!selected.length) return
        e.preventDefault()
        for (const ed of selected) void handleDeleteEdge(ed.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [edges, handleDeleteEdge])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setFocusTaskId(node.id)
    },
    [],
  )

  const onPaneClick = useCallback(() => {
    setCtxMenu(null)
    setFocusTaskId(null)
  }, [])

  const onNodeContextMenu: NodeMouseHandler = useCallback((e, node) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, taskId: node.id })
  }, [])

  const navigate = useNavigate()
  const sourceTitle = String(
    nodes.find((n) => n.id === connectModal?.source)?.data?.title ?? 'Task A',
  )
  const targetTitle = String(
    nodes.find((n) => n.id === connectModal?.target)?.data?.title ?? 'Task B',
  )

  return (
    <>
      <ReactFlow
        nodes={displayNodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(inst) => {
          rfRef.current = inst
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ 
          width: '100%', 
          height: '100%',
          background: theme === 'midnight' ? '#020617' : theme === 'ocean' ? '#f0f9ff' : theme === 'sunset' ? '#fff7ed' : '#f8fafc' 
        }}
        deleteKeyCode={null}
        connectionLineStyle={{ stroke: theme === 'sunset' ? '#d946ef' : theme === 'ocean' ? '#0ea5e9' : '#6366f1', strokeWidth: 2 }}
      >
      <Panel position="top-left" className="pointer-events-auto m-4">
        {!showFilters ? (
          <Button
            variant="outline"
            className="flex h-9 items-center gap-2 rounded-full border border-slate-200/60 bg-white/70 px-4 text-xs font-medium shadow-sm backdrop-blur-md transition-colors hover:bg-white"
            onClick={() => setShowFilters(true)}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters & View
          </Button>
        ) : (
          <div className="w-[300px] space-y-3 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Filters & View</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setShowFilters(false)}>
                <X className="size-3.5" />
              </Button>
            </div>
            
            <div className="grid gap-2 text-xs">
              <Input
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs focus-visible:ring-indigo-500/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 text-xs focus:ring-indigo-500/50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All statuses</SelectItem>
                    {columnOrder.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="h-8 text-xs focus:ring-indigo-500/50">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All priorities</SelectItem>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <AssigneeFilter projectId={projectId} value={filterAssignee} onChange={setFilterAssignee} />
                <SprintFilter projectId={projectId} value={filterSprint} onChange={setFilterSprint} />
              </div>
            </div>

            <div className="mt-2 text-[10px] text-slate-500">
              <div className="mb-1 flex items-center justify-between">
                <span>Focus Depth</span>
                <span className="font-medium text-slate-700">{focusDepth}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={focusDepth}
                onChange={(e) => setFocusDepth(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-500 outline-none"
              />
              <Button
                size="sm"
                variant={focusTaskId ? 'secondary' : 'outline'}
                className="mt-2 w-full h-8 text-[11px]"
                onClick={() => setFocusTaskId((x) => (x ? null : nodes[0]?.id ?? null))}
                disabled={!nodes.length}
              >
                <Focus className="mr-1.5 size-3.5" />
                {focusTaskId ? 'Clear focus' : 'Focus first node'}
              </Button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Appearance</div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={laneMode} onValueChange={(v) => setLaneMode(v as 'none' | 'status' | 'assignee')}>
                  <SelectTrigger className="h-8 text-xs focus:ring-indigo-500/50">
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Free (dagre)</SelectItem>
                    <SelectItem value="status">Stack by status</SelectItem>
                    <SelectItem value="assignee">Stack by assignee</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
                  <SelectTrigger className="h-8 text-xs focus:ring-indigo-500/50">
                    <div className="flex items-center gap-1.5">
                      <Palette className="size-3" />
                      <SelectValue placeholder="Theme" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="ocean">Ocean</SelectItem>
                    <SelectItem value="sunset">Sunset</SelectItem>
                    <SelectItem value="midnight">Midnight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        position="top-right"
        className="m-4 flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/70 px-2 py-1.5 shadow-sm backdrop-blur-md"
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full"
          title="Jump search"
          onClick={() => {
            const hit = displayNodes.find((n) => n.data?.searchHit)
            if (hit) rfRef.current?.fitView({ nodes: [{ id: hit.id }], duration: 400, padding: 0.35 })
            else flash('No search match to jump to', 'err')
          }}
        >
          <Crosshair className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full"
          title="Center selection"
          onClick={() => {
            const sel = displayNodes.filter((n) => n.selected)
            if (sel.length) rfRef.current?.fitView({ nodes: sel.map((n) => ({ id: n.id })), padding: 0.35 })
            else flash('Select a task on the canvas first', 'err')
          }}
        >
          <Maximize2 className="size-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-slate-300/80" />
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600"
            title="Del: remove selected edge · F: fit view"
          >
            <Keyboard className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={showMinimap ? 'secondary' : 'ghost'}
            className="h-8 w-8 rounded-full"
            title="Toggle Minimap"
            onClick={() => setShowMinimap((v) => !v)}
          >
            <MapIcon className="size-4" />
          </Button>
        </div>
      </Panel>
        <Background color={theme === 'midnight' ? '#334155' : theme === 'ocean' ? '#bae6fd' : theme === 'sunset' ? '#fed7aa' : '#cbd5e1'} gap={18} />
        <Controls className={theme === 'midnight' ? '!border-slate-700 !bg-slate-900 !fill-slate-100 [&>button]:!border-slate-700' : '!border-slate-200 !bg-white/90'} />
        {showMinimap && (
          <MiniMap className="!border-slate-200 !bg-white/95" maskColor="rgba(148,163,184,0.35)" />
        )}
      </ReactFlow>

      <Dialog open={!!connectModal} onOpenChange={(o) => !o && setConnectModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New dependency</DialogTitle>
            <DialogDescription>
              Choose how these tasks relate. The arrow always points from <strong>blocker</strong> →{' '}
              <strong>blocked</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="font-medium text-amber-800">{sourceTitle}</span>
              <span className="text-slate-400"> ↔ </span>
              <span className="font-medium text-rose-800">{targetTitle}</span>
            </p>
            <Button
              variant="outline"
              className="h-auto w-full flex-col items-start gap-1 py-3 text-left"
              onClick={() => void confirmConnect('BLOCKS')}
            >
              <span className="font-semibold text-amber-900">
                «{sourceTitle}» blocks «{targetTitle}»
              </span>
              <span className="text-xs font-normal text-slate-500">
                {targetTitle} cannot finish until {sourceTitle} is done.
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto w-full flex-col items-start gap-1 py-3 text-left"
              onClick={() => void confirmConnect('IS_BLOCKED_BY')}
            >
              <span className="font-semibold text-rose-900">
                «{sourceTitle}» is blocked by «{targetTitle}»
              </span>
              <span className="text-xs font-normal text-slate-500">
                Same edge: {targetTitle} → blocks → {sourceTitle}.
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConnectModal(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ctxMenu && (
        <div
          className="fixed z-[100] min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => {
              navigate(`/projects/${projectId}?taskId=${ctxMenu.taskId}`)
              setCtxMenu(null)
            }}
          >
            Open task
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => {
              navigate(`/projects/${projectId}?taskId=${ctxMenu.taskId}`)
              setCtxMenu(null)
              flash('Use the Dependencies section in the task panel to add links.', 'ok')
            }}
          >
            Add blocker / blocked…
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => {
              const url = `${window.location.origin}/projects/${projectId}?taskId=${ctxMenu.taskId}`
              void navigator.clipboard.writeText(url)
              setCtxMenu(null)
              flash('Task link copied', 'ok')
            }}
          >
            <Copy className="size-3.5 opacity-60" />
            Copy link
          </button>
        </div>
      )}
    </>
  )
}

function AssigneeFilter({
  projectId,
  value,
  onChange,
}: {
  projectId: string
  value: string
  onChange: (v: string) => void
}) {
  const { data: members = [] } = useProjectMembers(projectId)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Assignee" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All assignees</SelectItem>
        <SelectItem value="__unassigned__">Unassigned</SelectItem>
        {members.map((m: { userId: string; user?: { name?: string; email?: string } }) => (
          <SelectItem key={m.userId} value={m.userId}>
            {m.user?.name || m.user?.email || m.userId}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SprintFilter({
  projectId,
  value,
  onChange,
}: {
  projectId: string
  value: string
  onChange: (v: string) => void
}) {
  const { data: sprints = [] } = useSprints(projectId)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Sprint" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All sprints</SelectItem>
        <SelectItem value="__none__">No sprint</SelectItem>
        {sprints.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function ProjectDependencyDiagramPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { data: project } = useProject(projectId!)
  const { data: tasks = [] } = useTasks(projectId!)
  const { data: session } = useSession()

  const [triggerAutoLayout, setTriggerAutoLayout] = useState(0)
  const [triggerSaveLayout, setTriggerSaveLayout] = useState(0)
  const [triggerResetLayout, setTriggerResetLayout] = useState(0)

  const [flash, setFlashState] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const flashFn = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setFlashState({ msg, kind })
    window.setTimeout(() => setFlashState(null), 4200)
  }, [])

  const myId = session?.user?.id
  const myRole =
    (project?.members ?? []).find((m: { userId: string }) => m.userId === myId)?.role ??
    null
  const canPersistLayout = myRole === 'MASTER_ADMIN' || myRole === 'PROJECT_MANAGER'

  const columnOrder = useMemo(() => {
    const cols = project?.boardColumns
    if (Array.isArray(cols) && cols.length) return cols.map(String)
    return ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY']
  }, [project?.boardColumns])

  const rawGraph = useMemo(() => {
    const g = buildRawGraph(
      tasks as DiagramTask[],
      new Set(),
      'none',
      columnOrder,
    )
    ;(g as unknown as { __tasks: DiagramTask[] }).__tasks = tasks as DiagramTask[]
    return g
  }, [tasks, columnOrder])

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <PageHeader
          breadcrumb={
            <span className="text-slate-500">
              Projects / {project?.name ?? 'Project'} / Dependency Diagram
            </span>
          }
          title="Dependency Diagram"
          subtitle="Blocker (amber, left handle) → blocked (rose, right)."
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setTriggerAutoLayout(x => x+1)} className="h-8 text-xs font-medium">
                <LayoutGrid className="mr-1.5 size-3.5" /> Auto layout
              </Button>
              {canPersistLayout && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setTriggerSaveLayout(x => x+1)} className="h-8 text-xs font-medium">
                    <Save className="mr-1.5 size-3.5" /> Save layout
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTriggerResetLayout(x => x+1)} className="h-8 text-xs font-medium">
                    <Undo2 className="mr-1.5 size-3.5" /> Reset
                  </Button>
                </>
              )}
              <div className="mx-1 h-4 w-px bg-slate-300" />
              <Button size="sm" variant="default" className="h-8 text-xs font-medium" asChild>
                <Link to={`/projects/${projectId}`}>
                  <ArrowLeft className="mr-1.5 size-3.5" /> Back to Board
                </Link>
              </Button>
            </div>
          }
        />
        {flash && (
          <div
            className={[
              'border-b px-4 py-2 text-center text-sm',
              flash.kind === 'err' ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900',
            ].join(' ')}
          >
            {flash.msg}
          </div>
        )}
        <div className="relative flex-1">
          <ReactFlowProvider>
            <DiagramCanvas
              projectId={projectId!}
              columnOrder={columnOrder}
              canPersistLayout={canPersistLayout}
              rawGraph={rawGraph}
              flash={flashFn}
              triggerAutoLayout={triggerAutoLayout}
              triggerSaveLayout={triggerSaveLayout}
              triggerResetLayout={triggerResetLayout}
            />
          </ReactFlowProvider>
        </div>
      </main>
    </div>
  )
}
