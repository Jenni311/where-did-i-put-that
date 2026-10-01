import { supabase } from './supabase'
import { getFromDatabase, updateDatabase } from './db'
import { photoKeys } from './photos'
import type { Photo } from './photos'

export type StoredItem = {
  id: number | string
  name: string
  location: string
  lentTo?: string
  itemPhotoKey?: string
  itemPhotoKeys?: string[]
  locationPhotoKey?: string
  locationPhotoKeys?: string[]
  lentToPhotoKey?: string
  lentToPhotoKeys?: string[]
  revision?: number
  createdAt?: string
  importKey?: string
}

type CloudRow = {
  id: string; name: string; location: string; lent_to: string
  revision: number; created_at: string; import_key: string | null
  item_photos?: { kind: string; position: number; object_path: string; id: string }[]
}
const kinds = ['item', 'location', 'lentTo'] as const
const prefix = 'cloud:'
const bucket = () => supabase.storage.from('item-photos')

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error)
    return String(error.message)
  return 'Something went wrong. Please try again.'
}

export function readLocalItems(): StoredItem[] {
  const value = JSON.parse(localStorage.getItem('storedItems') || '[]')
  if (!Array.isArray(value)) throw new Error('Local items could not be read. Restore a backup before continuing.')
  return value
}

export function itemTime(item: StoredItem) {
  return item.createdAt ? Date.parse(item.createdAt) : typeof item.id === 'number' ? item.id : 0
}

function fromRow(row: CloudRow): StoredItem {
  const photos = [...(row.item_photos ?? [])].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  const result: StoredItem = {
    id: row.id, name: row.name, location: row.location, lentTo: row.lent_to || undefined,
    revision: row.revision, createdAt: row.created_at, importKey: row.import_key ?? undefined,
  }
  for (const kind of kinds) {
    const keys = photos.filter(p => p.kind === (kind === 'lentTo' ? 'person' : kind))
      .map(p => prefix + p.object_path)
    result[`${kind}PhotoKeys`] = keys
    result[`${kind}PhotoKey`] = keys[0]
  }
  return result
}

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// One instance per account view. Closing/switching an account invalidates it.
export class Repository {
  readonly userId: string | null
  private active = true
  private staged = new Map<string, string>()
  private uploaded = new Set<string>()
  private aliases = new Map<string, string>()
  private operations = new Map<string | number, { signature: string; mutation: string }>()
  constructor(userId: string | null) { this.userId = userId }
  activate() { this.active = true }
  dispose() { this.active = false; this.staged.clear(); this.uploaded.clear(); this.aliases.clear() }
  check() {
    if (!this.active) throw new Error('The account changed. Please reopen your items.')
  }
  private async authenticate() {
    this.check()
    if (!navigator.onLine) throw new Error('You are offline. Reconnect, then try again. Your draft is still here.')
    const { data, error } = await supabase.auth.getSession()
    this.check()
    if (error || data.session?.user.id !== this.userId)
      throw new Error('Your session changed. Please sign in again.')
  }
  newId() { return this.userId ? crypto.randomUUID() : Date.now() }
  async load(): Promise<StoredItem[]> {
    this.check()
    if (!this.userId) return readLocalItems()
    await this.authenticate()
    // Paginate so accounts larger than PostgREST's default limit aren't truncated.
    const items: StoredItem[] = []
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.from('items').select('*,item_photos(*)')
        .eq('user_id', this.userId).order('id').range(offset, offset + 99)
      if (error) throw error
      this.check()
      items.push(...(data as CloudRow[]).map(fromRow))
      if (data.length < 100) break
    }
    return items
  }
  async readPhoto(key: string): Promise<string | null> {
    this.check()
    if (!this.userId) return getFromDatabase<string>(key)
    if (this.staged.has(key)) return this.staged.get(key)!
    if (!key.startsWith(prefix + this.userId + '/')) throw new Error('Photo belongs to a different account.')
    await this.authenticate()
    const { data, error } = await bucket().download(key.slice(prefix.length))
    if (error) throw error
    this.check()
    return asDataUrl(data)
  }
  async stage(photos: Photo[]): Promise<string[]> {
    this.check()
    if (!this.userId) {
      await updateDatabase(photos.map(p => ({ key: p.id, value: p.src })))
      return photos.map(p => p.id)
    }
    return photos.map(photo => {
      if (!photo.src) throw new Error('A photo is unavailable. It has not been copied.')
      // The original draft id is stable across retries.
      const id = this.aliases.get(photo.id) ?? crypto.randomUUID()
      this.aliases.set(photo.id, id)
      const key = prefix + this.userId + '/' + id
      this.staged.set(key, photo.src)
      return key
    })
  }
  async save(item: StoredItem): Promise<StoredItem> {
    this.check()
    if (!this.userId) return item
    await this.authenticate()
    const manifest: { id: string; path: string; kind: string; position: number }[] = []
    for (const kind of kinds) {
      for (const [position, key] of photoKeys(item, kind).entries()) {
        if (!key.startsWith(prefix + this.userId + '/')) throw new Error('Photo has not been copied to this account.')
        const path = key.slice(prefix.length)
        if (this.staged.has(key) && !this.uploaded.has(key)) {
          const blob = await (await fetch(this.staged.get(key)!)).blob()
          if (blob.size > 20 * 1024 * 1024) throw new Error('One photo is over 20 MB. Please choose a smaller copy.')
          await this.authenticate()
          const prepared = await supabase.rpc('prepare_photo', { p_item: item.id, p_path: path })
          if (prepared.error) {
            if (prepared.error.message.includes('expired')) {
              this.aliases.clear(); this.uploaded.clear()
            }
            throw prepared.error
          }
          const { error } = await bucket().upload(path, blob, { contentType: blob.type, upsert: false })
          // A lost response can leave the immutable file successfully uploaded.
          if (error) {
            // Verify an ambiguous upload response against the immutable bytes.
            const existing = await bucket().download(path)
            if (existing.error || await asDataUrl(existing.data) !== await asDataUrl(blob)) throw error
          }
          this.check()
          this.uploaded.add(key)
        }
        manifest.push({ id: path.split('/')[1], path, kind: kind === 'lentTo' ? 'person' : kind, position })
      }
    }
    const signature = JSON.stringify([item, manifest])
    const previous = this.operations.get(item.id)
    const mutation = previous?.signature === signature ? previous.mutation : crypto.randomUUID()
    this.operations.set(item.id, { signature, mutation })
    await this.authenticate()
    const { data, error } = await supabase.rpc('save_item', {
      p_id: item.id, p_revision: item.revision ?? null, p_mutation: mutation,
      p_name: item.name, p_location: item.location, p_lent_to: item.lentTo ?? '',
      p_photos: manifest, p_import_key: item.importKey ?? null,
    })
    if (error) throw error
    this.check()
    const row = (Array.isArray(data) ? data[0] : data) as CloudRow
    if (!row || typeof row.revision !== 'number') throw new Error('Save response could not be confirmed. Please retry.')
    // Use the committed payload instead of another network read after a save.
    return { ...item, revision: row.revision, createdAt: row.created_at }
  }
  async remove(item: StoredItem) {
    this.check()
    if (!this.userId) {
      await updateDatabase([], kinds.flatMap(kind => photoKeys(item, kind)))
      return
    }
    await this.authenticate()
    const { error } = await supabase.rpc('delete_item', { p_id: item.id, p_revision: item.revision })
    if (error) throw error
    this.check()
  }
  async cleanup(): Promise<boolean> {
    if (!this.userId) return true
    try {
      await this.authenticate()
      const expired = await supabase.rpc('expire_photo_uploads')
      if (expired.error) throw expired.error
      const { data, error } = await supabase.from('photo_cleanup').select('object_path').eq('user_id', this.userId).limit(100)
      if (error) throw error
      for (const row of data) {
        await this.authenticate()
        const { error: removal } = await bucket().remove([row.object_path])
        if (removal) throw removal
        const { error: cleared } = await supabase.from('photo_cleanup').delete().eq('object_path', row.object_path)
        if (cleared) throw cleared
      }
      return data.length < 100
    } catch { return false }
  }
}

// Content fingerprint makes copying the same backup/local item retryable.
export async function importItem(repository: Repository, source: StoredItem,
  read: (key: string) => Promise<string | null>) {
  repository.check()
  // Restoring an account backup into that same account must not duplicate its
  // still-existing records or overwrite newer edits.
  if (typeof source.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.id)) {
    const existing = await supabase.from('items').select('id')
      .eq('user_id', repository.userId!).eq('id', source.id).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) return
  }
  const photos = [] as { kind: typeof kinds[number]; src: string }[]
  for (const kind of kinds) for (const key of photoKeys(source, kind)) {
    const src = await read(key)
    if (!src) throw new Error(`A photo for ${source.name || 'an item'} is missing. Its original item was kept.`)
    photos.push({ kind, src })
  }
  const bytes = new TextEncoder().encode(JSON.stringify([repository.userId, source.id, source.name, source.location, source.lentTo, photos]))
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('')
  const importKey = 'copy-v1:' + hash
  const { data, error } = await supabase.from('items').select('id').eq('user_id', repository.userId!).eq('import_key', importKey).maybeSingle()
  if (error) throw error
  if (data) return
  const uuid = (hex: string) => `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
  const item: StoredItem = { id: uuid(hash), name: source.name, location: source.location, lentTo: source.lentTo, importKey }
  for (const kind of kinds) {
    const draft: Photo[] = []
    for (const [index, photo] of photos.entries()) if (photo.kind === kind) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash + ':' + index))
      const photoHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
      draft.push({ id: uuid(photoHash), src: photo.src })
    }
    item[`${kind}PhotoKeys`] = await repository.stage(draft)
    item[`${kind}PhotoKey`] = item[`${kind}PhotoKeys`]?.[0]
  }
  await repository.save(item)
}
