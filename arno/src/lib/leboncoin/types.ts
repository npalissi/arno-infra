export type LeboncoinSearchParams = {
  brand: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  fuel?: string; // '1'=essence, '2'=diesel, '3'=GPL, '4'=electrique, '5'=hybride
  gearbox?: string; // '1'=manuelle, '2'=automatique
  priceMin?: number;
  priceMax?: number;
};

export type LeboncoinAd = {
  id: number;
  title: string;
  price: number; // euros
  url: string;
  mileage?: number;
  year?: number;
  fuel?: string;
  location?: string;
  image?: string;
};

export type MarketValuation = {
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  p25: number;
  p75: number;
  totalAds: number;
  totalBeforeFilter: number;
  totalExcluded: number;
  ads: LeboncoinAd[]; // all filtered ads, sorted by price asc
  searchParams: LeboncoinSearchParams;
  fetchedAt: string; // ISO date
};
