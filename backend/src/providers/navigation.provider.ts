// ============================================================================
// Navigation Provider
// ============================================================================
// Abstraction over "how far apart are two points, and how long will it take".
//
// TODAY   : SimulationNavigationProvider — straight-line haversine distance
//           converted to an ETA using a configurable average speed.
// LATER   : swap in a real routing provider (Google Directions, Mapbox, OSRM)
//           by implementing the same interface and changing ONE line in
//           `navigationProvider` below. No caller changes.
//
// The frontends never compute distance or ETA themselves — they render what
// this provider produced. That is why the numbers on the patient screen and
// the ambulance screen always agree.
// ============================================================================

import { haversineDistanceKm } from "../utils/haversine";
import { navigationConfig } from "../config/navigation.config";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RouteEstimate {
  distanceKm: number;
  etaMinutes: number;
  /** Which implementation produced this, so responses are self-describing. */
  provider: string;
  /** True when the numbers are simulated rather than road-network derived. */
  simulated: boolean;
}

export interface NavigationProvider {
  readonly name: string;
  estimate(origin: GeoPoint, destination: GeoPoint): RouteEstimate;
}

/**
 * Straight-line simulation. Honest about what it is: `simulated: true` travels
 * with every estimate so the UI can label it rather than implying real routing.
 */
export class SimulationNavigationProvider implements NavigationProvider {
  readonly name = "simulation";

  estimate(origin: GeoPoint, destination: GeoPoint): RouteEstimate {
    const distanceKm = haversineDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );

    const rawMinutes = (distanceKm / navigationConfig.averageSpeedKmph) * 60;
    const etaMinutes = Math.max(
      navigationConfig.minimumEtaMinutes,
      Math.ceil(rawMinutes)
    );

    return {
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMinutes,
      provider: this.name,
      simulated: true,
    };
  }
}

/**
 * The active provider. Replace this binding to go live with real routing.
 */
export const navigationProvider: NavigationProvider =
  new SimulationNavigationProvider();
