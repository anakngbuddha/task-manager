import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface MutationRecord {
  id?: number
  url: string
  method: string
  body?: any
  timestamp: number
}

interface TaskManagerDB extends DBSchema {
  mutations: {
    key: number
    value: MutationRecord
    indexes: { 'by-time': number }
  }
}

let dbPromise: Promise<IDBPDatabase<TaskManagerDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TaskManagerDB>('tm-offline-store', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('mutations')) {
          const store = db.createObjectStore('mutations', {
            keyPath: 'id',
            autoIncrement: true,
          })
          store.createIndex('by-time', 'timestamp')
        }
      },
    })
  }
  return dbPromise
}

export const offlineStore = {
  async addMutation(mutation: Omit<MutationRecord, 'id'>) {
    const db = await getDB()
    return db.add('mutations', mutation)
  },
  async getMutations(): Promise<MutationRecord[]> {
    const db = await getDB()
    return db.getAllFromIndex('mutations', 'by-time')
  },
  async countQueuedMutations(): Promise<number> {
    const db = await getDB()
    return db.count('mutations')
  },
  async deleteMutation(id: number) {
    const db = await getDB()
    return db.delete('mutations', id)
  }
}
