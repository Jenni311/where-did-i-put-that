import { useCallback, useEffect, useRef, useState } from 'react'
import { PhotoSection } from './PhotoSection'
import { loadPhotos, photoKeys, storePhotos } from './photos'
import type { Photo } from './photos'
import { deleteFromDatabase, getFromDatabase, updateDatabase } from './db'
import blackCatHero2 from './assets/black-cat-hero-2.png'
type StoredItem = {
  id: number
  name: string
  location: string
  lentTo?: string
  lentToPhotoKey?: string
  lentToPhotoKeys?: string[]
  itemPhotoKey?: string
  itemPhotoKeys?: string[]
  locationPhotoKey?: string
  locationPhotoKeys?: string[]
}

function App() {
  const [itemName, setItemName] = useState('')
  const [location, setLocation] = useState('')
  const [showLendingForm, setShowLendingForm] = useState(false)
  const [lentItemName, setLentItemName] = useState('')
  const [lentTo, setLentTo] = useState('')
  const [lentItemPhotos, setLentItemPhotos] = useState<Photo[]>([])
  const [lentToPhotos, setLentToPhotos] = useState<Photo[]>([])
  const [editLentTo, setEditLentTo] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showRememberForm, setShowRememberForm] = useState(false)
  const [openItemId, setOpenItemId] = useState<number | null>(null)
  const [openItemPhotos, setOpenItemPhotos] = useState<Photo[]>([])
  const [openLocationPhotos, setOpenLocationPhotos] = useState<Photo[]>([])
  const [openLentToPhotos, setOpenLentToPhotos] = useState<Photo[]>([])
  const [itemPhotos, setItemPhotos] = useState<Photo[]>([])
  const [locationPhotos, setLocationPhotos] = useState<Photo[]>([])
  const openRequest = useRef(0)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [pendingPhotoOperations, setPendingPhotoOperations] = useState(0)
  const photoBusyRef = useRef(0)
  const onPhotoBusyChange = useCallback((busy: boolean) => {
    photoBusyRef.current += busy ? 1 : -1
    setPendingPhotoOperations(photoBusyRef.current)
  }, [])
  const [itemThumbnails, setItemThumbnails] = useState<Record<number, string>>(
    {},
  )
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editItemPhotos, setEditItemPhotos] = useState<Photo[]>([])
  const [editLocationPhotos, setEditLocationPhotos] = useState<Photo[]>([])
  const [editLentToPhotos, setEditLentToPhotos] = useState<Photo[]>([])
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [sortMode, setSortMode] = useState<
    'alphabetical' | 'newest' | 'oldest'
  >('alphabetical')
  const [saveMessage, setSaveMessage] = useState('')
  const [restoreMessage, setRestoreMessage] = useState('')
  const [isRememberFormClosing, setIsRememberFormClosing] = useState(false)

  const [itemCategory, setItemCategory] = useState<
    'all' | 'put-away' | 'lent-out'
  >('all')

  const [items, setItems] = useState<StoredItem[]>(() => {
    const savedItems = localStorage.getItem('storedItems')

    if (savedItems) {
      return JSON.parse(savedItems)
    }

    return []
  })

  useEffect(() => {
    localStorage.setItem('storedItems', JSON.stringify(items))
  }, [items])

  useEffect(() => {
    let cancelled = false

    async function loadThumbnails() {
      const thumbnails: Record<number, string> = {}

      for (const item of items) {
        const primaryKey = photoKeys(item, 'item')[0]
        if (primaryKey) {
          const photo = await getFromDatabase<string>(primaryKey)

          if (photo) {
            thumbnails[item.id] = photo
          }
        }
      }

      if (!cancelled) {
        setItemThumbnails(thumbnails)
      }
    }

    loadThumbnails()

    return () => {
      cancelled = true
    }
  }, [items])

  function resetEdit() {
    setEditingItemId(null)
    setEditItemPhotos([])
    setEditLocationPhotos([])
    setEditLentToPhotos([])
  }

  function closeItem() {
    if (savingRef.current || photoBusyRef.current) return
    openRequest.current++
    setOpenItemId(null)
    setOpenItemPhotos([])
    setOpenLocationPhotos([])
    setOpenLentToPhotos([])
    setLoadingPhotos(false)
    resetEdit()
  }

  async function toggleItem(item: StoredItem, scroll = false) {
    if (savingRef.current || photoBusyRef.current) return
    if (openItemId === item.id) {
      closeItem()
      return
    }
    const request = ++openRequest.current
    resetEdit()
    setOpenItemId(item.id)
    setOpenItemPhotos([])
    setOpenLocationPhotos([])
    setOpenLentToPhotos([])
    setLoadingPhotos(true)
    try {
      const [itemPhotos, locationPhotos, personPhotos] = await Promise.all([
        loadPhotos(photoKeys(item, 'item')),
        loadPhotos(photoKeys(item, 'location')),
        loadPhotos(photoKeys(item, 'lentTo')),
      ])
      if (request !== openRequest.current) return
      setOpenItemPhotos(itemPhotos)
      setOpenLocationPhotos(locationPhotos)
      setOpenLentToPhotos(personPhotos)
      if (scroll)
        requestAnimationFrame(() => {
          if (request === openRequest.current) {
            document
              .getElementById(`saved-item-${item.id}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }
        })
    } catch {
      if (request === openRequest.current)
        window.alert(
          'The photos could not be loaded. Please reopen the item to try again.',
        )
    } finally {
      if (request === openRequest.current) setLoadingPhotos(false)
    }
  }

  async function removeSavedPhoto(
    item: StoredItem,
    kind: 'item' | 'location' | 'lentTo',
    photo: Photo,
  ) {
    if (
      !window.confirm(
        'Delete this photo permanently? This cannot be undone with Cancel.',
      )
    )
      return
    try {
      await deleteFromDatabase(photo.id)
      setItems((previous) =>
        previous.map((saved) => {
          if (saved.id !== item.id) return saved
          const remaining = photoKeys(saved, kind).filter(
            (key) => key !== photo.id,
          )
          return {
            ...saved,
            [`${kind}PhotoKeys`]: remaining,
            [`${kind}PhotoKey`]: remaining[0],
          }
        }),
      )
      const setPhotos =
        kind === 'item'
          ? setOpenItemPhotos
          : kind === 'location'
            ? setOpenLocationPhotos
            : setOpenLentToPhotos
      setPhotos((previous) => previous.filter((saved) => saved.id !== photo.id))
    } catch {
      window.alert('The photo could not be deleted. Please try again.')
    }
  }

  async function deleteItem(item: StoredItem) {
    if (
      !window.confirm(
        `Are you sure you want to delete ${item.name || 'this item'}? This will also delete its saved photos.`,
      )
    )
      return
    try {
      const keys = [
        ...photoKeys(item, 'item'),
        ...photoKeys(item, 'location'),
        ...photoKeys(item, 'lentTo'),
      ]
      await updateDatabase([], keys)
      setItems((previous) => previous.filter((saved) => saved.id !== item.id))
      if (openItemId === item.id) closeItem()
    } catch {
      window.alert('The item could not be deleted. Please try again.')
    }
  }

  async function saveEditedItem() {
    const itemToEdit = items.find((item) => item.id === editingItemId)
    if (!itemToEdit || savingRef.current || photoBusyRef.current) return
    if (itemToEdit.lentTo && (!editName.trim() || !editLentTo.trim())) {
      window.alert('Please enter the item name and who you lent it to.')
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const itemPhotoKeys = [
        ...photoKeys(itemToEdit, 'item'),
        ...(await storePhotos(editItemPhotos)),
      ]
      const locationPhotoKeys = [
        ...photoKeys(itemToEdit, 'location'),
        ...(await storePhotos(editLocationPhotos)),
      ]
      const lentToPhotoKeys = [
        ...photoKeys(itemToEdit, 'lentTo'),
        ...(await storePhotos(editLentToPhotos)),
      ]
      setItems((previous) =>
        previous.map((item) =>
          item.id === itemToEdit.id
            ? {
                ...item,
                name: editName,
                location: itemToEdit.lentTo ? item.location : editLocation,
                ...(itemToEdit.lentTo ? { lentTo: editLentTo.trim() } : {}),
                itemPhotoKey: itemPhotoKeys[0],
                itemPhotoKeys,
                locationPhotoKey: locationPhotoKeys[0],
                locationPhotoKeys,
                lentToPhotoKey: lentToPhotoKeys[0],
                lentToPhotoKeys,
              }
            : item,
        ),
      )
      setOpenItemPhotos((previous) => [...previous, ...editItemPhotos])
      setOpenLocationPhotos((previous) => [...previous, ...editLocationPhotos])
      setOpenLentToPhotos((previous) => [...previous, ...editLentToPhotos])
      resetEdit()
    } catch {
      window.alert(
        'Changes could not be saved. Your new photos are still here; please try again.',
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function saveItem() {
    if (
      savingRef.current ||
      photoBusyRef.current ||
      (!itemName.trim() && !itemPhotos.length) ||
      (!location.trim() && !locationPhotos.length)
    )
      return
    savingRef.current = true
    setSaving(true)
    try {
      const itemPhotoKeys = await storePhotos(itemPhotos)
      const locationPhotoKeys = await storePhotos(locationPhotos)
      const newItem: StoredItem = {
        id: Date.now(),
        name: itemName,
        location,
        itemPhotoKey: itemPhotoKeys[0],
        itemPhotoKeys,
        locationPhotoKey: locationPhotoKeys[0],
        locationPhotoKeys,
      }
      setItems((previous) => [...previous, newItem])
      setItemName('')
      setLocation('')
      setItemPhotos([])
      setLocationPhotos([])
      setIsRememberFormClosing(true)
      setTimeout(() => {
        setShowRememberForm(false)
        setIsRememberFormClosing(false)
        setSaveMessage('Saved ✓')
        setTimeout(() => setSaveMessage(''), 3000)
      }, 300)
    } catch {
      window.alert(
        'The item could not be saved. Your photos are still here; please try again.',
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function saveLentItem() {
    const name = lentItemName.trim()
    const person = lentTo.trim()
    if (!name || !person || savingRef.current || photoBusyRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const id = Date.now()
      const itemPhotoKeys = await storePhotos(lentItemPhotos)
      const lentToPhotoKeys = await storePhotos(lentToPhotos)
      setItems((previous) => [
        ...previous,
        {
          id,
          name,
          location: '',
          lentTo: person,
          itemPhotoKey: itemPhotoKeys[0],
          itemPhotoKeys,
          lentToPhotoKey: lentToPhotoKeys[0],
          lentToPhotoKeys,
        },
      ])
      setLentItemName('')
      setLentTo('')
      setLentItemPhotos([])
      setLentToPhotos([])
      setSaveMessage('Lent item saved ✓')
      setTimeout(() => setSaveMessage(''), 3000)
      setShowLendingForm(false)
    } catch {
      window.alert('The lent item could not be saved. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const searchResults = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.lentTo ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  async function backupData() {
    try {
      const photos: Record<string, string> = {}
      for (const item of items) {
        const keys = [
          ...photoKeys(item, 'item'),
          ...photoKeys(item, 'location'),
          ...photoKeys(item, 'lentTo'),
        ]
        for (const key of keys) {
          const photo = await getFromDatabase<string>(key)
          if (photo !== null) photos[key] = photo
        }
      }
      const backup = {
        version: 2,
        exportedAt: new Date().toISOString(),
        items,
        photos,
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `where-did-i-put-that-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      window.alert('The backup could not be created. Please try again.')
    }
  }

  async function restoreData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || savingRef.current || photoBusyRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const backup = JSON.parse(await file.text())
      if (
        !backup ||
        ![1, 2].includes(backup.version) ||
        !Array.isArray(backup.items)
      )
        throw new Error('Invalid backup')
      if (
        backup.version === 2 &&
        (!backup.photos ||
          typeof backup.photos !== 'object' ||
          Array.isArray(backup.photos))
      )
        throw new Error('Invalid photos')
      const restoredItems: StoredItem[] = []
      const writes: { key: string; value: string }[] = []
      for (const entry of backup.items) {
        if (
          !entry ||
          typeof entry.id !== 'number' ||
          !Number.isFinite(entry.id) ||
          typeof entry.name !== 'string' ||
          typeof entry.location !== 'string'
        )
          throw new Error('Invalid item')
        for (const field of [
          'lentTo',
          'itemPhotoKey',
          'locationPhotoKey',
          'lentToPhotoKey',
        ]) {
          if (entry[field] !== undefined && typeof entry[field] !== 'string')
            throw new Error('Invalid field')
        }
        for (const field of [
          'itemPhotoKeys',
          'locationPhotoKeys',
          'lentToPhotoKeys',
        ]) {
          if (
            entry[field] !== undefined &&
            (!Array.isArray(entry[field]) ||
              entry[field].some((key: unknown) => typeof key !== 'string'))
          )
            throw new Error('Invalid photo keys')
        }
        const item: StoredItem = {
          id: entry.id,
          name: entry.name,
          location: entry.location,
          lentTo: entry.lentTo,
          itemPhotoKeys: photoKeys(entry, 'item'),
          locationPhotoKeys: photoKeys(entry, 'location'),
          itemPhotoKey: photoKeys(entry, 'item')[0],
          locationPhotoKey: photoKeys(entry, 'location')[0],
          lentToPhotoKey: photoKeys(entry, 'lentTo')[0],
          lentToPhotoKeys: photoKeys(entry, 'lentTo'),
        }
        const keys = [
          ...photoKeys(item, 'item'),
          ...photoKeys(item, 'location'),
          ...photoKeys(item, 'lentTo'),
        ]
        for (const key of keys) {
          const photo =
            backup.version === 2
              ? backup.photos[key]
              : key === item.itemPhotoKey
                ? entry.itemPhoto
                : key === item.locationPhotoKey
                  ? entry.locationPhoto
                  : entry.lentToPhoto
          if (photo !== undefined && photo !== null) {
            if (typeof photo !== 'string' || !photo.startsWith('data:image/'))
              throw new Error('Invalid photo')
            writes.push({ key, value: photo })
          }
        }
        restoredItems.push(item)
      }
      if (
        !window.confirm(
          'Restore this backup? Existing items will be kept, and matching items will be updated.',
        )
      )
        return
      await updateDatabase(writes)
      // Close stale galleries before showing the restored records.
      openRequest.current++
      setOpenItemId(null)
      setOpenItemPhotos([])
      setOpenLocationPhotos([])
      resetEdit()
      setItems((current) => {
        const merged = new Map(current.map((item) => [item.id, item]))
        for (const item of restoredItems) merged.set(item.id, item)
        return Array.from(merged.values())
      })
      setRestoreMessage('Backup restored ✓')
      setTimeout(() => setRestoreMessage(''), 3000)
    } catch {
      window.alert(
        'The backup could not be restored. Please check that you selected the correct file.',
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  return (
    <main>
      <div className="hero">
        <div className="hero-text">
          <h1>Where Did I Put That?</h1>

          <p className="hero-subtitle">
            Save where you put things
            <br />
            so you can find them later.
          </p>

          <p className="hero-tagline">
            For everything
            <br />
            you've put
            <br />
            somewhere
          </p>
        </div>

        <img className="hero-image" src={blackCatHero2} alt="" />
      </div>

      <h2>Find your stuff...</h2>

      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search for an item..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {search && (
          <button
            type="button"
            className="clear-search-button"
            disabled={saving || pendingPhotoOperations > 0}
            onClick={() => {
              setSearch('')
              closeItem()
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {search && (
        <div className="search-results">
          {searchResults.length > 0 ? (
            searchResults.map((item) => (
              <div
                id={`search-result-${item.id}`}
                className={`search-result ${
                  openItemId === item.id ? 'search-result-open' : ''
                }`}
                key={item.id}
              >
                <button
                  className="search-result-toggle"
                  disabled={saving || pendingPhotoOperations > 0}
                  onClick={() => toggleItem(item)}
                >
                  <strong>{item.name}</strong>
                </button>

                {openItemId === item.id && (
                  <div className="search-result-details">
                    {openItemPhotos.map(
                      (photo) =>
                        photo.src && (
                          <img
                            key={photo.id}
                            className="saved-item-photo"
                            src={photo.src}
                            alt="Saved item"
                          />
                        ),
                    )}

                    {item.lentTo ? (
                      <div className="lent-to-details">
                        <p className="saved-detail-label">Lent to</p>
                        <p className="saved-item-location">{item.lentTo}</p>
                      </div>
                    ) : (
                      item.location && (
                        <p className="saved-item-location">{item.location}</p>
                      )
                    )}

                    {!item.lentTo &&
                      openLocationPhotos.map(
                        (photo) =>
                          photo.src && (
                            <img
                              key={photo.id}
                              className="saved-item-photo"
                              src={photo.src}
                              alt="Saved location"
                            />
                          ),
                      )}
                    {item.lentTo &&
                      openLentToPhotos
                        .filter((photo) => photo.src)
                        .map((photo, index) => (
                          <img
                            key={photo.id}
                            className="saved-item-photo"
                            src={photo.src ?? undefined}
                            alt={`Person lent to ${index + 1}`}
                          />
                        ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p>No matching items found.</p>
          )}
        </div>
      )}
      <button
        className="remember-button"
        disabled={saving || pendingPhotoOperations > 0}
        onClick={() => {
          const opening = !showRememberForm

          closeItem()
          setShowRememberForm(opening)

          if (opening) {
            setShowAll(false)
            setShowLendingForm(false)

            setTimeout(() => {
              document.getElementById('remember-form')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }, 100)
          }
        }}
      >
        {showRememberForm ? 'Hide' : '+ Save a new item'}
      </button>

      {showRememberForm && (
        <div
          id="remember-form"
          className={`remember-form${isRememberFormClosing ? ' closing' : ''}`}
        >
          <label>
            What is it?
            <input
              type="text"
              placeholder="e.g. Passport"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
            />
          </label>
          <PhotoSection
            onBusyChange={onPhotoBusyChange}
            label="item"
            photos={itemPhotos}
            onAdd={(photos) =>
              setItemPhotos((previous) => [...previous, ...photos])
            }
            onRemove={(photo) =>
              setItemPhotos((previous) =>
                previous.filter((saved) => saved.id !== photo.id),
              )
            }
            scrollTargetId="save-item-button"
            disabled={saving}
          />
          <label>
            Where did you put it?
            <input
              type="text"
              placeholder="e.g. Blue box in bedroom wardrobe"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <PhotoSection
            onBusyChange={onPhotoBusyChange}
            label="location"
            photos={locationPhotos}
            onAdd={(photos) =>
              setLocationPhotos((previous) => [...previous, ...photos])
            }
            onRemove={(photo) =>
              setLocationPhotos((previous) =>
                previous.filter((saved) => saved.id !== photo.id),
              )
            }
            scrollTargetId="save-item-button"
            disabled={saving}
          />
          <button
            id="save-item-button"
            disabled={
              saving || pendingPhotoOperations > 0 || isRememberFormClosing
            }
            onClick={saveItem}
          >
            Save item
          </button>{' '}
        </div>
      )}

      {!saveMessage && (
        <div className="lending-options">
          <button
            type="button"
            className="more-button"
            style={{
              background: 'transparent',
              border: 0,
              boxShadow: 'none',
              width: 'auto',
            }}
            disabled={saving || pendingPhotoOperations > 0}
            aria-expanded={showLendingForm}
            aria-controls="lending-form"
            onClick={() => {
              const opening = !showLendingForm

              closeItem()
              setShowLendingForm(opening)

              if (opening) {
                setShowRememberForm(false)
                setShowAll(false)

                setTimeout(() => {
                  document.getElementById('lending-form')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }, 100)
              }
            }}
          >
            Want to lend something?
          </button>

          {showLendingForm && (
            <form
              id="lending-form"
              className="remember-form"
              onSubmit={(event) => {
                event.preventDefault()
                saveLentItem()
              }}
            >
              <label>
                What is it?
                <input
                  type="text"
                  placeholder="e.g. The Hobbit"
                  value={lentItemName}
                  onChange={(event) => setLentItemName(event.target.value)}
                  required
                />
              </label>

              <PhotoSection
                onBusyChange={onPhotoBusyChange}
                label="item"
                photos={lentItemPhotos}
                onAdd={(photos) =>
                  setLentItemPhotos((previous) => [...previous, ...photos])
                }
                onRemove={(photo) =>
                  setLentItemPhotos((previous) =>
                    previous.filter((saved) => saved.id !== photo.id),
                  )
                }
                scrollTargetId="save-lent-item-button"
                disabled={saving}
              />

              <label id="lent-to-section">
                Who did you lend it to?
                <input
                  type="text"
                  placeholder="e.g. Laura"
                  value={lentTo}
                  onChange={(event) => setLentTo(event.target.value)}
                  required
                />
              </label>

              <PhotoSection
                onBusyChange={onPhotoBusyChange}
                label="person"
                photos={lentToPhotos}
                onAdd={(photos) =>
                  setLentToPhotos((previous) => [...previous, ...photos])
                }
                onRemove={(photo) =>
                  setLentToPhotos((previous) =>
                    previous.filter((saved) => saved.id !== photo.id),
                  )
                }
                scrollTargetId="save-lent-item-button"
                disabled={saving}
              />
              <button
                id="save-lent-item-button"
                type="submit"
                disabled={
                  saving ||
                  pendingPhotoOperations > 0 ||
                  !lentItemName.trim() ||
                  !lentTo.trim()
                }
              >
                Save lent item
              </button>
            </form>
          )}
        </div>
      )}
      {saveMessage && <div className="save-message">{saveMessage}</div>}
      {restoreMessage && <div className="save-message">{restoreMessage}</div>}
      <button
        className="view-all-button"
        disabled={saving || pendingPhotoOperations > 0}
        onClick={() => {
          const opening = !showAll
          closeItem()
          setShowAll(opening)

          if (opening) {
            setShowRememberForm(false)
            setShowLendingForm(false)
          }

          if (!opening) {
            setOpenItemId(null)
            setItemCategory('all')
          }

          if (opening) {
            setTimeout(() => {
              document.getElementById('all-saved-items')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }, 100)
          }
        }}
      >
        {showAll ? 'Hide saved items' : 'View all saved items'}
      </button>

      {showAll && (
        <div id="all-saved-items">
          <h2>All saved items</h2>

          <div className="saved-items-categories">
            <button
              type="button"
              className={itemCategory === 'all' ? 'active' : ''}
              onClick={() => setItemCategory('all')}
            >
              All
            </button>

            <button
              type="button"
              className={itemCategory === 'put-away' ? 'active' : ''}
              onClick={() => setItemCategory('put-away')}
            >
              Put away
            </button>

            <button
              type="button"
              className={itemCategory === 'lent-out' ? 'active' : ''}
              onClick={() => setItemCategory('lent-out')}
            >
              Lent out
            </button>
          </div>

          <div className="saved-items-sort">
            <label htmlFor="sort-items">Sort by</label>

            <select
              id="sort-items"
              value={sortMode}
              onChange={(event) =>
                setSortMode(
                  event.target.value as 'alphabetical' | 'newest' | 'oldest',
                )
              }
            >
              <option value="alphabetical">Alphabetically</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">Nothing here yet.</p>
              <p className="empty-state-text">
                Add your first item and you'll know exactly where to find it.
              </p>
            </div>
          ) : items.filter((item) => {
              if (itemCategory === 'lent-out') {
                return Boolean(item.lentTo)
              }

              if (itemCategory === 'put-away') {
                return !item.lentTo
              }

              return true
            }).length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">
                {itemCategory === 'lent-out'
                  ? 'Nothing lent out at the moment.'
                  : 'Nothing put away yet.'}
              </p>
            </div>
          ) : (
            <div className="saved-items-list">
              {items
                .filter((item) => {
                  if (itemCategory === 'lent-out') {
                    return Boolean(item.lentTo)
                  }

                  if (itemCategory === 'put-away') {
                    return !item.lentTo
                  }

                  return true
                })
                .sort((a, b) => {
                  if (sortMode === 'newest') {
                    return b.id - a.id
                  }

                  if (sortMode === 'oldest') {
                    return a.id - b.id
                  }

                  return a.name.localeCompare(b.name, 'fi', {
                    sensitivity: 'base',
                  })
                })
                .map((item) => (
                  <div
                    id={`saved-item-${item.id}`}
                    className={`saved-item ${
                      openItemId === item.id ? 'saved-item-open' : ''
                    }`}
                    key={item.id}
                  >
                    <button
                      className="saved-item-toggle"
                      disabled={saving || pendingPhotoOperations > 0}
                      onClick={() => toggleItem(item, true)}
                    >
                      <div className="saved-item-top">
                        <div
                          className={`saved-item-title ${
                            itemThumbnails[item.id] ? 'has-thumbnail' : ''
                          }`}
                        >
                          {itemThumbnails[item.id] && (
                            <img
                              className="saved-item-thumbnail"
                              src={itemThumbnails[item.id]}
                              alt=""
                            />
                          )}

                          {item.name && <strong>{item.name}</strong>}
                        </div>

                        <span>{openItemId === item.id ? '⌃' : '⌄'}</span>
                      </div>
                    </button>

                    {openItemId === item.id && (
                      <div className="saved-item-details">
                        {editingItemId !== item.id && (
                          <>
                            <p className="saved-detail-label">What is it?</p>

                            {item.name && (
                              <p className="saved-item-name">{item.name}</p>
                            )}

                            {openItemPhotos
                              .filter((photo) => photo.src)
                              .map((photo, index) => (
                                <img
                                  key={photo.id}
                                  className="saved-item-photo"
                                  src={photo.src ?? undefined}
                                  alt={`Saved item ${index + 1}`}
                                />
                              ))}
                          </>
                        )}
                        {editingItemId === item.id && (
                          <div
                            id={`edit-form-${item.id}`}
                            className="edit-form"
                          >
                            <label>
                              What is it?
                              <input
                                type="text"
                                value={editName}
                                onChange={(event) =>
                                  setEditName(event.target.value)
                                }
                              />
                            </label>

                            <PhotoSection
                              onBusyChange={onPhotoBusyChange}
                              label="item"
                              editing
                              photos={[...openItemPhotos, ...editItemPhotos]}
                              onAdd={(photos) =>
                                setEditItemPhotos((previous) => [
                                  ...previous,
                                  ...photos,
                                ])
                              }
                              onRemove={(photo) => {
                                if (
                                  editItemPhotos.some(
                                    (added) => added.id === photo.id,
                                  )
                                )
                                  setEditItemPhotos((previous) =>
                                    previous.filter(
                                      (added) => added.id !== photo.id,
                                    ),
                                  )
                                else
                                  return removeSavedPhoto(item, 'item', photo)
                              }}
                              scrollTargetId="save-edit-button"
                              disabled={saving}
                            />

                            {item.lentTo ? (
                              <>
                                <label>
                                  Who did you lend it to?
                                  <input
                                    type="text"
                                    value={editLentTo}
                                    onChange={(event) =>
                                      setEditLentTo(event.target.value)
                                    }
                                    required
                                  />
                                </label>

                                <PhotoSection
                                  onBusyChange={onPhotoBusyChange}
                                  label="person"
                                  editing
                                  photos={[
                                    ...openLentToPhotos,
                                    ...editLentToPhotos,
                                  ]}
                                  onAdd={(photos) =>
                                    setEditLentToPhotos((previous) => [
                                      ...previous,
                                      ...photos,
                                    ])
                                  }
                                  onRemove={(photo) => {
                                    if (
                                      editLentToPhotos.some(
                                        (added) => added.id === photo.id,
                                      )
                                    )
                                      setEditLentToPhotos((previous) =>
                                        previous.filter(
                                          (added) => added.id !== photo.id,
                                        ),
                                      )
                                    else
                                      return removeSavedPhoto(
                                        item,
                                        'lentTo',
                                        photo,
                                      )
                                  }}
                                  scrollTargetId="save-edit-button"
                                  disabled={saving}
                                />
                              </>
                            ) : (
                              <>
                                <label>
                                  Where did you put it?
                                  <input
                                    type="text"
                                    value={editLocation}
                                    onChange={(event) =>
                                      setEditLocation(event.target.value)
                                    }
                                  />
                                </label>

                                <PhotoSection
                                  onBusyChange={onPhotoBusyChange}
                                  label="location"
                                  editing
                                  photos={[
                                    ...openLocationPhotos,
                                    ...editLocationPhotos,
                                  ]}
                                  onAdd={(photos) =>
                                    setEditLocationPhotos((previous) => [
                                      ...previous,
                                      ...photos,
                                    ])
                                  }
                                  onRemove={(photo) => {
                                    if (
                                      editLocationPhotos.some(
                                        (added) => added.id === photo.id,
                                      )
                                    )
                                      setEditLocationPhotos((previous) =>
                                        previous.filter(
                                          (added) => added.id !== photo.id,
                                        ),
                                      )
                                    else
                                      return removeSavedPhoto(
                                        item,
                                        'location',
                                        photo,
                                      )
                                  }}
                                  scrollTargetId="save-edit-button"
                                  disabled={saving}
                                />
                              </>
                            )}

                            <div className="edit-actions">
                              <button
                                id="save-edit-button"
                                className="save-edit-button"
                                disabled={saving || pendingPhotoOperations > 0}
                                onClick={saveEditedItem}
                              >
                                Save changes
                              </button>

                              <button
                                className="cancel-edit-button"
                                disabled={saving || pendingPhotoOperations > 0}
                                onClick={resetEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {editingItemId !== item.id && (
                          <>
                            {item.lentTo ? (
                              <>
                                <p className="saved-detail-label">Lent to</p>

                                <p className="saved-item-location">
                                  {item.lentTo}
                                </p>

                                {openLentToPhotos
                                  .filter((photo) => photo.src)
                                  .map((photo, index) => (
                                    <img
                                      key={photo.id}
                                      className="saved-item-photo"
                                      src={photo.src ?? undefined}
                                      alt={`Person lent to ${index + 1}`}
                                    />
                                  ))}
                              </>
                            ) : (
                              <>
                                <p className="saved-detail-label">
                                  Where is it?
                                </p>

                                {item.location && (
                                  <p className="saved-item-location">
                                    {item.location}
                                  </p>
                                )}

                                {openLocationPhotos
                                  .filter((photo) => photo.src)
                                  .map((photo, index) => (
                                    <img
                                      key={photo.id}
                                      className="saved-item-photo"
                                      src={photo.src ?? undefined}
                                      alt={`Saved location ${index + 1}`}
                                    />
                                  ))}
                              </>
                            )}
                          </>
                        )}

                        {editingItemId !== item.id && (
                          <div className="item-actions">
                            <button
                              className="edit-button"
                              disabled={loadingPhotos}
                              onClick={() => {
                                setEditingItemId(item.id)
                                setEditName(item.name)
                                setEditLocation(item.location)
                                setEditLentTo(item.lentTo ?? '')
                                setEditItemPhotos([])
                                setEditLocationPhotos([])
                                setEditLentToPhotos([])

                                setTimeout(() => {
                                  document
                                    .getElementById(`edit-form-${item.id}`)
                                    ?.scrollIntoView({
                                      behavior: 'smooth',
                                      block: 'start',
                                    })
                                }, 150)
                              }}
                            >
                              Edit
                            </button>

                            <button
                              className="delete-button"
                              onClick={() => deleteItem(item)}
                            >
                              Delete
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          className="collapse-item-button"
                          disabled={saving || pendingPhotoOperations > 0}
                          onClick={closeItem}
                          aria-label="Close item"
                        >
                          <span>⌃</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="more-options">
        <button
          type="button"
          className="more-button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
        >
          {showMoreOptions ? 'Less…' : 'More…'}
        </button>

        {showMoreOptions && (
          <div className="data-buttons">
            <button
              type="button"
              className="backup-button"
              disabled={saving || pendingPhotoOperations > 0}
              onClick={backupData}
            >
              <svg
                className="backup-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span>
                Backup
                <br />
                your data
              </span>
            </button>

            <label className="restore-button">
              <span className="restore-arrow">↑</span>

              <span className="restore-text">
                Restore
                <br />
                your data
              </span>

              <input
                type="file"
                accept=".json,application/json"
                disabled={saving || pendingPhotoOperations > 0}
                onChange={restoreData}
              />
            </label>
          </div>
        )}
      </div>
    </main>
  )
}

export default App
