import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

type CacheRecord = {
  key: string
  value: unknown
  updatedAt: number
}

export type OfflineQueuedMutation = {
  id: string
  createdAt: number
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  url: string
  body?: unknown
  headers?: Record<string, string>
}

interface OfflineDB extends DBSchema {
  cache: {
    key: string
    value: CacheRecord
  }
  queue: {
    key: string
    value: OfflineQueuedMutation
    indexes: {
      'by-createdAt': number
    }
  }
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('task-manager-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('queue')) {
          const store = db.createObjectStore('queue', { keyPath: 'id' })
          store.createIndex('by-createdAt', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

export const offlineStore = {
  async setCache(key: string, value: unknown) {
    const db = await getDB()
    const record: CacheRecord = { key, value, updatedAt: Date.now() }
    await db.put('cache', record)
    return record
  },

  async getCache<T = unknown>(key: string): Promise<{ value: T; updatedAt: number } | null> {
    const db = await getDB()
    const record = await db.get('cache', key)
    if (!record) return null
    return { value: record.value as T, updatedAt: record.updatedAt }
  },

  async deleteCache(key: string) {
    const db = await getDB()
    await db.delete('cache', key)
  },

  async enqueueMutation(m: OfflineQueuedMutation) {
    const db = await getDB()
    await db.put('queue', m)
  },

  async listQueuedMutations(limit = 200): Promise<OfflineQueuedMutation[]> {
    const db = await getDB()
    return db.getAllFromIndex('queue', 'by-createdAt', undefined, limit)
  },

  async removeQueuedMutation(id: string) {
    const db = await getDB()
    await db.delete('queue', id)
  },

  async countQueuedMutations(): Promise<number> {
    const db = await getDB()
    return db.count('queue')
  },
}

export const offlineKeys = {
  projectsList: () => 'projects:list',
  projectsDashboard: () => 'projects:dashboard',
  tasksByProject: (projectId: string) => `tasks:project:${projectId}`,
  sprintsByProject: (projectId: string) => `sprints:project:${projectId}`,
}

