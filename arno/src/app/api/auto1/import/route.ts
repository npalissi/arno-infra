import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { fetchAuto1Vehicle } from "@/lib/auto1/client";
import { mapAuto1ToVehicle } from "@/lib/auto1/mapper";
import { compressImageServer } from "@/lib/images/compress";
import type { VehiclePhotoInsert } from "@/types/database";

const importSchema = z.object({
  stockNumbers: z.array(z.string()).min(1).max(10),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation échouée", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { stockNumbers } = parsed.data;
    let imported = 0;
    const errors: string[] = [];

    const photoCountByStock: Record<string, number> = {};

    for (const stockNumber of stockNumbers) {
      try {
        // 1. Fetch données Auto1
        const auto1Data = await fetchAuto1Vehicle(stockNumber);

        // 2. Map vers schéma Arno
        const { vehicle, photos } = mapAuto1ToVehicle(auto1Data);

        // 2b. Check doublon par stock_number
        if (vehicle.stock_number) {
          const { data: existing } = await supabase
            .from("vehicles")
            .select("id")
            .eq("stock_number", vehicle.stock_number)
            .maybeSingle() as unknown as { data: { id: string } | null };

          if (existing) {
            errors.push(`${stockNumber}: Véhicule déjà importé (stock_number ${vehicle.stock_number})`);
            continue;
          }
        }

        // 3. Insert véhicule
        const { data: insertedVehicle, error: vehicleError } = await supabase
          .from("vehicles")
          .insert(vehicle)
          .select("id")
          .single();

        if (vehicleError || !insertedVehicle) {
          errors.push(`${stockNumber}: Erreur insert véhicule — ${vehicleError?.message}`);
          continue;
        }

        // 4. Pour chaque photo : fetch → compress → insert
        const photoInserts: VehiclePhotoInsert[] = [];

        for (const photo of photos) {
          try {
            // Télécharger l'image
            const response = await fetch(photo.url);
            if (!response.ok) {
              errors.push(`${stockNumber}: Échec téléchargement photo ${photo.url}`);
              continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Compresser côté serveur (fallback: image brute si format non supporté)
            let finalBuffer: Buffer = buffer;
            let contentType = "image/jpeg";
            try {
              finalBuffer = await compressImageServer(buffer);
            } catch {
              console.warn(`[Auto1 Import] Compression échouée pour ${stockNumber} photo ${photo.position}, upload de l'image originale`);
              contentType = response.headers.get("content-type") || "image/jpeg";
            }

            // Upload vers Supabase Storage
            const ext = contentType === "image/jpeg" ? "jpg" : (contentType.split("/")[1] || "bin");
            const storagePath = `${insertedVehicle.id}/${photo.position}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("vehicle-photos")
              .upload(storagePath, finalBuffer, {
                contentType,
              });

            if (uploadError) {
              errors.push(`${stockNumber}: Erreur upload photo ${photo.position} — ${uploadError.message}`);
              continue;
            }

            const { data: publicUrlData } = supabase.storage
              .from("vehicle-photos")
              .getPublicUrl(storagePath);

            photoInserts.push({
              vehicle_id: insertedVehicle.id,
              url: publicUrlData.publicUrl,
              position: photo.position,
              is_primary: photo.is_primary,
              imported_from_auto1: true,
            });
          } catch (photoErr) {
            const msg = photoErr instanceof Error ? photoErr.message : "Erreur inconnue";
            errors.push(`${stockNumber}: Erreur photo position ${photo.position} — ${msg}`);
          }
        }

        // 5. Insert toutes les photos en batch
        if (photoInserts.length > 0) {
          const { error: photosError } = await supabase
            .from("vehicle_photos")
            .insert(photoInserts);

          if (photosError) {
            errors.push(`${stockNumber}: Erreur insert photos — ${photosError.message}`);
          }
        }

        photoCountByStock[stockNumber] = photoInserts.length;
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        errors.push(`${stockNumber}: ${msg}`);
      }
    }

    return NextResponse.json({ imported, errors, photosImported: photoCountByStock });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur interne" },
      { status: 500 }
    );
  }
}
