// ============================================================================
// Device location (ambulance crew)
// ============================================================================
// Dispatch cannot route to a unit it cannot place, so the backend refuses to
// bring an ambulance ONLINE at 0,0 (LOCATION_REQUIRED). A crew whose browser
// denies geolocation would otherwise be permanently stuck OFFLINE.
//
// We degrade the same way the patient app does: fall back to a known city-centre
// coordinate so the unit is still dispatchable, but mark it `precise: false` so
// the dashboard says the position is approximate rather than implying a GPS lock.
// The ONLINE flag itself stays real — a real coordinate is written and matching
// genuinely uses it.
// ============================================================================

import { useCallback, useEffect, useState } from "react";

/** Connaught Place, Delhi NCR — matches the seeded fleet's service area. */
const FALLBACK = { latitude: 28.6139, longitude: 77.209 };

export type LocationStatus = "locating" | "precise" | "approximate";

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  precise: boolean;
  status: LocationStatus;
  /** Human-readable reason the fix is approximate, when it is. */
  reason: string | null;
}

export interface DeviceLocationHandle extends DeviceLocation {
  /** Re-asks the browser for a fix, e.g. after the crew grants permission. */
  retry: () => void;
}

export function useDeviceLocation(): DeviceLocationHandle {
  const [state, setState] = useState<DeviceLocation>({
    ...FALLBACK,
    precise: false,
    status: "locating",
    reason: null,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: "locating", reason: null }));
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({
        ...FALLBACK,
        precise: false,
        status: "approximate",
        reason: "This device does not support location services",
      });
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precise: true,
          status: "precise",
          reason: null,
        });
      },
      (error) => {
        if (cancelled) return;
        setState({
          ...FALLBACK,
          precise: false,
          status: "approximate",
          reason:
            error.code === error.PERMISSION_DENIED
              ? "Location permission denied — using your service area"
              : "Could not get a precise fix — using your service area",
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry };
}
