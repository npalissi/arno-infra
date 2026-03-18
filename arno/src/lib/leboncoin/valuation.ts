import type { LeboncoinSearchParams, LeboncoinAd, MarketValuation } from "./types";
import { searchLeboncoin, searchLeboncoinViaPython } from "./client";

/**
 * Compute percentile from a sorted array of numbers.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  return Math.round(sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower));
}

/**
 * Search Leboncoin and compute market valuation stats.
 *
 * Filtering:
 * - Exclude ads below purchasePrice * 0.7 (probable wrecks)
 * - Exclude ads above P95 (overpriced or errors)
 *
 * Returns median, min, max, avg, P25, P75, and ALL filtered ads.
 *
 * Tries native fetch first. Falls back to Python lbc lib (curl_cffi)
 * if Datadome blocks the request (403).
 */
export async function getMarketValuation(
  params: LeboncoinSearchParams,
  purchasePrice?: number, // centimes — from Arno DB
): Promise<MarketValuation> {
  let ads: LeboncoinAd[];

  console.log("[LBC] Recherche:", JSON.stringify(params));

  try {
    console.log("[LBC] Essai fetch natif...");
    ads = await searchLeboncoin(params);
    console.log(`[LBC] Fetch natif OK — ${ads.length} annonces`);
    if (ads.length === 0) {
      console.log("[LBC] 0 annonces, fallback Python...");
      ads = searchLeboncoinViaPython(params);
      console.log(`[LBC] Python OK — ${ads.length} annonces`);
    }
  } catch (fetchErr) {
    console.error("[LBC] Fetch natif ERREUR:", fetchErr instanceof Error ? fetchErr.message : fetchErr);
    try {
      console.log("[LBC] Fallback Python...");
      ads = searchLeboncoinViaPython(params);
      console.log(`[LBC] Python OK — ${ads.length} annonces`);
    } catch (pyErr) {
      console.error("[LBC] Python ERREUR:", pyErr instanceof Error ? pyErr.message : pyErr);
      throw pyErr;
    }
  }

  // Filter out zero/null prices and sort by price asc
  const validAds = ads
    .filter((ad) => ad.price > 0)
    .sort((a, b) => a.price - b.price);

  const totalBeforeFilter = validAds.length;

  const emptyResult: MarketValuation = {
    medianPrice: 0,
    minPrice: 0,
    maxPrice: 0,
    avgPrice: 0,
    p25: 0,
    p75: 0,
    totalAds: 0,
    totalBeforeFilter,
    totalExcluded: 0,
    ads: [],
    searchParams: params,
    fetchedAt: new Date().toISOString(),
  };

  if (validAds.length === 0) return emptyResult;

  // Smart filtering
  const prices = validAds.map((ad) => ad.price);

  // Floor: exclude below 70% of purchase price (probable wrecks)
  const priceFloor = purchasePrice ? (purchasePrice * 0.7) / 100 : 0; // centimes→euros

  // Ceiling: P95 (exclude top 5% — overpriced or errors)
  const p95 = percentile(prices, 95);

  const filteredAds = validAds.filter(
    (ad) => ad.price >= priceFloor && ad.price <= p95,
  );

  const totalExcluded = totalBeforeFilter - filteredAds.length;

  console.log(`[LBC] Filtrage: ${totalBeforeFilter} → ${filteredAds.length} (exclu ${totalExcluded}, floor ${Math.round(priceFloor)}€, ceiling P95 ${p95}€)`);

  if (filteredAds.length === 0) return { ...emptyResult, totalExcluded };

  // Stats on filtered ads
  const filteredPrices = filteredAds.map((ad) => ad.price);
  const minPrice = filteredPrices[0]!;
  const maxPrice = filteredPrices[filteredPrices.length - 1]!;
  const avgPrice = Math.round(
    filteredPrices.reduce((sum, p) => sum + p, 0) / filteredPrices.length,
  );

  // Median
  const mid = Math.floor(filteredPrices.length / 2);
  const medianPrice =
    filteredPrices.length % 2 === 0
      ? Math.round((filteredPrices[mid - 1]! + filteredPrices[mid]!) / 2)
      : filteredPrices[mid]!;

  // IQR
  const p25 = percentile(filteredPrices, 25);
  const p75 = percentile(filteredPrices, 75);

  return {
    medianPrice,
    minPrice,
    maxPrice,
    avgPrice,
    p25,
    p75,
    totalAds: filteredAds.length,
    totalBeforeFilter,
    totalExcluded,
    ads: filteredAds, // all filtered ads, sorted by price asc
    searchParams: params,
    fetchedAt: new Date().toISOString(),
  };
}
