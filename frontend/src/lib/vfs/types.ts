/** The two kinds of nodes in the virtual file system */
export type VFSNodeType = 'dir' | 'file'

/** The backing data source of a VFS node */
export type VFSEntityType =
  | 'root'
  | 'tasks'
  | 'tasks-status'  // sub-directory like /tasks/todo
  | 'task'
  | 'sprints'
  | 'sprint'
  | 'members'
  | 'member'
  | 'tags'
  | 'tag'
  | 'schedules'
  | 'schedule'
  | 'timelogs'
  | 'timelogs-task'  // sub-directory like /timelogs/task-xxx
  | 'timelog'
  | 'projects'
  | 'project'
  | 'activity'
  | 'profile'
  | 'profile-files'
  | 'profile-settings'
  | 'profile-github'
  | 'profile-file'

export interface BaseVFSNode {
  /** Display name (what ls shows) */
  name: string
  /** Absolute virtual path */
  path: string
  type: VFSNodeType
  entityType: VFSEntityType
  /** For files: the backing entity id */
  entityId?: string
  /** For task-status dirs: the status value */
  statusValue?: string
  /** For timelog sub-dirs: the parent task id */
  parentTaskId?: string
}

export interface VFSDirectory extends BaseVFSNode {
  type: 'dir'
}

export interface VFSFile extends BaseVFSNode {
  type: 'file'
  entityId: string
  /** Cached payload — filled lazily by VirtualFileSystem.readFile */
  data?: Record<string, unknown>
}

/** The discriminated union for all nodes in the VFS */
export type VFSNode = VFSDirectory | VFSFile


/** Thin descriptor: what type of content to output */
export type OutputSpecType =
  | 'stdout'
  | 'stderr'
  | 'system'
  | 'success'
  | 'echo'
  | 'empty'
  | 'banner'
  | 'table'
  | 'json'
