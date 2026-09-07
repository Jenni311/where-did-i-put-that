const DB_NAME = 'where-did-i-put-that'
const STORE_NAME = 'data'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

export async function saveToDatabase<T>(
  key: string,
  value: T
): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    store.put(value, key)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function getFromDatabase<T>(
  key: string
): Promise<T | null> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = () => {
      resolve(request.result ?? null)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}