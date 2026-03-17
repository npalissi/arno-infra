/**
 * Script pour supprimer un véhicule et toutes ses données associées.
 * Usage: npx tsx scripts/delete-vehicle.ts <vehicle_id ou stock_number>
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises.");
  console.error("Lance avec: npx tsx --env-file=.env.local scripts/delete-vehicle.ts <id>");
  process.exit(1);
}

const input = process.argv[2];
if (!input) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/delete-vehicle.ts <vehicle_id ou stock_number>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Trouver le véhicule par ID ou stock_number
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);

  const { data: vehicle, error: findError } = isUuid
    ? await supabase.from("vehicles").select("id, brand, model, stock_number").eq("id", input).single()
    : await supabase.from("vehicles").select("id, brand, model, stock_number").eq("stock_number", input).single();

  if (findError || !vehicle) {
    console.error(`Véhicule introuvable: ${input}`);
    console.error(findError?.message);
    process.exit(1);
  }

  const vehicleId = vehicle.id;
  console.log(`Véhicule trouvé: ${vehicle.brand} ${vehicle.model} (${vehicle.stock_number ?? "sans stock"}) — ${vehicleId}`);

  // 1. Récupérer les photos pour nettoyer le Storage
  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("url")
    .eq("vehicle_id", vehicleId);

  if (photos && photos.length > 0) {
    const paths = photos
      .map((p) => {
        try {
          const url = new URL(p.url);
          return url.pathname.split("/object/public/vehicle-photos/")[1];
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("vehicle-photos")
        .remove(paths);
      if (storageError) console.warn(`Warning Storage photos: ${storageError.message}`);
      else console.log(`${paths.length} photo(s) supprimée(s) du Storage`);
    }
  }

  // 2. Récupérer les documents pour nettoyer le Storage
  const { data: docs } = await supabase
    .from("vehicle_documents")
    .select("file_url")
    .eq("vehicle_id", vehicleId);

  if (docs && docs.length > 0) {
    const paths = docs
      .map((d) => {
        try {
          const url = new URL(d.file_url);
          return url.pathname.split("/object/public/vehicle-documents/")[1];
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("vehicle-documents")
        .remove(paths);
      if (storageError) console.warn(`Warning Storage docs: ${storageError.message}`);
      else console.log(`${paths.length} document(s) supprimé(s) du Storage`);
    }
  }

  // 3. Supprimer le véhicule (CASCADE supprime photos, docs, expenses, history, listings)
  const { error: deleteError } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId);

  if (deleteError) {
    console.error(`Erreur suppression: ${deleteError.message}`);
    process.exit(1);
  }

  console.log(`Véhicule ${vehicle.brand} ${vehicle.model} supprimé avec toutes ses données.`);
}

main();
