// ============================================================================
// ETAProvider Adapter — wraps the existing Docsahab navigationProvider
// ============================================================================
// Reuses the SAME haversine navigation logic every other ETA in the app uses
// (navigation.provider.ts) rather than a second, competing distance/ETA
// implementation. Only the unit conversion (minutes→seconds) is new.
// ============================================================================

import { navigationProvider } from "../providers/navigation.provider";
import { ETAProvider, ETAResult, Coordinates } from "hospital-decision-engine";

export class DocsahabETAProvider implements ETAProvider {
  async calculateETA(origin: Coordinates, destination: Coordinates): Promise<ETAResult> {
    const estimate = navigationProvider.estimate(origin, destination);
    return {
      distanceKm: estimate.distanceKm,
      etaSeconds: estimate.etaMinutes * 60,
      timestamp: new Date(),
      provider: estimate.provider,
      metadata: { simulated: estimate.simulated },
    };
  }
}

export const etaProvider = new DocsahabETAProvider();
