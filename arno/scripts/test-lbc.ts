/**
 * Test script for Leboncoin market valuation.
 *
 * Usage:
 *   npx tsx scripts/test-lbc.ts "Peugeot" "308" 2019 80000 diesel manuelle
 *   npx tsx scripts/test-lbc.ts "Renault" "Clio" 2020 60000 essence manuelle
 */

import { getMarketValuation } from "../src/lib/leboncoin/valuation";
import { fuelToLbcCode, gearboxToLbcCode } from "../src/lib/leboncoin/client";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.log("Usage: npx tsx scripts/test-lbc.ts <brand> <model> <year> <mileage> [fuel] [gearbox]");
    console.log('Example: npx tsx scripts/test-lbc.ts "Peugeot" "308" 2019 80000 diesel manuelle');
    process.exit(1);
  }

  const [brand, model, yearStr, mileageStr, fuelStr, gearboxStr] = args;
  const year = parseInt(yearStr!, 10);
  const mileage = parseInt(mileageStr!, 10);

  console.log(`\n🔍 Recherche Leboncoin : ${brand} ${model} ${year} — ${mileage} km`);
  if (fuelStr) console.log(`   Carburant: ${fuelStr} (code: ${fuelToLbcCode(fuelStr) ?? "non mappé"})`);
  if (gearboxStr) console.log(`   Boîte: ${gearboxStr} (code: ${gearboxToLbcCode(gearboxStr) ?? "non mappé"})`);
  console.log(`   Année: ${year - 1} — ${year + 1}`);
  console.log(`   Kilométrage: ${Math.max(0, mileage - 20000)} — ${mileage + 20000} km`);
  console.log("");

  try {
    const result = await getMarketValuation({
      brand: brand!,
      model: model!,
      yearMin: year - 1,
      yearMax: year + 1,
      mileageMin: Math.max(0, mileage - 20000),
      mileageMax: mileage + 20000,
      fuel: fuelStr ? fuelToLbcCode(fuelStr) : undefined,
      gearbox: gearboxStr ? gearboxToLbcCode(gearboxStr) : undefined,
    });

    console.log(`📊 Résultats : ${result.totalAds} annonces trouvées`);
    console.log("");
    console.log(`   Prix médian  : ${result.medianPrice.toLocaleString("fr-FR")} €`);
    console.log(`   Prix moyen   : ${result.avgPrice.toLocaleString("fr-FR")} €`);
    console.log(`   Prix min     : ${result.minPrice.toLocaleString("fr-FR")} €`);
    console.log(`   Prix max     : ${result.maxPrice.toLocaleString("fr-FR")} €`);

    if (result.ads.length > 0) {
      console.log(`\n📋 Top ${Math.min(5, result.ads.length)} annonces :`);
      for (const ad of result.ads.slice(0, 5)) {
        const km = ad.mileage ? `${ad.mileage.toLocaleString("fr-FR")} km` : "?";
        const loc = ad.location ?? "?";
        console.log(`   ${ad.price.toLocaleString("fr-FR")} € — ${ad.title} — ${km} — ${loc}`);
        console.log(`      ${ad.url}`);
      }
    }

    console.log(`\n✅ Recherche effectuée le ${result.fetchedAt}`);
  } catch (err) {
    console.error("❌ Erreur:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
