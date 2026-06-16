import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix leaflet icon missing issue in webpack/vite environments
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
})

export function LocationMap({ location }: { location: string }) {
  const [coords, setCoords] = useState<[number, number] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!location) return

    let isMounted = true
    setLoading(true)
    setError(false)
    setCoords(null)

    // Using OpenStreetMap Nominatim API
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return
        if (data && data.length > 0) {
          setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        } else {
          setError(true)
        }
      })
      .catch(() => {
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [location])

  if (loading) {
    return <div className="h-[220px] w-full bg-muted/20 animate-pulse rounded-lg border flex items-center justify-center text-xs text-muted-foreground">Loading map...</div>
  }

  if (error || !coords) {
    return (
      <div className="h-[220px] w-full bg-muted/10 rounded-lg border border-dashed flex items-center justify-center flex-col gap-2 p-4 text-center">
        <span className="text-sm font-medium text-muted-foreground">Map unavailable</span>
        <span className="text-xs text-muted-foreground/70 max-w-[80%]">Could not map "{location}". If this is a room name or invalid address, this is expected.</span>
      </div>
    )
  }

  return (
    <div className="h-[220px] w-full rounded-lg border overflow-hidden relative z-0">
      <MapContainer center={coords} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={coords}>
          <Popup>{location}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
