import { useEffect, useState } from 'react'
import {
  deleteFromDatabase,
  getFromDatabase,
  saveToDatabase,
} from './db'
import heroItems from './assets/hero2.png'
type StoredItem = {
  id: number
  name: string
  location: string
  itemPhotoKey?: string
  locationPhotoKey?: string
}

function App() {
  const [itemName, setItemName] = useState('')
  const [location, setLocation] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showRememberForm, setShowRememberForm] = useState(false)
  const [openItemId, setOpenItemId] = useState<number | null>(null)
  const [openItemPhoto, setOpenItemPhoto] = useState<string | null>(null)
  const [openLocationPhoto, setOpenLocationPhoto] = useState<string | null>(null)
  const [itemPhoto, setItemPhoto] = useState<string | null>(null)
  const [locationPhoto, setLocationPhoto] = useState<string | null>(null)
  const [itemThumbnails, setItemThumbnails] = useState<Record<number, string>>({})
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editItemPhoto, setEditItemPhoto] = useState<string | null>(null)
const [editLocationPhoto, setEditLocationPhoto] = useState<string | null>(null)
const [sortMode, setSortMode] = useState<
  'alphabetical' | 'newest' | 'oldest'
>('alphabetical')


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
        if (item.itemPhotoKey) {
          const photo = await getFromDatabase<string>(item.itemPhotoKey)
  
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

  function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>,
    setPhoto: (photo: string | null) => void
  ) {
    const file = event.target.files?.[0]
  
    if (!file) {
      return
    }
  
    const reader = new FileReader()
  
    reader.onload = () => {
      setPhoto(reader.result as string)
  
      setTimeout(() => {
        document
          .getElementById('save-item-button')
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
          })
      }, 150)
    }
  
    reader.readAsDataURL(file)
  }
  async function deleteItem(item: StoredItem) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${
        item.name || 'this item'
      }? This will also delete its saved photos.`
    )
  
    if (!confirmed) {
      return
    }
  
    if (item.itemPhotoKey) {
      await deleteFromDatabase(item.itemPhotoKey)
    }
  
    if (item.locationPhotoKey) {
      await deleteFromDatabase(item.locationPhotoKey)
    }
  
    const updatedItems = items.filter(
      (savedItem) => savedItem.id !== item.id
    )
  
    setItems(updatedItems)
  
    setItemThumbnails((previous) => {
      const updated = { ...previous }
      delete updated[item.id]
      return updated
    })
  
    if (openItemId === item.id) {
      setOpenItemId(null)
      setOpenItemPhoto(null)
      setOpenLocationPhoto(null)
    }
  }
  
  async function saveEditedItem() {
    if (editingItemId === null) {
      return
    }
  
    const itemToEdit = items.find(
      (item) => item.id === editingItemId
    )
  
    if (!itemToEdit) {
      return
    }
  
    let itemPhotoKey = itemToEdit.itemPhotoKey
    let locationPhotoKey = itemToEdit.locationPhotoKey
  
    if (editItemPhoto) {
      itemPhotoKey =
        itemPhotoKey || `item-photo-${editingItemId}`
  
      await saveToDatabase(itemPhotoKey, editItemPhoto)
  
      setItemThumbnails((previous) => ({
        ...previous,
        [editingItemId]: editItemPhoto,
      }))
    }
  
    if (editLocationPhoto) {
      locationPhotoKey =
        locationPhotoKey || `location-photo-${editingItemId}`
  
      await saveToDatabase(locationPhotoKey, editLocationPhoto)
    }
  
    const updatedItems = items.map((item) =>
      item.id === editingItemId
        ? {
            ...item,
            name: editName,
            location: editLocation,
            itemPhotoKey,
            locationPhotoKey,
          }
        : item
    )
  
    setItems(updatedItems)
  
    if (editItemPhoto) {
      setOpenItemPhoto(editItemPhoto)
    }
  
    if (editLocationPhoto) {
      setOpenLocationPhoto(editLocationPhoto)
    }
  
    setEditingItemId(null)
    setEditName('')
    setEditLocation('')
    setEditItemPhoto(null)
    setEditLocationPhoto(null)
  }
  async function saveItem() {
    if ((!itemName.trim() && !itemPhoto) || (!location.trim() && !locationPhoto)) {
      return
    }

    const id = Date.now()

const itemPhotoKey = itemPhoto ? `item-photo-${id}` : undefined
const locationPhotoKey = locationPhoto ? `location-photo-${id}` : undefined

if (itemPhotoKey && itemPhoto) {
  await saveToDatabase(itemPhotoKey, itemPhoto)
}

if (itemPhoto) {
  setItemThumbnails((previous) => ({
    ...previous,
    [id]: itemPhoto,
  }))
}

if (locationPhotoKey && locationPhoto) {
  await saveToDatabase(locationPhotoKey, locationPhoto)
}

const newItem: StoredItem = {
  id,
  name: itemName,
  location: location,
  itemPhotoKey,
  locationPhotoKey,
}

    setItems([...items, newItem])
    setItemName('')
    setLocation('')
    setItemPhoto(null)
setLocationPhoto(null)
    setShowRememberForm(false)
  }

  const searchResults = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

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
    For everything you've 
      <br />
      put somewhere
    </p>
  </div>

  <img
    className="hero-image"
    src={heroItems}
    alt=""
  />
</div>

<h2>Find something...</h2>

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
      onClick={() => {
        setSearch('')
        setOpenItemId(null)
        setOpenItemPhoto(null)
        setOpenLocationPhoto(null)
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
            onClick={async () => {
              if (openItemId === item.id) {
                setOpenItemId(null)
                setOpenItemPhoto(null)
                setOpenLocationPhoto(null)
                return
              }

              setOpenItemId(item.id)

              const savedItemPhoto = item.itemPhotoKey
                ? await getFromDatabase<string>(item.itemPhotoKey)
                : null

              const savedLocationPhoto = item.locationPhotoKey
                ? await getFromDatabase<string>(item.locationPhotoKey)
                : null

              setOpenItemPhoto(savedItemPhoto)
              setOpenLocationPhoto(savedLocationPhoto)
            }}
          >
            <strong>{item.name}</strong>
          </button>

          {openItemId === item.id && (
            <div className="search-result-details">
              {openItemPhoto && (
                <img
                  className="saved-item-photo"
                  src={openItemPhoto}
                  alt="Saved item"
                />
              )}

              {item.location && (
                <p className="saved-item-location">
                  {item.location}
                </p>
              )}

              {openLocationPhoto && (
                <img
                  className="saved-item-photo"
                  src={openLocationPhoto}
                  alt="Saved location"
                />
              )}
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
  onClick={() => {
    const opening = !showRememberForm

    setShowRememberForm(opening)

    if (opening) {
      setTimeout(() => {
        document
          .getElementById('remember-form')
          ?.scrollIntoView({
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
    className="remember-form"
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

<div className="photo-option">
  <div className="photo-choice-buttons">
    <label className="photo-button">
      Add photo
      <input
        className="photo-input"
        type="file"
        accept="image/*"
        onChange={(event) =>
          handlePhotoChange(event, setLocationPhoto)
        }
      />
    </label>

    <label className="photo-button">
      Take photo
      <input
        className="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) =>
          handlePhotoChange(event, setLocationPhoto)
        }
      />
    </label>
  </div>

  {itemPhoto && (
  <div className="photo-preview-wrapper">
    <img
      className="photo-preview"
      src={itemPhoto}
      alt="Preview"
    />

    <button
      type="button"
      className="remove-preview-photo"
      onClick={() => setItemPhoto(null)}
      aria-label="Remove photo"
    >
      ×
    </button>
  </div>
)}

</div>

<label>
  Where did you put it?
  <input
    type="text"
    placeholder="e.g. Blue box in bedroom wardrobe"
    value={location}
    onChange={(event) => setLocation(event.target.value)}
  />
</label>

<div className="photo-option">
  <div className="photo-choice-buttons">
    <label className="photo-button">
      Add photo
      <input
        className="photo-input"
        type="file"
        accept="image/*"
        onChange={(event) =>
          handlePhotoChange(event, setItemPhoto)
        }
      />
    </label>

    <label className="photo-button">
      Take photo
      <input
        className="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) =>
          handlePhotoChange(event, setItemPhoto)
        }
      />
    </label>
  </div>

  {locationPhoto && (
  <div className="photo-preview-wrapper">
    <img
      className="photo-preview"
      src={locationPhoto}
      alt="Preview"
    />

    <button
      type="button"
      className="remove-preview-photo"
      onClick={() => setLocationPhoto(null)}
      aria-label="Remove photo"
    >
      ×
    </button>
  </div>
)}

</div>

<button
  id="save-item-button"
  onClick={saveItem}
>
  Save item
</button>        </div>
      )}

<button
  className="view-all-button"
  onClick={() => {
    const opening = !showAll

    setShowAll(opening)

    if (!opening) {
      setOpenItemId(null)
      setOpenItemPhoto(null)
      setOpenLocationPhoto(null)
    }

    if (opening) {
      setTimeout(() => {
        document
          .getElementById('all-saved-items')
          ?.scrollIntoView({
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

          <div className="saved-items-sort">
  <label htmlFor="sort-items">Sort by</label>

  <select
    id="sort-items"
    value={sortMode}
    onChange={(event) =>
      setSortMode(
        event.target.value as
          | 'alphabetical'
          | 'newest'
          | 'oldest'
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
          ) : (
<div className="saved-items-list">
{[...items]
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
        onClick={async () => {
          if (openItemId === item.id) {
            setOpenItemId(null)
            setOpenItemPhoto(null)
            setOpenLocationPhoto(null)
            return
          }

          setOpenItemId(item.id)


const savedItemPhoto = item.itemPhotoKey
  ? await getFromDatabase<string>(item.itemPhotoKey)
  : null

const savedLocationPhoto = item.locationPhotoKey
  ? await getFromDatabase<string>(item.locationPhotoKey)
  : null

  setOpenItemPhoto(savedItemPhoto)
  setOpenLocationPhoto(savedLocationPhoto)
  
  setTimeout(() => {
    document
      .getElementById(`saved-item-${item.id}`)
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
  }, 150)
  
  setTimeout(() => {
    document
      .getElementById(`search-result-${item.id}`)
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
  }, 100)
}}
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

    {openItemPhoto && (
      <img
        className="saved-item-photo"
        src={openItemPhoto}
        alt="Saved item"
      />
    )}
  </>
)}
         {editingItemId === item.id && (
  <div className="edit-form">
    <label>
      What is it?
      <input
        type="text"
        value={editName}
        onChange={(event) => setEditName(event.target.value)}
      />
    </label>

    {openItemPhoto && !editItemPhoto && (
      <img
        className="photo-preview"
        src={openItemPhoto}
        alt="Current item"
      />
    )}

<div className="photo-option">
<div
  id={`edit-photo-actions-${item.id}`}
  className="photo-edit-actions"
>
<div className="edit-photo-choice-buttons">
  <label className="photo-button">
    Choose photo
    <input
      className="photo-input"
      type="file"
      accept="image/*"
      onChange={(event) =>
        handlePhotoChange(event, setEditItemPhoto)
      }
    />
  </label>

  <label className="photo-button">
    Take photo
    <input
      className="photo-input"
      type="file"
      accept="image/*"
      capture="environment"
      onChange={(event) =>
        handlePhotoChange(event, setEditItemPhoto)
      }
    />
  </label>
</div>

    {item.itemPhotoKey && (
      <button
        type="button"
        className="delete-photo-button"
        onClick={async () => {
          const confirmed = window.confirm(
            'Are you sure you want to delete this photo?'
          )
        
          if (!confirmed) {
            return
          }
        
          await deleteFromDatabase(item.itemPhotoKey!)

          setItems((previous) =>
            previous.map((savedItem) =>
              savedItem.id === item.id
                ? {
                    ...savedItem,
                    itemPhotoKey: undefined,
                  }
                : savedItem
            )
          )

          setItemThumbnails((previous) => {
            const updated = { ...previous }
            delete updated[item.id]
            return updated
          })

          setOpenItemPhoto(null)
          setEditItemPhoto(null)
        }}
      >
        Delete photo
      </button>
    )}
  </div>

  {editItemPhoto && (
    <img
      className="photo-preview"
      src={editItemPhoto}
      alt="New item preview"
    />
  )}
</div>

    <label>
      Where did you put it?
      <input
        type="text"
        value={editLocation}
        onChange={(event) => setEditLocation(event.target.value)}
      />
    </label>

    {openLocationPhoto && !editLocationPhoto && (
      <img
        className="photo-preview"
        src={openLocationPhoto}
        alt="Current location"
      />
    )}

    <div className="photo-option">
    <div className="edit-photo-choice-buttons">
  <label className="photo-button">
    Choose photo
    <input
      className="photo-input"
      type="file"
      accept="image/*"
      onChange={(event) =>
        handlePhotoChange(event, setEditLocationPhoto)
      }
    />
  </label>

  <label className="photo-button">
    Take photo
    <input
      className="photo-input"
      type="file"
      accept="image/*"
      capture="environment"
      onChange={(event) =>
        handlePhotoChange(event, setEditLocationPhoto)
      }
    />
  </label>
</div>

      {item.locationPhotoKey && (
        <button
          className="delete-photo-button"
          onClick={async () => {
            const confirmed = window.confirm(
              'Are you sure you want to delete this photo?'
            )
          
            if (!confirmed) {
              return
            }
          
            await deleteFromDatabase(item.locationPhotoKey!)

            setItems((previous) =>
              previous.map((savedItem) =>
                savedItem.id === item.id
                  ? {
                      ...savedItem,
                      locationPhotoKey: undefined,
                    }
                  : savedItem
              )
            )

            setOpenLocationPhoto(null)
            setEditLocationPhoto(null)
          }}
        >
          Delete photo
        </button>
      )}

      {editLocationPhoto && (
        <img
          className="photo-preview"
          src={editLocationPhoto}
          alt="New location preview"
        />
      )}
    </div>

    <div className="edit-actions">
      <button
        className="save-edit-button"
        onClick={saveEditedItem}
      >
        Save changes
      </button>

      <button
        className="cancel-edit-button"
        onClick={() => {
          setEditingItemId(null)
          setEditName('')
          setEditLocation('')
          setEditItemPhoto(null)
          setEditLocationPhoto(null)
        }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
                    {editingItemId !== item.id && (
  <>
    <p className="saved-detail-label">Where is it?</p>

    {item.location && (
      <p className="saved-item-location">{item.location}</p>
    )}

    {openLocationPhoto && (
      <img
        className="saved-item-photo"
        src={openLocationPhoto}
        alt="Saved location"
      />
    )}
  </>
)}
          
          {editingItemId !== item.id && (
  <div className="item-actions">
   <button
  className="edit-button"
  onClick={() => {
    setEditingItemId(item.id)
    setEditName(item.name)
    setEditLocation(item.location)

    setTimeout(() => {
      document
        .getElementById(`edit-photo-actions-${item.id}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
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
  onClick={() => {
    setOpenItemId(null)
    setOpenItemPhoto(null)
    setOpenLocationPhoto(null)
  }}
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
    </main>
  )
}

export default App
