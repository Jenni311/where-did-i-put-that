import { useEffect, useState } from 'react'
import { getFromDatabase, saveToDatabase } from './db'

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
  
      setItemThumbnails(thumbnails)
    }
  
    loadThumbnails()
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
  
    const updatedItems = items.filter((savedItem) => savedItem.id !== item.id)
  
    setItems(updatedItems)
  
    if (openItemId === item.id) {
      setOpenItemId(null)
      setOpenItemPhoto(null)
      setOpenLocationPhoto(null)
    }
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
      <h1>Where Did I Put That?</h1>
      <p>Save where you put things so you can find them later.</p>

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

  onClick={() => setShowRememberForm(!showRememberForm)}

>

  {showRememberForm ? 'Hide' : '+ Add a new item'}

</button>

{showRememberForm && (

  <div className="remember-form">

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

    📷 Add photo

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

    📷 Add photo

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

onClick={() => setShowAll(!showAll)}

>
        {showAll ? 'Hide saved items' : 'View all saved items'}
      </button>

      {showAll && (
        <div>
          <h2>All saved items</h2>

          {items.length === 0 ? (
            <p>No items saved yet.</p>
          ) : (
            <div className="saved-items-list">
              {items.map((item) => (
                <button
                  className="saved-item"
                  key={item.id}
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
                 <div className="saved-item-top">
  <div className="saved-item-title">
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
{openItemId === item.id && (
  <div className="saved-item-details">
    {openItemPhoto && (
      <img
        className="saved-item-photo"
        src={openItemPhoto}
        alt={item.name || 'Saved item'}
      />
    )}

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

    <button
      className="delete-button"
      onClick={(event) => {
        event.stopPropagation()
        deleteItem(item)
      }}
    >
      Delete
    </button>
  </div>
)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

export default App
