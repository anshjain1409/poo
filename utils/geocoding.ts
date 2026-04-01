export async function getReverseGeocoding(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': 'RoadFix-App'
        }
      }
    )
    const data = await response.json()
    
    const address = data.address || {}
    const locationStr = address.neighbourhood || 
                       address.residential || 
                       address.suburb || 
                       address.city || 
                       address.town || 
                       'Unknown Location'
    
    return locationStr
  } catch (err) {
    console.error('[v0] Geocoding error:', err)
    return ''
  }
}
