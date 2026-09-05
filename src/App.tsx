import { useEffect, useState } from 'react'

type StoredItem = {
  id: number
  name: string
  location: string
}

function App() {
  const [itemName, setItemName] = useState('')
  const [location, setLocation] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showRememberForm, setShowRememberForm] = useState(false)
  const [openItemId, setOpenItemId] = useState<number | null>(null)

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

  function saveItem() {
    if (!itemName.trim() || !location.trim()) {
      return
    }

    const newItem: StoredItem = {
      id: Date.now(),
      name: itemName,
      location: location,
    }

    setItems([...items, newItem])
    setItemName('')
    setLocation('')
    setShowRememberForm(false)
  }

  const searchResults = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <main>
      <h1>Where Did I Put That?</h1>
      <p>Save where you put things so you can find them later.</p>

      <h2>Find something</h2>

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

          <label>
            Where did you put it?
            <input
              type="text"
              placeholder="e.g. Blue box in bedroom wardrobe"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>

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
                  onClick={() =>
                    setOpenItemId(openItemId === item.id ? null : item.id)
                  }
                >
                  <div className="saved-item-top">
                    <strong>{item.name}</strong>
                    <span>{openItemId === item.id ? '⌃' : '⌄'}</span>
                  </div>

                  {openItemId === item.id && (
                    <p className="saved-item-location">{item.location}</p>
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
