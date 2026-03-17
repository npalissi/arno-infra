'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import type { VehiclePhoto } from '@/types/database';

// =============================================================
// Schemas Zod
// =============================================================

const reorderSchema = z.object({
  vehicleId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1),
});

const setPrimarySchema = z.object({
  vehicleId: z.string().uuid(),
  photoId: z.string().uuid(),
});

// =============================================================
// Types
// =============================================================

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

const BUCKET = 'vehicle-photos';

// =============================================================
// 1. getPhotos
// =============================================================

export async function getPhotos(
  vehicleId: string,
): Promise<ActionResult<VehiclePhoto[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vehicle_photos')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('position', { ascending: true }) as unknown as {
    data: VehiclePhoto[] | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

// =============================================================
// 2. uploadPhoto
// =============================================================

export async function uploadPhoto(
  vehicleId: string,
  formData: FormData,
): Promise<ActionResult<VehiclePhoto>> {
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { data: null, error: 'Fichier requis' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { data: null, error: 'Format non supporté. Utilisez JPG, PNG ou WebP.' };
  }

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return { data: null, error: 'Fichier trop volumineux (max 10 MB)' };
  }

  const supabase = await createClient();

  // Générer le chemin : {vehicleId}/{uuid}.{ext}
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `${vehicleId}/${crypto.randomUUID()}.${ext}`;

  // Upload vers Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file);

  if (uploadError) return { data: null, error: uploadError.message };

  // URL publique
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  // Vérifier si c'est la première photo → is_primary
  const { count } = await supabase
    .from('vehicle_photos')
    .select('*', { count: 'exact', head: true })
    .eq('vehicle_id', vehicleId) as unknown as { count: number | null };

  const isFirst = (count ?? 0) === 0;

  // Déterminer la prochaine position
  const { data: lastPhoto } = await supabase
    .from('vehicle_photos')
    .select('position')
    .eq('vehicle_id', vehicleId)
    .order('position', { ascending: false })
    .limit(1)
    .single() as unknown as { data: { position: number } | null };

  const nextPosition = lastPhoto ? lastPhoto.position + 1 : 0;

  // Insert en DB
  const { data: photo, error: insertError } = await supabase
    .from('vehicle_photos')
    .insert({
      vehicle_id: vehicleId,
      url: urlData.publicUrl,
      position: nextPosition,
      is_primary: isFirst,
    })
    .select()
    .single() as unknown as {
    data: VehiclePhoto | null;
    error: { message: string } | null;
  };

  if (insertError) return { data: null, error: insertError.message };
  if (!photo) return { data: null, error: 'Erreur insertion photo' };

  revalidatePath(`/vehicles/${vehicleId}`);
  return { data: photo, error: null };
}

// =============================================================
// 3. deletePhoto
// =============================================================

export async function deletePhoto(
  id: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Récupérer la photo pour avoir l'URL et vehicle_id
  const { data: photo } = await supabase
    .from('vehicle_photos')
    .select('*')
    .eq('id', id)
    .single() as unknown as { data: VehiclePhoto | null };

  if (!photo) return { data: null, error: 'Photo introuvable' };

  // Extraire le path depuis l'URL publique
  const url = new URL(photo.url);
  const storagePath = url.pathname.split(`/object/public/${BUCKET}/`)[1];

  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  // Supprimer de la DB
  const { error } = await supabase
    .from('vehicle_photos')
    .delete()
    .eq('id', id);

  if (error) return { data: null, error: error.message };

  // Si c'était la photo principale, promouvoir la première restante
  if (photo.is_primary) {
    const { data: firstRemaining } = await supabase
      .from('vehicle_photos')
      .select('id')
      .eq('vehicle_id', photo.vehicle_id)
      .order('position', { ascending: true })
      .limit(1)
      .single() as unknown as { data: { id: string } | null };

    if (firstRemaining) {
      await supabase
        .from('vehicle_photos')
        .update({ is_primary: true })
        .eq('id', firstRemaining.id);
    }
  }

  revalidatePath(`/vehicles/${photo.vehicle_id}`);
  return { data: null, error: null };
}

// =============================================================
// 4. reorderPhotos
// =============================================================

export async function reorderPhotos(
  data: unknown,
): Promise<ActionResult<null>> {
  const parsed = reorderSchema.safeParse(data);
  if (!parsed.success) {
    return { data: null, error: parsed.error.message };
  }

  const { vehicleId, photoIds } = parsed.data;
  const supabase = await createClient();

  // Mettre à jour chaque position
  const updates = photoIds.map((photoId, index) =>
    supabase
      .from('vehicle_photos')
      .update({ position: index })
      .eq('id', photoId)
      .eq('vehicle_id', vehicleId),
  );

  await Promise.all(updates);

  revalidatePath(`/vehicles/${vehicleId}`);
  return { data: null, error: null };
}

// =============================================================
// 5. reclassifyAsDocument
// =============================================================

/**
 * Déplace une photo du bucket vehicle-photos vers vehicle-documents.
 * La photo est supprimée de vehicle_photos et insérée dans vehicle_documents.
 */
export async function reclassifyAsDocument(
  photoId: string,
  docType: string,
): Promise<ActionResult<null>> {
  const validTypes = ['carte_grise', 'controle_technique', 'facture', 'autre'];
  if (!validTypes.includes(docType)) {
    return { data: null, error: 'Type de document invalide' };
  }

  const supabase = await createClient();

  // Récupérer la photo
  const { data: photo } = await supabase
    .from('vehicle_photos')
    .select('*')
    .eq('id', photoId)
    .single() as unknown as { data: VehiclePhoto | null };

  if (!photo) return { data: null, error: 'Photo introuvable' };

  const docTypeLabels: Record<string, string> = {
    carte_grise: 'Carte grise',
    controle_technique: 'Contrôle technique',
    facture: 'Facture',
    autre: 'Document',
  };

  // Insérer dans vehicle_documents (on garde la même URL, pas besoin de déplacer le fichier)
  const { error: insertError } = await supabase
    .from('vehicle_documents')
    .insert({
      vehicle_id: photo.vehicle_id,
      type: docType,
      file_url: photo.url,
      name: `${docTypeLabels[docType] ?? 'Document'} (import Auto1)`,
    });

  if (insertError) return { data: null, error: insertError.message };

  // Supprimer de vehicle_photos
  const { error: deleteError } = await supabase
    .from('vehicle_photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) return { data: null, error: deleteError.message };

  // Si c'était la photo principale, promouvoir la suivante
  if (photo.is_primary) {
    const { data: firstRemaining } = await supabase
      .from('vehicle_photos')
      .select('id')
      .eq('vehicle_id', photo.vehicle_id)
      .order('position', { ascending: true })
      .limit(1)
      .single() as unknown as { data: { id: string } | null };

    if (firstRemaining) {
      await supabase
        .from('vehicle_photos')
        .update({ is_primary: true })
        .eq('id', firstRemaining.id);
    }
  }

  // Historique
  await supabase.from('vehicle_history').insert({
    vehicle_id: photo.vehicle_id,
    action: 'reclassification_photo',
    description: `Photo reclassée en document : ${docTypeLabels[docType] ?? docType}`,
  });

  revalidatePath(`/vehicles/${photo.vehicle_id}`);
  return { data: null, error: null };
}

// =============================================================
// 6. setPrimaryPhoto
// =============================================================

export async function setPrimaryPhoto(
  data: unknown,
): Promise<ActionResult<null>> {
  const parsed = setPrimarySchema.safeParse(data);
  if (!parsed.success) {
    return { data: null, error: parsed.error.message };
  }

  const { vehicleId, photoId } = parsed.data;
  const supabase = await createClient();

  // Retirer is_primary de toutes les photos du véhicule
  await supabase
    .from('vehicle_photos')
    .update({ is_primary: false })
    .eq('vehicle_id', vehicleId);

  // Mettre is_primary sur la photo sélectionnée
  await supabase
    .from('vehicle_photos')
    .update({ is_primary: true })
    .eq('id', photoId)
    .eq('vehicle_id', vehicleId);

  revalidatePath(`/vehicles/${vehicleId}`);
  return { data: null, error: null };
}
