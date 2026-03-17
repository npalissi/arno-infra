-- =============================================================
-- Arno — Supabase Storage Policies
-- Buckets : vehicle-photos, vehicle-documents
-- Chemin fichier : {vehicleId}/{uuid}.{ext}
-- Pas de UPDATE — on supprime et re-upload
-- =============================================================

-- ========================
-- 1. Créer les buckets
-- ========================

insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', true)
on conflict (id) do nothing;

-- ========================
-- 2. Policies vehicle-photos
-- ========================

create policy "Authenticated users can upload vehicle photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehicle-photos');

create policy "Anyone can view vehicle photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'vehicle-photos');

create policy "Authenticated users can delete vehicle photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vehicle-photos');

-- ========================
-- 3. Policies vehicle-documents
-- ========================

create policy "Authenticated users can upload vehicle documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehicle-documents');

create policy "Anyone can view vehicle documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'vehicle-documents');

create policy "Authenticated users can delete vehicle documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vehicle-documents');
