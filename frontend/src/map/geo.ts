// Small geometry helpers for the route layers.

type Position = [number, number]

/** Approximate length in metres of one step; flat-earth is plenty for placing a chip. */
function stepLength([lon1, lat1]: Position, [lon2, lat2]: Position): number {
  const metresPerDegree = 111_320
  const dx = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180))
  const dy = lat2 - lat1
  return Math.hypot(dx, dy) * metresPerDegree
}

/** The point halfway along a line, by length (not by vertex count). */
export function lineMidpoint(line: Position[]): Position | null {
  if (line.length === 0) return null
  const lengths = line.slice(1).map((point, i) => stepLength(line[i], point))
  const half = lengths.reduce((sum, value) => sum + value, 0) / 2
  let walked = 0
  for (let i = 0; i < lengths.length; i += 1) {
    if (walked + lengths[i] >= half) {
      const t = lengths[i] === 0 ? 0 : (half - walked) / lengths[i]
      const [lon1, lat1] = line[i]
      const [lon2, lat2] = line[i + 1]
      return [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t]
    }
    walked += lengths[i]
  }
  return line[line.length - 1]
}
