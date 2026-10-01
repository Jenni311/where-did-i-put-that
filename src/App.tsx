import { useCallback, useEffect, useRef, useState } from 'react'
import { PhotoSection } from './PhotoSection'
import { photoKeys } from './photos'
import { Repository, readLocalItems, itemTime, importItem, errorMessage } from './repository'
import type { StoredItem } from './repository'
import type { Photo } from './photos'
import { deleteFromDatabase, getFromDatabase, updateDatabase } from './db'
import blackCatHero2 from './assets/black-cat-hero-2.png'
function App({ repository, accountControls }: { repository: Repository; accountControls: (busy: boolean) => React.ReactNode }) {
  const storePhotos = (photos: Photo[]) => repository.stage(photos)
  const loadPhotos = (keys: string[]) => Promise.all(keys.map(async id => ({ id, src: await repository.readPhoto(id) })))
  const [ready, setReady] = useState(!repository.userId)
  const [accountError, setAccountError] = useState('')
  const [cleanupPending, setCleanupPending] = useState(false)
  const newItemId = useRef<string | number | null>(null)
  const newLentId = useRef<string | number | null>(null)
  async function cleanFiles() { setCleanupPending(!(await repository.cleanup())) }

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
  const [openItemId, setOpenItemId] = useState<number | string | null>(null)
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
  const [itemThumbnails, setItemThumbnails] = useState<Record<string, string>>(
    {},
  )
  const [editingItemId, setEditingItemId] = useState<number | string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editItemPhotos, setEditItemPhotos] = useState<Photo[]>([])
  const [editLocationPhotos, setEditLocationPhotos] = useState<Photo[]>([])
  const [editLentToPhotos, setEditLentToPhotos] = useState<Photo[]>([])
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [sortMode, setSortMode] = useState<
    'alphabetical' | 'newest' | 'oldest'
  >('alphabetical')
  const [saveMessage, setSaveMessage] = useState('')
  const [restoreMessage, setRestoreMessage] = useState('')
  const [isRememberFormClosing, setIsRememberFormClosing] = useState(false)

  const [itemCategory, setItemCategory] = useState<
    'all' | 'put-away' | 'lent-out'
  >('all')

  const [items, setItems] = useState<StoredItem[]>(() => repository.userId ? [] : readLocalItems())

  useEffect(() => {
    if (!repository.userId) localStorage.setItem('storedItems', JSON.stringify(items))
  }, [items, repository])

  useEffect(() => {
    let cancelled = false
    repository.activate()
    if (repository.userId) {
      repository.load().then(data => {
        if (!cancelled) { setItems(data); setReady(true); void repository.cleanup().then(ok => { if (!cancelled) setCleanupPending(!ok) }) }
      }).catch(error => { if (!cancelled) setAccountError(errorMessage(error)) })
    }
    return () => { cancelled = true; repository.dispose() }
  }, [repository])

  async function refreshAccount() {
    if (savingRef.current || photoBusyRef.current) return
    if ((editingItemId !== null || showRememberForm || showLendingForm) &&
        !window.confirm('Refresh account items? Open forms and unsaved drafts will be closed.')) return
    setAccountError('')
    setSaving(true)
    savingRef.current = true
    try {
      const fresh = await repository.load()
      setItems(fresh)
      setReady(true)
      openRequest.current++
      setOpenItemId(null)
      resetEdit()
      setShowRememberForm(false)
      setShowLendingForm(false)
      setItemName(''); setLocation(''); setItemPhotos([]); setLocationPhotos([])
      setLentItemName(''); setLentTo(''); setLentItemPhotos([]); setLentToPhotos([])
      newItemId.current = null; newLentId.current = null
      await cleanFiles()
    } catch (error) { setAccountError(errorMessage(error)) }
    finally { savingRef.current = false; setSaving(false) }
  }

  async function copyLocalItems() {
    if (savingRef.current || photoBusyRef.current) return
    if (!window.confirm('Copy this browser’s saved items and photos into this account? The local originals will be kept. Identical previously copied items will be skipped.')) return
    savingRef.current = true; setSaving(true); setAccountError(''); setCopyMessage('Copying local items…')
    try {
      const localItems = readLocalItems()
      let copied = 0
      for (const item of localItems)
        if (await importItem(repository, item, key => getFromDatabase<string>(key))) copied++
      setItems(await repository.load())
      setCopyMessage(localItems.length === 0
        ? 'No saved items were found in this browser. Items in the StackBlitz preview or another device stay there until you copy or restore them.'
        : `${copied} item${copied === 1 ? '' : 's'} copied. ${localItems.length - copied} already in your account. Select View all saved items to see them.`)
    } catch (error) { setCopyMessage(''); setAccountError(errorMessage(error) + ' You can retry; completed copies will be skipped.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  useEffect(() => {
    let cancelled = false

    async function loadThumbnails() {
      const thumbnails: Record<string, string> = {}

      for (const item of items) {
        const primaryKey = photoKeys(item, 'item')[0]
        if (primaryKey) {
          const photo = await repository.readPhoto(primaryKey)

          if (photo) {
            thumbnails[item.id] = photo
          }
        }
      }

      if (!cancelled) {
        setItemThumbnails(thumbnails)
      }
    }

    loadThumbnails().catch(() => { /* Individual photo loads show actionable errors when opened. */ })

    return () => {
      cancelled = true
    }
  }, [items, repository])

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
    if (savingRef.current) return
    savingRef.current = true; setSaving(true)
    try {
      const remaining = photoKeys(item, kind).filter(key => key !== photo.id)
      const updated = await repository.save({ ...item, [`${kind}PhotoKeys`]: remaining, [`${kind}PhotoKey`]: remaining[0] })
      if (!repository.userId) await deleteFromDatabase(photo.id)
      setItems(previous => previous.map(saved => saved.id === item.id ? updated : saved))
      await cleanFiles()
      const setPhotos =
        kind === 'item'
          ? setOpenItemPhotos
          : kind === 'location'
            ? setOpenLocationPhotos
            : setOpenLentToPhotos
      setPhotos((previous) => previous.filter((saved) => saved.id !== photo.id))
    } catch (error) {
      window.alert(errorMessage(error))
    } finally { savingRef.current = false; setSaving(false) }
  }

  async function deleteItem(item: StoredItem) {
    if (
      !window.confirm(
        `Are you sure you want to delete ${item.name || 'this item'}? This will also delete its saved photos.`,
      )
    )
      return
    if (savingRef.current || photoBusyRef.current) return
    savingRef.current = true; setSaving(true)
    try {
      await repository.remove(item)
      setItems(previous => previous.filter(saved => saved.id !== item.id))
      if (openItemId === item.id) { openRequest.current++; setOpenItemId(null); resetEdit() }
      await cleanFiles()
    } catch (error) { window.alert(errorMessage(error)) }
    finally { savingRef.current = false; setSaving(false) }
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
      const previews = await Promise.all([
        loadPhotos(itemPhotoKeys), loadPhotos(locationPhotoKeys), loadPhotos(lentToPhotoKeys),
      ])
      const updated = await repository.save({
        ...itemToEdit, name: editName,
        location: itemToEdit.lentTo ? itemToEdit.location : editLocation,
        ...(itemToEdit.lentTo ? { lentTo: editLentTo.trim() } : {}),
        itemPhotoKey: itemPhotoKeys[0], itemPhotoKeys,
        locationPhotoKey: locationPhotoKeys[0], locationPhotoKeys,
        lentToPhotoKey: lentToPhotoKeys[0], lentToPhotoKeys,
      })
      setItems(previous => previous.map(item => item.id === updated.id ? updated : item))
      setOpenItemPhotos(previews[0])
      setOpenLocationPhotos(previews[1])
      setOpenLentToPhotos(previews[2])
      resetEdit()
    } catch (error) {
      window.alert(errorMessage(error) + ' Your draft is still here.')
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
        id: newItemId.current ??= repository.newId(),
        name: itemName,
        location,
        itemPhotoKey: itemPhotoKeys[0],
        itemPhotoKeys,
        locationPhotoKey: locationPhotoKeys[0],
        locationPhotoKeys,
      }
      const committed = await repository.save(newItem)
      setItems((previous) => [...previous.filter(i => i.id !== committed.id), committed])
      newItemId.current = null
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
    } catch (error) {
      window.alert(errorMessage(error) + ' Your draft is still here.')
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
      const id = newLentId.current ??= repository.newId()
      const itemPhotoKeys = await storePhotos(lentItemPhotos)
      const lentToPhotoKeys = await storePhotos(lentToPhotos)
      const committed = await repository.save({
          id,
          name,
          location: '',
          lentTo: person,
          itemPhotoKey: itemPhotoKeys[0],
          itemPhotoKeys,
          lentToPhotoKey: lentToPhotoKeys[0],
          lentToPhotoKeys,
      })
      setItems(previous => [...previous.filter(i => i.id !== committed.id), committed])
      newLentId.current = null
      setLentItemName('')
      setLentTo('')
      setLentItemPhotos([])
      setLentToPhotos([])
      setSaveMessage('Lent item saved ✓')
      setTimeout(() => setSaveMessage(''), 3000)
      setShowLendingForm(false)
    } catch (error) {
      window.alert(errorMessage(error) + ' Your draft is still here.')
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
          const photo = await repository.readPhoto(key)
          if (photo === null) throw new Error('A photo is unavailable.')
          photos[key] = photo
        }
      }
      repository.check()
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
          !((typeof entry.id === 'number' && Number.isFinite(entry.id)) || (typeof entry.id === 'string' && entry.id.length > 0)) ||
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
          repository.userId ? 'Copy this backup into your account? Existing account items will be kept, and identical copies will be skipped.' : 'Restore this backup? Existing items will be kept, and matching items will be updated.',
        )
      )
        return
      if (repository.userId) {
        const available = new Map(writes.map(p => [p.key, p.value]))
        for (const item of restoredItems)
          await importItem(repository, item, async key => available.get(key) ?? null)
        setItems(await repository.load())
        setRestoreMessage('Backup copied to account ✓')
        return
      }
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
    } catch (error) {
      window.alert(errorMessage(error) + (repository.userId ? ' Completed copies were kept. You can retry safely.' : ' Please check the backup file.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const accountPanel = (
      <section className="account-panel" aria-label="Account">
        {accountControls(saving || pendingPhotoOperations > 0)}
        {repository.userId ? <>
          <p>Items in your account. Refresh to see changes from your other devices.</p>
          <div className="account-actions">
            <button disabled={saving || pendingPhotoOperations > 0} onClick={refreshAccount}>Refresh items</button>
            <button disabled={!ready || saving || pendingPhotoOperations > 0} onClick={copyLocalItems}>{saving ? 'Please wait…' : 'Copy local items'}</button>
          </div>
          {copyMessage && <p role="status">{copyMessage}</p>}
          {cleanupPending && <p role="status">Item changes are saved. Some deleted photo files still need cleanup; use Refresh when online.</p>}
        </> : <p>Items are saved only in this browser. Sign in to save new items to your account.</p>}
        {accountError && <p role="alert">{accountError}</p>}
        {!ready && !accountError && <p role="status">Loading your account items…</p>}
      </section>
  )
  return (
    <main>
      {!repository.userId && accountPanel}
      {repository.userId && accountError && <p role="alert">{accountError} Open More… to retry refreshing your account.</p>}
      {repository.userId && !ready && !accountError && <p role="status">Loading your account items…</p>}
      <fieldset className="app-content" disabled={!ready || saving}>

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
                    return itemTime(b) - itemTime(a)
                  }

                  if (sortMode === 'oldest') {
                    return itemTime(a) - itemTime(b)
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

      </fieldset>
      <div className="more-options">
        <button
          type="button"
          className="more-button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
        >
          {showMoreOptions ? 'Less…' : 'More…'}
        </button>

        {showMoreOptions && (
          <>
          {repository.userId && accountPanel}
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
          </>
        )}
      </div>
    </main>
  )
}

export default App
