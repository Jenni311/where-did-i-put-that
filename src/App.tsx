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
    }
  
    reader.readAsDataURL(file)
  }
  async function deleteItem(item: StoredItem) {
    const confirmed = window.confirm(
      `Delete ${item.name || 'this item'}?`
    )
  
    if (!confirmed) {
      return
    }
  
    const updatedItems = items.filter(
      (savedItem) => savedItem.id !== item.id
    )
  
    setItems(updatedItems)
  
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
      Less searching
      <br />
      More living ♡
    </p>
  </div>

  <img
    className="hero-image"
    src={heroItems}
    alt=""
  />
</div>

<h2>Find something...</h2>

      <input
        type="text"
        placeholder="Search for an item..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

{search && (

<div className="search-results">

  {searchResults.length > 0 ? (

    searchResults.map((item) => (

      <div className="search-result" key={item.id}>

        <strong>{item.name}</strong>

        <p>{item.location}</p>

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
  {showRememberForm ? 'Hide' : '+ Add a new item'}
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

  <label className="photo-button">

    Add photo

    <input

      className="photo-input"

      type="file"

      accept="image/*"

      onChange={(event) => handlePhotoChange(event, setItemPhoto)}

    />

  </label>

  {itemPhoto && (

    <img

      className="photo-preview"

      src={itemPhoto}

      alt="Item preview"

    />

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

  <label className="photo-button">

    Add photo

    <input

      className="photo-input"

      type="file"

      accept="image/*"

      onChange={(event) => handlePhotoChange(event, setLocationPhoto)}

    />

  </label>

  {locationPhoto && (

    <img

      className="photo-preview"

      src={locationPhoto}

      alt="Location preview"

    />

  )}

</div>

<button onClick={saveItem}>Save item</button>
        </div>
      )}

<button
  className="view-all-button"
  onClick={() => {
    const opening = !showAll

    setShowAll(opening)

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

          {items.length === 0 ? (
            <p>No items saved yet.</p>
          ) : (
<div className="saved-items-list">
{[...items]
  .sort((a, b) =>
    a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' })
  )
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

requestAnimationFrame(() => {
  document
    .getElementById(`saved-item-${item.id}`)
    ?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
})

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
                    {editingItemId !== item.id && openItemPhoto && (
  <img
    className="saved-item-photo"
    src={openItemPhoto}
    alt="Saved item"
  />
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
      <label className="photo-button">
        {item.itemPhotoKey ? 'Edit photo' : 'Add photo'}
        <input
          className="photo-input"
          type="file"
          accept="image/*"
          onChange={(event) =>
            handlePhotoChange(event, setEditItemPhoto)
          }
        />
      </label>

      {item.itemPhotoKey && (
        <button
          className="delete-photo-button"
          onClick={async () => {
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
      <label className="photo-button">
        {item.locationPhotoKey ? 'Edit photo' : 'Add photo'}
        <input
          className="photo-input"
          type="file"
          accept="image/*"
          onChange={(event) =>
            handlePhotoChange(event, setEditLocationPhoto)
          }
        />
      </label>

      {item.locationPhotoKey && (
        <button
          className="delete-photo-button"
          onClick={async () => {
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

    requestAnimationFrame(() => {
      document
        .getElementById(`saved-item-${item.id}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    })
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
