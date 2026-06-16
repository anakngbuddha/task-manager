import { useEffect, useState, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import { Search, MapPin, Locate, Loader2 } from 'lucide-react'
import {
  type NominatimResult,
  distanceKm,
  formatDistanceKm,
  reverseNominatim,
  searchNominatim,
} from '@/lib/nominatim'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

// ── Helper: fly map to new coords ──
function FlyToHandler({ coords, zoom }: { coords: [number, number] | null; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, zoom ?? 16, { duration: 1.2 })
    }
  }, [coords, zoom, map])
  return null
}

// ── Helper: handle map clicks ──
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng) } })
  return null
}

// ── Helper: bias search toward visible map area when user pans/zooms ──
function MapViewBiasUpdater({ onBiasChange }: { onBiasChange: (center: [number, number]) => void }) {
  const map = useMap()
  useMapEvents({
    moveend() {
      const c = map.getCenter()
      onBiasChange([c.lat, c.lng])
    },
  })
  return null
}

export function MapModal({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (location: string) => void
}) {
  const [coords, setCoords] = useState<[number, number] | null>(null)
  const [initialCenter, setInitialCenter] = useState<[number, number]>([14.5995, 120.9842])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [geolocating, setGeolocating] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** Center used to rank search results (GPS, map viewport, or pin). */
  const searchBiasRef = useRef<[number, number] | null>(null)

  const setSearchBias = useCallback((center: [number, number]) => {
    searchBiasRef.current = center
  }, [])

  // ── Get user's current location on open ──
  useEffect(() => {
    if (!open) return
    setCoords(null)
    setSearchQuery('')
    setSelectedAddress('')
    setSuggestions([])
    setShowSuggestions(false)
    setLoading(false)
    searchBiasRef.current = null

    if ('geolocation' in navigator) {
      setGeolocating(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          setInitialCenter(userCoords)
          setCoords(userCoords)
          setSearchBias(userCoords)
          setGeolocating(false)
          reverseNominatim(pos.coords.latitude, pos.coords.longitude)
            .then((name) => {
              if (name) setSelectedAddress(name)
            })
            .catch(() => {})
        },
        () => {
          // Permission denied or error — stay on default center
          setGeolocating(false)
          setSearchBias(initialCenter)
        },
        { enableHighAccuracy: true, timeout: 8000 },
      )
    } else {
      setSearchBias(initialCenter)
    }
  }, [open, setSearchBias])

  // ── Live search with debounce (biased toward current location / map view) ──
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const biasCenter = searchBiasRef.current ?? coords ?? initialCenter

    try {
      const results = await searchNominatim(query, {
        biasCenter,
        limit: 15,
        viewboxRadiusKm: 40,
      })
      setSuggestions(results.slice(0, 6))
      setShowSuggestions(results.length > 0)
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [coords, initialCenter])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 400)
  }

  // ── Select a suggestion ──
  const handleSelectSuggestion = (result: NominatimResult) => {
    const newCoords: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)]
    setCoords(newCoords)
    setSelectedAddress(result.display_name)
    setSearchQuery(result.display_name)
    setSuggestions([])
    setShowSuggestions(false)
  }

  // ── Click on map to drop pin ──
  const handleMapClick = (lat: number, lng: number) => {
    const pin: [number, number] = [lat, lng]
    setCoords(pin)
    setSearchBias(pin)
    setLoading(true)
    setSuggestions([])
    setShowSuggestions(false)
    reverseNominatim(lat, lng)
      .then((name) => {
        if (name) {
          setSelectedAddress(name)
          setSearchQuery(name)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // ── Re-center to my location ──
  const handleRecenter = () => {
    if (!('geolocation' in navigator)) return
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setCoords(userCoords)
        setSearchBias(userCoords)
        setGeolocating(false)
        reverseNominatim(pos.coords.latitude, pos.coords.longitude)
          .then((name) => {
            if (name) {
              setSelectedAddress(name)
              setSearchQuery(name)
            }
          })
          .catch(() => {})
      },
      () => setGeolocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const suggestionDistance = (result: NominatimResult): string | null => {
    const bias = searchBiasRef.current ?? coords ?? initialCenter
    if (!bias) return null
    const km = distanceKm(bias[0], bias[1], parseFloat(result.lat), parseFloat(result.lon))
    return formatDistanceKm(km)
  }

  const handleConfirm = () => {
    if (selectedAddress && selectedAddress !== 'Location not found.') {
      onConfirm(selectedAddress)
      onOpenChange(false)
    }
  }

  // ── Close suggestions on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden flex flex-col h-[80vh] max-h-[620px]">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Search Location</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Search Bar */}
          <div className="p-4 border-b shrink-0 bg-muted/10 relative" ref={suggestionsRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={handleInputChange}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Search for an address, company, or place..."
                  className="pl-9 bg-background"
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRecenter}
                disabled={geolocating}
                title="Use my current location"
                className="shrink-0"
              >
                {geolocating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Locate className="size-4" />
                )}
              </Button>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-4 right-4 top-[calc(100%-4px)] z-[1100] bg-background border rounded-lg shadow-lg max-h-[220px] overflow-auto">
                {suggestions.map((s) => {
                  const dist = suggestionDistance(s)
                  return (
                    <button
                      key={s.place_id}
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-2.5 border-b last:border-b-0 text-sm"
                    >
                      <MapPin className="size-4 shrink-0 mt-0.5 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground leading-snug block">{s.display_name}</span>
                        {dist && (
                          <span className="text-xs text-muted-foreground mt-0.5 block">{dist} away</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {selectedAddress && !showSuggestions && (
              <div className="mt-3 flex items-start gap-2 text-sm bg-primary/5 p-3 rounded-md border border-primary/20">
                <MapPin className="size-4 shrink-0 mt-0.5 text-primary" />
                <span className="text-foreground">{selectedAddress}</span>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="flex-1 relative z-0">
            {(loading || geolocating) && (
              <div className="absolute inset-0 bg-background/50 z-[1000] flex items-center justify-center backdrop-blur-[1px]">
                <span className="text-xs font-medium text-foreground bg-background px-3 py-1.5 rounded-full shadow-sm border flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" />
                  {geolocating ? 'Finding your location...' : 'Searching...'}
                </span>
              </div>
            )}
            <MapContainer
              center={initialCenter}
              zoom={coords ? 16 : 12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {coords && <Marker position={coords} />}
              <FlyToHandler coords={coords} />
              <MapViewBiasUpdater onBiasChange={setSearchBias} />
              <MapClickHandler onLocationSelect={handleMapClick} />
            </MapContainer>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAddress || selectedAddress === 'Location not found.'}
          >
            Confirm Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
