const DB_NAME = 'where-did-i-put-that'
const STORE_NAME = 'data'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME))
        database.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Apply a group of writes/deletions atomically, and release the connection.
export async function updateDatabase(
  writes: { key: string; value: unknown }[],
  deletes: string[] = [],
): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      transaction.oncomplete = () => resolve()
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Storage operation aborted'))
      transaction.onerror = () => reject(transaction.error)
      for (const key of deletes) store.delete(key)
      for (const { key, value } of writes) store.put(value, key)
    })
  } finally {
    database.close()
  }
}

export function saveToDatabase<T>(key: string, value: T): Promise<void> {
  return updateDatabase([{ key, value }])
}

export async function getFromDatabase<T>(key: string): Promise<T | null> {
  const database = await openDatabase()
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

export function deleteFromDatabase(key: string): Promise<void> {
  return updateDatabase([], [key])
}
