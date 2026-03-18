import type { LeboncoinSearchParams, LeboncoinAd, MarketValuation } from "./types";
import { searchLeboncoin, searchLeboncoinViaPython } from "./client";

/**
 * Search Leboncoin and compute market valuation stats.
 * Returns median, min, max, avg prices + top 10 cheapest ads.
 *
 * Tries native fetch first. Falls back to Python lbc lib (curl_cffi)
 * if Datadome blocks the request (403).
 */
export async function getMarketValuation(
  params: LeboncoinSearchParams,
): Promise<MarketValuation> {
  let ads: LeboncoinAd[];

  try {
    ads = await searchLeboncoin(params);
    // If native fetch returned 0 ads, try Python (Datadome may return 200 with empty body)
    if (ads.length === 0) {
      ads = searchLeboncoinViaPython(params);
    }
  } catch {
    // Any error (403, timeout, network) → fallback to Python lbc lib
    ads = searchLeboncoinViaPython(params);
  }

  // Filter out zero/null prices and sort by price asc
  const validAds = ads
    .filter((ad) => ad.price > 0)
    .sort((a, b) => a.price - b.price);

  if (validAds.length === 0) {
    return {
      medianPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      totalAds: 0,
      ads: [],
      searchParams: params,
      fetchedAt: new Date().toISOString(),
    };
  }

  const prices = validAds.map((ad) => ad.price);
  const minPrice = prices[0]!;
  const maxPrice = prices[prices.length - 1]!;
  const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);

  // Median
  const mid = Math.floor(prices.length / 2);
  const medianPrice =
    prices.length % 2 === 0
      ? Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      : prices[mid]!;

  return {
    medianPrice,
    minPrice,
    maxPrice,
    avgPrice,
    totalAds: validAds.length,
    ads: validAds.slice(0, 10),
    searchParams: params,
    fetchedAt: new Date().toISOString(),
  };
}
