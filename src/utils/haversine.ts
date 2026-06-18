// ============================================================================
// Haversine Distance
// ============================================================================
// Great-circle distance between two lat/long points, in kilometres.
// Ported to TypeScript from the Person 2 prototype (the one genuinely reusable
// asset). Pure and side-effect free — safe to unit test in isolation.
// ============================================================================

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Returns the great-circle distance in kilometres between two coordinates.
 *
 * @throws never — callers must pre-validate coordinates; NaN inputs yield NaN.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}
