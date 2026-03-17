'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import type { VehicleDocument } from '@/types/database';

// =============================================================
// Schemas Zod
// =============================================================

const uploadDocumentSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
});

// =============================================================
// Types
// =============================================================

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

const BUCKET = 'vehicle-documents';

// =============================================================
// 1. getDocuments
// =============================================================

export async function getDocuments(
  vehicleId: string,
): Promise<ActionResult<VehicleDocument[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('uploaded_at', { ascending: false }) as unknown as {
    data: VehicleDocument[] | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

// =============================================================
// 2. uploadDocument
// =============================================================

export async function uploadDocument(
  vehicleId: string,
  formData: FormData,
): Promise<ActionResult<VehicleDocument>> {
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { data: null, error: 'Fichier requis' };
  }

  const meta = uploadDocumentSchema.safeParse({
    type: formData.get('type'),
    name: formData.get('name'),
  });
  if (!meta.success) {
    return { data: null, error: meta.error.message };
  }

  const maxSize = 20 * 1024 * 1024; // 20 MB
  if (file.size > maxSize) {
    return { data: null, error: 'Fichier trop volumineux (max 20 MB)' };
  }

  const supabase = await createClient();

  // Chemin : {vehicleId}/{uuid}.{ext}
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
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

  // Insert en DB
  const { data: doc, error: insertError } = await supabase
    .from('vehicle_documents')
    .insert({
      vehicle_id: vehicleId,
      type: meta.data.type,
      file_url: urlData.publicUrl,
      name: meta.data.name,
    })
    .select()
    .single() as unknown as {
    data: VehicleDocument | null;
    error: { message: string } | null;
  };

  if (insertError) return { data: null, error: insertError.message };
  if (!doc) return { data: null, error: 'Erreur insertion document' };

  // Entrée historique
  await supabase.from('vehicle_history').insert({
    vehicle_id: vehicleId,
    action: 'ajout_document',
    description: `Document ajouté : ${meta.data.type} — ${meta.data.name}`,
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  return { data: doc, error: null };
}

// =============================================================
// 3. updateDocument
// =============================================================

export async function updateDocument(
  id: string,
  updates: { type?: string; name?: string },
): Promise<ActionResult<VehicleDocument>> {
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from('vehicle_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single() as unknown as {
    data: VehicleDocument | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  if (!doc) return { data: null, error: 'Document introuvable' };

  await supabase.from('vehicle_history').insert({
    vehicle_id: doc.vehicle_id,
    action: 'modification_document',
    description: `Document modifié : ${doc.type} — ${doc.name}`,
  });

  revalidatePath(`/vehicles/${doc.vehicle_id}`);
  return { data: doc, error: null };
}

// =============================================================
// 4. deleteDocument
// =============================================================

export async function deleteDocument(
  id: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Récupérer le document pour le Storage path et vehicle_id
  const { data: doc } = await supabase
    .from('vehicle_documents')
    .select('*')
    .eq('id', id)
    .single() as unknown as { data: VehicleDocument | null };

  if (!doc) return { data: null, error: 'Document introuvable' };

  // Extraire le path depuis l'URL publique
  const url = new URL(doc.file_url);
  const storagePath = url.pathname.split(`/object/public/${BUCKET}/`)[1];

  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  // Supprimer de la DB
  const { error } = await supabase
    .from('vehicle_documents')
    .delete()
    .eq('id', id);

  if (error) return { data: null, error: error.message };

  revalidatePath(`/vehicles/${doc.vehicle_id}`);
  return { data: null, error: null };
}
