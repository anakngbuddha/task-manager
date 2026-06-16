export interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  address?: Record<string, string>
}

/** Great-circle distance in kilometers. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Nominatim viewbox: left, top, right, bottom (min lon, max lat, max lon, min lat). */
export function buildNominatimViewbox(lat: number, lon: number, radiusKm = 30): string {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const minLon = lon - dLon
  const maxLon = lon + dLon
  const minLat = lat - dLat
  const maxLat = lat + dLat
  return `${minLon},${maxLat},${maxLon},${minLat}`
}

export function sortNominatimByDistance(
  results: NominatimResult[],
  center: [number, number],
): NominatimResult[] {
  const [lat, lon] = center
  return [...results].sort((a, b) => {
    const da = distanceKm(lat, lon, parseFloat(a.lat), parseFloat(a.lon))
    const db = distanceKm(lat, lon, parseFloat(b.lat), parseFloat(b.lon))
    return da - db
  })
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

const NOMINATIM_HEADERS = { 'Accept-Language': 'en-US,en;q=0.9' }

/**
 * Search places with optional bias toward a center point (Google Maps–style ranking).
 * Uses Nominatim viewbox for server-side boost and re-sorts by distance client-side.
 */
export async function searchNominatim(
  query: string,
  options?: {
    biasCenter?: [number, number]
    limit?: number
    viewboxRadiusKm?: number
  },
): Promise<NominatimResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const fetchLimit = Math.min(options?.limit ?? 15, 50)
  const params = new URLSearchParams({
    format: 'json',
    q: trimmed,
    limit: String(fetchLimit),
    addressdetails: '1',
  })

  if (options?.biasCenter) {
    const [lat, lon] = options.biasCenter
    params.set('viewbox', buildNominatimViewbox(lat, lon, options.viewboxRadiusKm ?? 30))
    params.set('bounded', '0')
  }

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: NOMINATIM_HEADERS,
  })
  const data = (await res.json()) as NominatimResult[]
  if (!data?.length) return []

  if (options?.biasCenter) {
    return sortNominatimByDistance(data, options.biasCenter)
  }
  return data
}

export async function reverseNominatim(lat: number, lon: number): Promise<string | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
    { headers: NOMINATIM_HEADERS },
  )
  const data = await res.json()
  return data?.display_name ?? null
}
