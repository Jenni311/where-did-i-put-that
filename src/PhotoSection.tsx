import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { readPhoto } from './photos'
import type { Photo } from './photos'

type Props = {
  label: 'item' | 'location' | 'person'
  photos: Photo[]
  onAdd: (photos: Photo[]) => void
  onRemove: (photo: Photo) => void | Promise<void>
  scrollTargetId: string
  editing?: boolean
  disabled?: boolean
  onBusyChange: (busy: boolean) => void
}

export function PhotoSection({
  label,
  photos,
  onAdd,
  onRemove,
  scrollTargetId,
  editing = false,
  disabled = false,
  onBusyChange,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const locked = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || locked.current) return
    if (files.some((file) => file.type && !file.type.startsWith('image/'))) {
      setError('Please choose image files.')
      return
    }
    locked.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    try {
      const added = await Promise.all(files.map(readPhoto))
      // Decode before rendering and scrolling so tall photos cannot move the
      // Save button again after the scroll has finished.
      await Promise.all(
        added.map((photo) => {
          const image = new Image()
          image.src = photo.src!
          return image.decode().catch(() => undefined)
        }),
      )
      if (!mounted.current) return
      onAdd(added)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (mounted.current)
            document
              .getElementById(scrollTargetId)
              ?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }),
      )
    } catch {
      if (mounted.current)
        setError('The photo could not be read. Please try again.')
    } finally {
      locked.current = false
      onBusyChange(false)
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <fieldset
      className="photo-option photo-section"
      aria-label={`${label} photos`}
      disabled={disabled || busy}
    >
      {photos.map((photo, index) => (
        <div key={photo.id} className="photo-preview-wrapper">
          {photo.src ? (
            <img
              className="photo-preview"
              src={photo.src}
              alt={`${label} photo ${index + 1}`}
            />
          ) : (
            <p className="missing-photo">Photo unavailable</p>
          )}
          <button
            type="button"
            className="remove-preview-photo"
            aria-label={`Delete ${label} photo ${index + 1}`}
            onClick={async () => {
              if (locked.current) return
              locked.current = true
              setBusy(true)
              onBusyChange(true)
              try {
                await onRemove(photo)
              } finally {
                locked.current = false
                onBusyChange(false)
                if (mounted.current) setBusy(false)
              }
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div
        className={
          editing ? 'edit-photo-choice-buttons' : 'photo-choice-buttons'
        }
      >
        <label className="photo-button">
          Add photo
          <input
            className="photo-input"
            type="file"
            accept="image/*"
            multiple
            onChange={addPhotos}
            aria-label={`Add ${label} photos`}
          />
        </label>
        <label className="photo-button">
          Take photo
          <input
            className="photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={addPhotos}
            aria-label={`Take ${label} photo`}
          />
        </label>
      </div>
      {busy && <p role="status">Updating photos…</p>}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
