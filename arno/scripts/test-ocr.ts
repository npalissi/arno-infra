/**
 * Test OCR + Classification de factures avec Tesseract.js
 *
 * Usage:
 *   npx tsx scripts/test-ocr.ts <chemin-vers-facture>
 *   npx tsx scripts/test-ocr.ts <chemin-vers-dossier>
 */

import Tesseract from "tesseract.js";
import fs from "node:fs";
import path from "node:path";

// =============================================================
// Classification par mots-clés
// =============================================================

const CATEGORIES: Record<string, string[]> = {
  mecanique: [
    "garage", "vidange", "freins", "frein", "pneu", "pneus", "revision",
    "révision", "huile", "filtre", "courroie", "embrayage", "amortisseur",
    "echappement", "échappement", "bougie", "batterie", "alternateur",
    "demarreur", "démarreur", "distribution", "turbo", "injecteur",
    "radiateur", "pompe", "joint", "soupape", "culasse", "moteur",
    "boite de vitesse", "boîte de vitesse", "atelier", "main d'oeuvre",
    "main d'œuvre", "diagnostic", "reparation", "réparation",
    "plaquettes", "disque", "rotule", "biellette", "cardans", "cardan",
    "silent bloc", "silentbloc", "climatisation", "clim", "parallélisme",
    "geometrie", "géométrie", "ct", "contrôle", "entretien",
  ],
  carrosserie: [
    "carrosserie", "peinture", "debosselage", "débosselage", "pare-chocs",
    "aile", "capot", "portiere", "portière", "tole", "tôle", "vernis",
    "mastic", "polish", "lustrage", "rayure", "impact", "grele", "grêle",
    "retouche", "soudure", "redressage", "remplacement aile",
    "pare-brise", "vitrage", "lunette arriere", "lunette arrière",
  ],
  transport: [
    "transport", "livraison", "convoyage", "remorque", "plateau",
    "depannage", "dépannage", "rapatriement", "acheminement", "transfert",
    "expedition", "expédition", "fret", "km", "kilometre", "kilomètre",
    "trajet",
  ],
  administratif: [
    "carte grise", "certificat", "immatriculation", "controle technique",
    "contrôle technique", "prefecture", "préfecture", "duplicata",
    "homologation", "assurance", "taxe", "declaration", "déclaration",
    "cession", "ants",
  ],
};

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"]);

// =============================================================
// OCR
// =============================================================

async function extractText(filePath: string): Promise<Tesseract.RecognizeResult> {
  const buffer = fs.readFileSync(filePath);
  return Tesseract.recognize(buffer, "fra");
}

// =============================================================
// Classification
// =============================================================

function classify(text: string): {
  category: string;
  confidence: number;
  matchedKeywords: string[];
} {
  const lowerText = text.toLowerCase();

  let bestCategory = "autre";
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    const matched = keywords.filter((kw) => lowerText.includes(kw));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      bestCategory = category;
      bestMatched = matched;
    }
  }

  return {
    category: bestCategory,
    confidence: bestScore,
    matchedKeywords: bestMatched,
  };
}

// =============================================================
// Détection de montants
// =============================================================

interface DetectedAmount {
  value: number;
  raw: string;
  context: string;
}

function detectAmounts(text: string): {
  amounts: DetectedAmount[];
  bestAmount: DetectedAmount | null;
} {
  const amounts: DetectedAmount[] = [];

  // Patterns de prix : XX,XX € / XX.XX € / XX,XX€ / XX €
  // Note: (\d[\d\s]*\d|\d) gère les montants à 1 chiffre (ex: 5,00 €)
  const priceRegex = /(\d[\d\s]*\d|\d)[,.](\d{2})\s*€/g;
  const priceIntRegex = /(\d[\d\s]*\d|\d)\s*€/g;

  // Contexte prioritaire (total, net à payer, TTC, etc.)
  const totalRegex =
    /(?:total|net\s*[àa]\s*payer|montant\s*(?:ttc|total|net|global)?|ttc)\s*[:\s]*(\d[\d\s]*\d|\d)[,.](\d{2})/gi;

  // D'abord chercher les montants avec contexte "total"
  let totalMatch: RegExpExecArray | null;
  const totalAmounts: DetectedAmount[] = [];

  while ((totalMatch = totalRegex.exec(text)) !== null) {
    const intPart = totalMatch[1]!.replace(/\s/g, "");
    const decPart = totalMatch[2]!;
    const value = parseFloat(`${intPart}.${decPart}`);
    const start = Math.max(0, totalMatch.index - 20);
    const end = Math.min(text.length, totalMatch.index + totalMatch[0].length + 10);
    const context = text.slice(start, end).replace(/\n/g, " ").trim();

    const amount: DetectedAmount = { value, raw: `${intPart},${decPart} €`, context };
    amounts.push(amount);
    totalAmounts.push(amount);
  }

  // Chercher les prix avec décimales
  let priceMatch: RegExpExecArray | null;
  while ((priceMatch = priceRegex.exec(text)) !== null) {
    const intPart = priceMatch[1]!.replace(/\s/g, "");
    const decPart = priceMatch[2]!;
    const value = parseFloat(`${intPart}.${decPart}`);

    // Éviter les doublons
    if (amounts.some((a) => Math.abs(a.value - value) < 0.01)) continue;

    const start = Math.max(0, priceMatch.index - 20);
    const end = Math.min(text.length, priceMatch.index + priceMatch[0].length + 10);
    const context = text.slice(start, end).replace(/\n/g, " ").trim();

    amounts.push({ value, raw: `${intPart},${decPart} €`, context });
  }

  // Chercher les prix entiers avec €
  let intMatch: RegExpExecArray | null;
  while ((intMatch = priceIntRegex.exec(text)) !== null) {
    const intPart = intMatch[1]!.replace(/\s/g, "");
    // Ignorer si c'est un prix avec décimales déjà capturé
    const fullMatch = text.slice(intMatch.index, intMatch.index + intMatch[0].length + 3);
    if (/\d[,.]\d{2}\s*€/.test(fullMatch)) continue;

    const value = parseFloat(intPart);
    if (amounts.some((a) => Math.abs(a.value - value) < 0.01)) continue;

    const start = Math.max(0, intMatch.index - 20);
    const end = Math.min(text.length, intMatch.index + intMatch[0].length + 10);
    const context = text.slice(start, end).replace(/\n/g, " ").trim();

    amounts.push({ value, raw: `${intPart} €`, context });
  }

  // Trier par valeur décroissante
  amounts.sort((a, b) => b.value - a.value);

  // Le meilleur montant : celui dans un contexte "total", sinon le plus grand
  let bestAmount: DetectedAmount | null = null;
  if (totalAmounts.length > 0) {
    // Prendre le plus grand des montants "total"
    totalAmounts.sort((a, b) => b.value - a.value);
    bestAmount = totalAmounts[0] ?? null;
  } else if (amounts.length > 0) {
    bestAmount = amounts[0]!;
  }

  return { amounts, bestAmount };
}

// =============================================================
// Traitement d'un fichier
// =============================================================

async function processFile(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    console.log(`\n⚠️  Format non supporté: ${ext} (${fileName})`);
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📄 ${fileName}`);
  console.log("=".repeat(60));

  const start = Date.now();

  // 1. OCR
  console.log("\n⏳ OCR en cours...");
  const result = await extractText(filePath);
  const ocrTime = Date.now() - start;

  const text = result.data.text.trim();
  const ocrConfidence = result.data.confidence;

  // 2. Texte brut
  console.log(`\n--- TEXTE EXTRAIT (${text.length} caractères, confiance OCR: ${ocrConfidence.toFixed(1)}%) ---`);
  console.log(text || "(aucun texte détecté)");
  console.log("---");

  // 3. Classification
  const { category, confidence, matchedKeywords } = classify(text);

  // 4. Montants
  const { amounts, bestAmount } = detectAmounts(text);

  // 5. Résumé
  console.log(`\n${"=".repeat(40)}`);
  console.log("=== RÉSULTAT ===");
  console.log(`Fichier: ${fileName}`);
  console.log(`Temps OCR: ${ocrTime}ms`);
  console.log(`Texte extrait: ${text.length} caractères`);
  console.log(`Confiance OCR: ${ocrConfidence.toFixed(1)}%`);
  console.log(`Catégorie: ${category} (confiance: ${confidence} mots-clés)`);
  if (matchedKeywords.length > 0) {
    console.log(`Mots-clés trouvés: ${matchedKeywords.join(", ")}`);
  }
  if (bestAmount) {
    console.log(`Montant détecté: ${bestAmount.raw}`);
  } else {
    console.log("Montant détecté: (aucun)");
  }
  if (amounts.length > 1) {
    console.log(`Autres montants: ${amounts.map((a) => a.raw).join(", ")}`);
  }
  console.log("=".repeat(40));
}

// =============================================================
// Main
// =============================================================

async function main() {
  const target = process.argv[2];

  if (!target) {
    console.error("Usage:");
    console.error("  npx tsx scripts/test-ocr.ts <chemin-vers-facture>");
    console.error("  npx tsx scripts/test-ocr.ts <chemin-vers-dossier>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(target);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Fichier/dossier introuvable: ${resolvedPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(resolvedPath);

  if (stat.isDirectory()) {
    const files = fs.readdirSync(resolvedPath)
      .filter((f) => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map((f) => path.join(resolvedPath, f))
      .sort();

    if (files.length === 0) {
      console.error(`❌ Aucun fichier supporté trouvé dans: ${resolvedPath}`);
      console.error(`   Formats supportés: ${[...SUPPORTED_EXTENSIONS].join(", ")}`);
      process.exit(1);
    }

    console.log(`\n📂 Dossier: ${resolvedPath}`);
    console.log(`   ${files.length} fichier(s) à analyser\n`);

    for (const file of files) {
      await processFile(file);
    }

    console.log(`\n✅ Analyse terminée — ${files.length} fichier(s) traité(s)`);
  } else {
    await processFile(resolvedPath);
  }
}

main().catch((err) => {
  console.error("❌ Erreur:", err instanceof Error ? err.message : err);
  process.exit(1);
});
