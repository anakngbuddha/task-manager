import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { Input } from '@/components/ui/input'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
})

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function LocationPicker({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [coords, setCoords] = useState<[number, number] | null>(null)
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const searchLocation = (query: string) => {
    if (!query.trim()) {
      setCoords(null)
      return
    }
    setLoading(true)
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    onChange(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchLocation(val)
    }, 1000)
  }

  const handleMapClick = (lat: number, lng: number) => {
    setCoords([lat, lng])
    setLoading(true)
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.display_name) {
          const name = data.display_name
          setInputValue(name)
          onChange(name)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-2">
      <Input 
        value={inputValue} 
        onChange={handleInputChange} 
        placeholder="Type address or click on map to pin..." 
        className="rounded-md" 
      />
      <div className="h-[200px] w-full rounded-lg border overflow-hidden relative z-0">
        {loading && (
          <div className="absolute inset-0 bg-background/50 z-[1000] flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-xs font-medium text-foreground bg-background px-2 py-1 rounded shadow-sm">Loading map...</span>
          </div>
        )}
        <MapContainer 
          center={coords || [14.5995, 120.9842]} // Default center (e.g. Manila since user typed Cavite)
          zoom={coords ? 15 : 8} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {coords && <Marker position={coords} />}
          <MapClickHandler onLocationSelect={handleMapClick} />
        </MapContainer>
      </div>
    </div>
  )
}
