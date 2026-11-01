// Decode the server's encoded polyline (Google algorithm, precision 5; architecture 4.1).

/** Returns [lon, lat] pairs, the order GeoJSON and MapLibre use. */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lon = 0

  const nextDelta = (): number => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    lat += nextDelta()
    lon += nextDelta()
    coords.push([lon / factor, lat / factor])
  }
  return coords
}
