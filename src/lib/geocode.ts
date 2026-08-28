// Geocoder backed by Google Maps via our Supabase edge function (which uses the
// Lovable connector gateway). Browser-side Geocoding requests are blocked by
// the browser key restrictions, so all geocoding goes through the function.

import { supabase } from "@/integrations/supabase/client";

export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(address: string, eventId?: string): Promise<GeoPoint | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const { data, error } = await supabase.functions.invoke("geocode-address", {
      body: eventId ? { address: q, eventId } : { address: q },
    });
    if (error) return null;
    return (data?.point as GeoPoint | null) ?? null;
  } catch {
    return null;
  }
}

// Haversine distance in km between two lat/lng points.
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}