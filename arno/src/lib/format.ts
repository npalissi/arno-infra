/**
 * Formate un prix en centimes vers euros avec séparateur milliers français.
 * formatPrice(1250000) → "12 500 €"
 */
export function formatPrice(centimes: number): string {
  const euros = centimes / 100;
  const hasCentimes = centimes % 100 !== 0;
  return (
    euros.toLocaleString("fr-FR", {
      minimumFractionDigits: hasCentimes ? 2 : 0,
      maximumFractionDigits: hasCentimes ? 2 : 0,
    }) + " €"
  );
}

/**
 * Formate une date ISO en format français.
 * formatDate("2026-03-11") → "11/03/2026"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formate un kilométrage avec séparateur milliers.
 * formatMileage(85000) → "85 000 km"
 */
export function formatMileage(km: number): string {
  return km.toLocaleString("fr-FR") + " km";
}

/**
 * Calcule le nombre de jours en stock depuis la date d'achat.
 */
export function daysInStock(purchaseDate: string): number {
  const purchase = new Date(purchaseDate);
  const now = new Date();
  const diff = now.getTime() - purchase.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
