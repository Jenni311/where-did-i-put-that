import { getFromDatabase, updateDatabase } from './db'

export type Photo = { id: string; src: string | null }
type PhotoOwner = {
  itemPhotoKey?: string
  itemPhotoKeys?: string[]
  locationPhotoKey?: string
  locationPhotoKeys?: string[]
  lentToPhotoKey?: string
  lentToPhotoKeys?: string[]
}

// An explicit empty array means all photos were deleted. Only legacy records
// without an array fall back to their original single-photo field.
export function photoKeys(
  item: PhotoOwner,
  kind: 'item' | 'location' | 'lentTo',
): string[] {
  return (
    item[`${kind}PhotoKeys`] ??
    (item[`${kind}PhotoKey`] ? [item[`${kind}PhotoKey`]!] : [])
  )
}

export async function loadPhotos(keys: string[]): Promise<Photo[]> {
  // Keep missing entries attached to their keys, so deletion can never target
  // a different photo after an incomplete legacy restore.
  return Promise.all(
    keys.map(async (id) => ({ id, src: await getFromDatabase<string>(id) })),
  )
}

export async function storePhotos(photos: Photo[]): Promise<string[]> {
  await updateDatabase(
    photos.map((photo) => ({ key: photo.id, value: photo.src })),
  )
  return photos.map((photo) => photo.id)
}

export function readPhoto(file: File): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        id: `photo-${crypto.randomUUID()}`,
        src: reader.result as string,
      })
    reader.onerror = () => reject(reader.error)
    reader.onabort = () => reject(new Error('Photo reading was interrupted.'))
    reader.readAsDataURL(file)
  })
}
