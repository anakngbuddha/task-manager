/**
 * VirtualFileSystem — the core kernel.
 *
 * Manages current working directory, path resolution,
 * and delegates data fetching to dataAdapters.
 *
 * Instances are created fresh per terminal session and receive
 * the projectId at construction time.
 */
import type { VFSNode, VFSFile, VFSDirectory } from './types'
import {
  MOUNT_TABLE,
  getMountChildren,
  STATUS_PATH_MAP,
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
} from './dataAdapters'

export class VirtualFileSystem {
  private _cwd = '/'
  public readonly projectId: string

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
      entityType: entry.entityType as any,
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

    // Root: list all top-level mount dirs
    if (target === '/') {
      const childPaths = getMountChildren('/')
      return childPaths.map((p) => this.staticDir(p)!).filter(Boolean)
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

    // /timelogs/<taskDirName>/<logFile>
    if (parts[0] === 'timelogs' && parts.length === 3) {
      const taskDirName = parts[1]
      // Resolve the task id from the task dir proxies
      const taskDirs = await fetchTimelogTaskDirs(this.projectId)
      const taskProxy = taskDirs.find((d) => d.name === taskDirName)
      if (!taskProxy) throw new Error(`cat: no such file or directory`)
      return fetchTimelogFiles(taskProxy.entityId, parentPath)
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
    const nodes = await this.listDir(target)

    const files = nodes.filter((n): n is VFSFile => n.type === 'file')

    return files.filter((f) => {
      if (!f.data) return true
      return Object.entries(filters).every(([key, value]) => {
        const dataVal = (f.data as any)[key]
        if (dataVal === undefined) return false
        return String(dataVal).toLowerCase().includes(value.toLowerCase())
      })
    })
  }

  // ── Stat ──────────────────────────────────────────────────────────

  /**
   * Returns aggregate statistics for a directory.
   */
  async stat(dirPath: string): Promise<Record<string, unknown>> {
    const target = this.resolve(dirPath)
    const nodes = await this.listDir(target)

    const dirs = nodes.filter((n) => n.type === 'dir').length
    const files = nodes.filter((n) => n.type === 'file').length

    return {
      path: target,
      directories: dirs,
      files,
      total: nodes.length,
    }
  }
}
