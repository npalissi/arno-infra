const BOM = "\uFEFF";
const SEP = ";";

interface VehicleExportRow {
  brand: string;
  model: string;
  year: number;
  purchase_date: string;
  sale_date: string;
  purchase_price: number; // centimes
  total_expenses: number; // centimes
  sale_price: number; // centimes
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function escapeCsvField(value: string): string {
  if (value.includes(SEP) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Génère un CSV des véhicules vendus avec leurs financials.
 * Séparateur point-virgule (standard français Excel).
 * Prix convertis centimes → euros.
 */
export function generateVehiclesCSV(vehicles: VehicleExportRow[]): string {
  const headers = [
    "Véhicule",
    "Date achat",
    "Date vente",
    "Prix achat (€)",
    "Frais (€)",
    "Prix vente (€)",
    "Marge brute (€)",
    "TVA sur marge (€)",
    "Marge nette (€)",
  ];

  const rows = vehicles.map((v) => {
    const margeBrute = v.sale_price - v.purchase_price - v.total_expenses;
    const tvaMarge = Math.round((margeBrute * 20) / 120);
    const margeNette = margeBrute - tvaMarge;

    return [
      escapeCsvField(`${v.brand} ${v.model} ${v.year}`),
      v.purchase_date,
      v.sale_date,
      centsToEuros(v.purchase_price),
      centsToEuros(v.total_expenses),
      centsToEuros(v.sale_price),
      centsToEuros(margeBrute),
      centsToEuros(tvaMarge),
      centsToEuros(margeNette),
    ].join(SEP);
  });

  return BOM + [headers.join(SEP), ...rows].join("\n");
}

/**
 * Déclenche le téléchargement d'un fichier CSV côté client.
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
