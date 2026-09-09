// ============================================================================
// Device location
// ============================================================================
// Captures the patient's position in the background as soon as the app opens,
// so pressing SOS never asks the user to type an address.
//
// Degrading honestly matters here: if the browser denies or fails to provide a
// fix we still keep the app usable by falling back to a known city-centre
// coordinate, but we mark it `precise: false` so the UI can say the location
// is approximate instead of pretending we have a real GPS lock.
// ============================================================================

import { useEffect, useState } from "react";

/** Connaught Place, Delhi NCR — matches the seeded ambulance fleet's area. */
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

export function useDeviceLocation(): DeviceLocation {
  const [state, setState] = useState<DeviceLocation>({
    ...FALLBACK,
    precise: false,
    status: "locating",
    reason: null,
  });

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
              ? "Location permission denied — using an approximate area"
              : "Could not get a precise fix — using an approximate area",
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
