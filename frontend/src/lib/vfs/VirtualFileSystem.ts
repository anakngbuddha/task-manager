/**
 * VirtualFileSystem — the core kernel.
 *
 * Manages current working directory, path resolution,
 * and delegates data fetching to dataAdapters.
 *
 * Instances are created fresh per terminal session and receive
 * the projectId at construction time.
 */
import { api } from '@/lib/api'
import type { VFSNode, VFSFile, VFSDirectory } from './types'
import {
  MOUNT_TABLE,
  getMountChildren,

  type TaskStatus,
} from './mounts'
import {
  fetchTaskFiles,
  fetchSprintFiles,
  fetchMemberFiles,
  fetchTagFiles,
  fetchScheduleFiles,
  fetchTimelogTaskDirs,
  fetchTimelogFiles,
  fetchProjectFiles,
  fetchActivityFiles,
  fetchProfileSettings,
  fetchProfileFiles,
} from './dataAdapters'
import { fetchAutomationFiles, fetchTaskCommentFiles } from './automationAdapters'

/** Pending project switch info — set by cd, cleared after read */
export interface PendingProjectSwitch {
  id: string
  name: string
}

export class VirtualFileSystem {
  private _cwd = '/'
  /** Mutable — changes when user cds into a project from /projects */
  public projectId: string
  public _pendingProjectSwitch: PendingProjectSwitch | null = null

  constructor(projectId: string) {
    this.projectId = projectId
  }

  get cwd(): string {
    return this._cwd
  }

  // ── Path resolution ────────────────────────────────────────────────

  /**
   * Resolves a path (relative or absolute) against the current cwd.
   * Handles `.`, `..`, and multiple consecutive slashes.
   */
  resolve(inputPath: string): string {
    if (!inputPath || inputPath === '.') return this._cwd

    let base = inputPath.startsWith('/') ? '/' : this._cwd

    const segments = (base + '/' + inputPath).split('/').filter(Boolean)
    const resolved: string[] = []

    for (const seg of segments) {
      if (seg === '..') {
        resolved.pop()
      } else if (seg !== '.') {
        resolved.push(seg)
      }
    }

    return '/' + resolved.join('/')
  }

  // ── Static node helpers ────────────────────────────────────────────

  /** Return the static directory node for a mount path, or null */
  private staticDir(path: string): VFSDirectory | null {
    if (path === '/') {
      return { name: '/', path: '/', type: 'dir', entityType: 'root' }
    }
    const entry = MOUNT_TABLE[path]
    if (!entry) return null
    return {
      name: entry.label,
      path,
      type: 'dir',
      entityType: entry.entityType,
      statusValue: entry.taskStatus,
    }
  }

  // ── List directory ─────────────────────────────────────────────────

  /**
   * Returns all VFSNodes that are direct children of `dirPath`.
   * May perform API calls for leaf directories.
   */
  async listDir(dirPath?: string): Promise<VFSNode[]> {
    const target = dirPath ? this.resolve(dirPath) : this._cwd

    // Root: list top-level mount dirs filtered by context
    if (target === '/') {
      const childPaths = getMountChildren('/')
      const isWorkspace = this.projectId === '__workspace__'
      const filtered = childPaths.filter((p) => {
        if (isWorkspace) {
          // Workspace level: show cross-user entities + activity/profile
          return p === '/projects' || p === '/schedules' || p === '/activity' || p === '/profile'
        }
        // Inside a project: show everything EXCEPT /projects
        return p !== '/projects'
      })
      return filtered.map((p) => this.staticDir(p)!).filter(Boolean)
    }

    // task-comments sub-directory: /tasks/<status>/<taskSlug>/comments
    if (target.startsWith('/tasks/') && target.split('/').length === 5 && target.endsWith('/comments')) {
      const parts = target.split('/').filter(Boolean)  // ['tasks', status, taskSlug, 'comments']
      const taskSlug = parts[2]
      const parentPath = `/tasks/${parts[1]}`
      const taskFiles = await fetchTaskFiles(this.projectId, MOUNT_TABLE[parentPath]?.taskStatus as TaskStatus | undefined)
      const taskFile = taskFiles.find(f => f.name === taskSlug || f.name === taskSlug + '.json' || f.name.startsWith(taskSlug))
      if (!taskFile) throw new Error(`No such directory: ${target}`)
      return fetchTaskCommentFiles(taskFile.entityId, target)
    }

    // task-subtasks sub-directory: /tasks/<status>/<taskSlug>/subtasks
    if (target.startsWith('/tasks/') && target.split('/').length === 5 && target.endsWith('/subtasks')) {
      const parts = target.split('/').filter(Boolean)
      const taskSlug = parts[2]
      const parentPath = `/tasks/${parts[1]}`
      const taskFiles = await fetchTaskFiles(this.projectId, MOUNT_TABLE[parentPath]?.taskStatus as TaskStatus | undefined)
      const taskFile = taskFiles.find(f => f.name === taskSlug || f.name === taskSlug + '.json' || f.name.startsWith(taskSlug))
      if (!taskFile) throw new Error(`No such directory: ${target}`)
      // Fetch subtasks (tasks where parentId = this task's id)
      const { data } = await api.get(`/projects/${this.projectId}/tasks`)
      const allTasks: any[] = data ?? []
      const subtasks = allTasks.filter(t => t.parentId === taskFile.entityId)
      return subtasks.map(t => {
        const safeName = (t.title ?? 'subtask').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
        return {
          name: `${safeName}__${String(t.id).slice(0, 8)}.json`,
          path: `${target}/${safeName}__${String(t.id).slice(0, 8)}.json`,
          type: 'file' as const,
          entityType: 'task-subtask' as const,
          entityId: String(t.id),
          data: t,
        }
      })
    }

    // Check if it's a dynamic timelogs directory first
    if (target.startsWith('/timelogs/') && target.split('/').length === 3) {
      const taskDirName = target.split('/')[2]
      const taskDirs = await fetchTimelogTaskDirs(this.projectId)
      const taskProxy = taskDirs.find((d) => d.name === taskDirName)
      if (!taskProxy) throw new Error(`No such directory: ${target}`)
      return this.listTimelogDir(taskProxy.entityId!, target)
    }

    // Check if it's a static mount directory
    const mount = MOUNT_TABLE[target]
    if (!mount) {
      throw new Error(`No such directory: ${target}`)
    }

    // Leaf directories: fetch files from API
    switch (mount.entityType) {
      case 'tasks':
        // /tasks — return the status sub-dirs
        return getMountChildren(target).map((p) => this.staticDir(p)!).filter(Boolean)

      case 'tasks-status': {
        const status = mount.taskStatus as TaskStatus
        return await fetchTaskFiles(this.projectId, status)
      }

      case 'sprints':
        return await fetchSprintFiles(this.projectId)

      case 'members':
        return await fetchMemberFiles(this.projectId)

      case 'tags':
        return await fetchTagFiles(this.projectId)

      case 'schedules':
        return await fetchScheduleFiles(this.projectId)

      case 'projects':
        return await fetchProjectFiles()

      case 'timelogs': {
        // Return a virtual directory node per task
        const taskProxies = await fetchTimelogTaskDirs(this.projectId)
        return taskProxies.map(
          (f): VFSDirectory => ({
            ...f,
            type: 'dir',
            entityType: 'timelogs-task',
          })
        )
      }

      case 'activity':
        return await fetchActivityFiles(this.projectId)

      case 'automations':
        if (this.projectId === '__workspace__') {
          throw new Error('automations: navigate to a project first (cd projects/<name>)')
        }
        return await fetchAutomationFiles(this.projectId)

      case 'profile':
        // /profile — return the sub-dirs (files) plus virtual settings/github nodes
        return [
          ...getMountChildren(target).map((p) => this.staticDir(p)!).filter(Boolean),
          ...(await fetchProfileSettings()),
        ]

      case 'profile-files':
        return await fetchProfileFiles()

      default:
        throw new Error(`Cannot list directory: ${target}`)
    }
  }

  /**
   * List children of a /timelogs/<taskDir> virtual directory.
   * We need to identify the taskId from the directory name.
   */
  async listTimelogDir(taskId: string, basePath: string): Promise<VFSNode[]> {
    return await fetchTimelogFiles(taskId, basePath)
  }

  // ── Change directory ───────────────────────────────────────────────

  /**
   * Validates the target path and updates _cwd.
   * Returns the new cwd on success, throws on error.
   */
  async cd(to: string): Promise<string> {
    if (to === '~' || to === '') {
      this._cwd = '/'
      return this._cwd
    }

    const target = this.resolve(to)

    // Root always valid
    if (target === '/') {
      this._cwd = '/'
      return this._cwd
    }

    // Check static mount table
    if (MOUNT_TABLE[target]) {
      this._cwd = target
      return this._cwd
    }

    // Handle: cd into a project from /projects — fuzzy name match
    // e.g. "cd test", "cd testt2__abc", "cd my-project" when cwd = /projects
    if (target.startsWith('/projects/') && target.split('/').length === 3) {
      const slug = target.split('/')[2].toLowerCase()
      try {
        const { data } = await api.get('/projects')
        const projects: any[] = data ?? []
        // Match by: exact slug, name prefix, or id prefix
        const match = projects.find((p: any) => {
          const safeName = (p.name ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-')
            .slice(0, 40)
          const fullSlug = `${safeName}__${String(p.id).slice(0, 8)}_${(p.status ?? 'active').toLowerCase()}`
          
          // Symmetrical alphanumeric comparison to bypass special character failures
          const cleanName = (p.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
          const cleanSlug = slug.replace(/[^a-z0-9]/g, '')

          return (
            fullSlug === slug ||
            (cleanSlug.length > 0 && cleanName === cleanSlug) ||
            (cleanSlug.length > 0 && cleanName.startsWith(cleanSlug)) ||
            String(p.id).startsWith(slug)
          )
        })
        if (!match) {
          throw new Error(`cd: no such project: "${slug}". Use ls to see available projects.`)
        }
        // Switch project context and reset to project root
        this.projectId = match.id
        this._cwd = '/'
        this._pendingProjectSwitch = { id: match.id, name: match.name }
        return '/'
      } catch (err: any) {
        throw new Error(err.message ?? `cd: failed to resolve project "${slug}"`)
      }
    }

    // Check if it's a /timelogs/<taskDir>
    if (target.startsWith('/timelogs/') && target.split('/').length === 3) {
      // We allow cd into any timelogs sub-dir (we'll validate lazily on ls)
      this._cwd = target
      return this._cwd
    }

    throw new Error(`cd: no such directory: ${to}`)
  }

  // ── Read file ──────────────────────────────────────────────────────

  /**
   * Resolves a path to a VFSFile and returns its data payload.
   * Searches the appropriate adapter based on the file's parent directory.
   */
  async readFile(filePath: string): Promise<Record<string, unknown>> {
    const target = this.resolve(filePath)
    const parts = target.split('/').filter(Boolean)

    if (parts.length === 0) throw new Error(`cat: is a directory: ${target}`)

    const topDir = '/' + parts[0]
    const mount = MOUNT_TABLE[topDir]

    if (!mount) throw new Error(`cat: no such file: ${target}`)

    // Determine which adapter to use based on parent path
    const parentPath = '/' + parts.slice(0, -1).join('/')
    const fileName = parts[parts.length - 1]

    // Fetch all files from the parent dir and find the matching one
    const nodes = await this._fetchFilesForParent(parentPath, parts)
    const file = (nodes as VFSFile[]).find((n) => n.name === fileName)

    if (!file || file.type !== 'file') {
      throw new Error(`cat: no such file: ${target}`)
    }

    return file.data ?? {}
  }

  /**
   * Internal helper: fetch the file list for a given parent path.
   */
  private async _fetchFilesForParent(
    parentPath: string,
    parts: string[]
  ): Promise<VFSNode[]> {
    const parentMount = MOUNT_TABLE[parentPath]

    if (parentPath === '/tasks/todo') return fetchTaskFiles(this.projectId, 'TODO')
    if (parentPath === '/tasks/in_progress') return fetchTaskFiles(this.projectId, 'IN_PROGRESS')
    if (parentPath === '/tasks/in_review') return fetchTaskFiles(this.projectId, 'IN_REVIEW')
    if (parentPath === '/tasks/done') return fetchTaskFiles(this.projectId, 'DONE')
    if (parentPath === '/tasks/ready') return fetchTaskFiles(this.projectId, 'READY')
    if (parentPath === '/sprints') return fetchSprintFiles(this.projectId)
    if (parentPath === '/members') return fetchMemberFiles(this.projectId)
    if (parentPath === '/tags') return fetchTagFiles(this.projectId)
    if (parentPath === '/schedules') return fetchScheduleFiles(this.projectId)
    if (parentPath === '/activity') return fetchActivityFiles(this.projectId)
    if (parentPath === '/automations') return fetchAutomationFiles(this.projectId)
    if (parentPath === '/profile') return fetchProfileSettings()
    if (parentPath === '/profile/files') return fetchProfileFiles()

    // task comments: /tasks/<status>/<taskSlug>/comments/<file>
    if (parts.length === 5 && parts[0] === 'tasks' && parts[3] === 'comments') {
      const taskSlug = parts[2]
      const parentStatus = MOUNT_TABLE[`/tasks/${parts[1]}`]?.taskStatus as TaskStatus | undefined
      const taskFiles = await fetchTaskFiles(this.projectId, parentStatus)
      const taskFile = taskFiles.find(f => f.name === taskSlug || f.name === taskSlug + '.json' || f.name.startsWith(taskSlug))
      if (!taskFile) throw new Error(`cat: no such file`)
      return fetchTaskCommentFiles(taskFile.entityId, parentPath)
    }

    // /timelogs/<taskDirName>/<logFile>
    if (parts[0] === 'timelogs' && parts.length === 3) {
      const taskDirName = parts[1]
      // Resolve the task id from the task dir proxies
      const taskDirs = await fetchTimelogTaskDirs(this.projectId)
      const taskProxy = taskDirs.find((d) => d.name === taskDirName)
      if (!taskProxy) throw new Error(`cat: no such file or directory`)
      return fetchTimelogFiles(taskProxy.entityId!, parentPath)
    }

    if (parentMount && parentMount.entityType === 'tasks-status') {
      const status = parentMount.taskStatus as TaskStatus
      return fetchTaskFiles(this.projectId, status)
    }

    throw new Error(`cat: no such file`)
  }

  // ── Find ──────────────────────────────────────────────────────────

  /**
   * Search for files matching a pattern across a directory.
   * Returns matching VFSFile nodes.
   */
  async find(
    searchPath: string,
    filters: Record<string, string>
  ): Promise<VFSFile[]> {
    const target = this.resolve(searchPath)
    let matchedFiles: VFSFile[] = []

    const nodes = await this.listDir(target)

    for (const node of nodes) {
      if (node.type === 'file') {
        let matches = true
        if (Object.keys(filters).length > 0 && node.data) {
          matches = Object.entries(filters).every(([key, value]) => {
            const dataVal = (node.data as any)[key]
            if (dataVal === undefined) return false
            return String(dataVal).toLowerCase().includes(value.toLowerCase())
          })
        }
        if (matches) matchedFiles.push(node)
      } else if (node.type === 'dir' && node.name !== '.' && node.name !== '..') {
        const subFiles = await this.find(`${target}/${node.name}`, filters)
        matchedFiles = matchedFiles.concat(subFiles)
      }
    }
    return matchedFiles
  }

  // ── Stat ──────────────────────────────────────────────────────────

  /**
   * Returns aggregate statistics for a directory.
   */
  async stat(dirPath: string): Promise<Record<string, unknown>> {
    const target = this.resolve(dirPath)
    
    // Recursive stat helper
    const countNodes = async (p: string): Promise<{ d: number, f: number }> => {
      const nodes = await this.listDir(p)
      let d = 0, f = 0
      for (const node of nodes) {
        if (node.type === 'file') f++
        else if (node.type === 'dir' && node.name !== '.' && node.name !== '..') {
          d++
          const sub = await countNodes(`${p}/${node.name}`)
          d += sub.d
          f += sub.f
        }
      }
      return { d, f }
    }
    
    const { d, f } = await countNodes(target)

    return {
      path: target,
      directories: d,
      files: f,
      total: d + f,
    }
  }
}
