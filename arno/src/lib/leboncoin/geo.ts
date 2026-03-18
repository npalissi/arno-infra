import type { LeboncoinAd } from "./types";

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the distance in km between two coordinates using the Haversine formula.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Filter ads that have lat/lng within a given radius from a center point.
 * Ads without coordinates are excluded.
 */
export function filterByRadius(
  ads: LeboncoinAd[],
  centerLat: number,
  centerLng: number,
  radiusKm: number,
): LeboncoinAd[] {
  return ads.filter((ad) => {
    if (ad.lat == null || ad.lng == null) return false;
    return haversineKm(centerLat, centerLng, ad.lat, ad.lng) <= radiusKm;
  });
}
