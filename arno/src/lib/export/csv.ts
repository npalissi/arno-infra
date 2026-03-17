const BOM = "\uFEFF";
const SEP = ";";

interface VehicleExportRow {
  brand: string;
  model: string;
  year: number;
  registration: string;
  status: string;
  purchase_date: string;
  sale_date: string | null;
  purchase_price: number; // centimes
  total_expenses: number; // centimes
  sale_price: number | null; // centimes
  target_sale_price: number | null; // centimes
  days_in_stock: number;
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

const statusLabels: Record<string, string> = {
  en_stock: "En stock",
  en_preparation: "En préparation",
  en_vente: "En vente",
  vendu: "Vendu",
};

/**
 * Génère un CSV complet des véhicules avec financials.
 * Séparateur point-virgule (standard français Excel).
 * Prix convertis centimes → euros.
 *
 * Pour les vendus : marges réelles basées sur sale_price.
 * Pour les non-vendus : projections basées sur target_sale_price si disponible.
 */
export function generateVehiclesCSV(vehicles: VehicleExportRow[]): string {
  const headers = [
    "Véhicule",
    "Immatriculation",
    "Statut",
    "Date achat",
    "Date vente",
    "Jours en stock",
    "Prix achat (€)",
    "Total frais (€)",
    "Coût total (€)",
    "Prix vente (€)",
    "Marge brute (€)",
    "TVA sur marge (€)",
    "Marge nette (€)",
    "% Marge nette",
  ];

  const rows = vehicles.map((v) => {
    const coutTotal = v.purchase_price + v.total_expenses;

    // Prix de vente : réel si vendu, projeté si target_sale_price disponible
    const prixVente = v.sale_price ?? v.target_sale_price;

    let margeBrute = 0;
    let tvaMarge = 0;
    let margeNette = 0;
    let margePercent = 0;

    if (prixVente !== null) {
      margeBrute = prixVente - coutTotal;
      tvaMarge = margeBrute > 0 ? Math.round((margeBrute * 20) / 120) : 0;
      margeNette = margeBrute - tvaMarge;
      margePercent = coutTotal > 0
        ? Math.round((margeNette / coutTotal) * 10000) / 100
        : 0;
    }

    return [
      escapeCsvField(`${v.brand} ${v.model} ${v.year}`),
      escapeCsvField(v.registration || ""),
      statusLabels[v.status] ?? v.status,
      v.purchase_date,
      v.sale_date ?? "",
      String(v.days_in_stock),
      centsToEuros(v.purchase_price),
      centsToEuros(v.total_expenses),
      centsToEuros(coutTotal),
      prixVente !== null ? centsToEuros(prixVente) : "",
      prixVente !== null ? centsToEuros(margeBrute) : "",
      prixVente !== null ? centsToEuros(tvaMarge) : "",
      prixVente !== null ? centsToEuros(margeNette) : "",
      prixVente !== null ? String(margePercent).replace(".", ",") + "%" : "",
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
