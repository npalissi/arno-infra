-- =============================================================
-- Arno — Schéma BDD Supabase
-- Gestion stock véhicules, achat-revente VO
-- Prix stockés en centimes (integer)
-- =============================================================

-- ========================
-- 1. TABLES
-- ========================

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),

  -- Identification
  stock_number text,
  registration text not null,
  vin text,

  -- Caractéristiques
  brand text not null,
  model text not null,
  sub_type text,
  year int not null,
  fuel_type text not null,
  gearbox text not null,
  mileage int not null,
  power_hp int,
  color text,
  doors int,
  seats int,
  body_type text,
  euro_norm text,
  total_owners int,

  -- État
  status text not null default 'en_stock'
    check (status in ('en_stock', 'en_preparation', 'en_vente', 'vendu')),
  condition text,
  is_accident boolean,
  damages text,
  ct_status text,
  ct_date date,

  -- Achat
  purchase_price int not null, -- centimes
  purchase_date date not null,
  purchase_source text not null,
  seller_name text,
  purchase_notes text,

  -- Vente
  target_sale_price int, -- centimes
  sale_price int, -- centimes
  sale_date date,
  buyer_name text,
  sale_notes text
);

create table if not exists vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  url text not null,
  position int not null default 0,
  is_primary boolean not null default false,
  imported_from_auto1 boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  type text not null,
  file_url text not null,
  name text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists vehicle_expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  category text not null,
  description text,
  amount int not null, -- centimes
  date date not null,
  invoice_url text,
  created_at timestamptz not null default now()
);

create table if not exists vehicle_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  action text not null,
  description text,
  date timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- ========================
-- 2. INDEXES
-- ========================

create index if not exists idx_vehicles_status on vehicles(status);
create index if not exists idx_vehicles_brand on vehicles(brand);
create index if not exists idx_vehicles_created_by on vehicles(created_by);
create index if not exists idx_vehicle_photos_vehicle_id on vehicle_photos(vehicle_id);
create index if not exists idx_vehicle_documents_vehicle_id on vehicle_documents(vehicle_id);
create index if not exists idx_vehicle_expenses_vehicle_id on vehicle_expenses(vehicle_id);
create index if not exists idx_vehicle_history_vehicle_id on vehicle_history(vehicle_id);

-- ========================
-- 3. TRIGGER updated_at
-- ========================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vehicles_updated_at
  before update on vehicles
  for each row execute function update_updated_at();

-- ========================
-- 4. RLS POLICIES
-- ========================

alter table vehicles enable row level security;
alter table vehicle_photos enable row level security;
alter table vehicle_documents enable row level security;
alter table vehicle_expenses enable row level security;
alter table vehicle_history enable row level security;

-- Vehicles : tous les users authentifiés ont accès à tout
create policy "Authenticated users can select vehicles"
  on vehicles for select to authenticated using (true);

create policy "Authenticated users can insert vehicles"
  on vehicles for insert to authenticated with check (true);

create policy "Authenticated users can update vehicles"
  on vehicles for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicles"
  on vehicles for delete to authenticated using (true);

-- Vehicle photos
create policy "Authenticated users can select vehicle_photos"
  on vehicle_photos for select to authenticated using (true);

create policy "Authenticated users can insert vehicle_photos"
  on vehicle_photos for insert to authenticated with check (true);

create policy "Authenticated users can update vehicle_photos"
  on vehicle_photos for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicle_photos"
  on vehicle_photos for delete to authenticated using (true);

-- Vehicle documents
create policy "Authenticated users can select vehicle_documents"
  on vehicle_documents for select to authenticated using (true);

create policy "Authenticated users can insert vehicle_documents"
  on vehicle_documents for insert to authenticated with check (true);

create policy "Authenticated users can update vehicle_documents"
  on vehicle_documents for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicle_documents"
  on vehicle_documents for delete to authenticated using (true);

-- Vehicle expenses
create policy "Authenticated users can select vehicle_expenses"
  on vehicle_expenses for select to authenticated using (true);

create policy "Authenticated users can insert vehicle_expenses"
  on vehicle_expenses for insert to authenticated with check (true);

create policy "Authenticated users can update vehicle_expenses"
  on vehicle_expenses for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicle_expenses"
  on vehicle_expenses for delete to authenticated using (true);

-- Vehicle history
create policy "Authenticated users can select vehicle_history"
  on vehicle_history for select to authenticated using (true);

create policy "Authenticated users can insert vehicle_history"
  on vehicle_history for insert to authenticated with check (true);

create policy "Authenticated users can update vehicle_history"
  on vehicle_history for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicle_history"
  on vehicle_history for delete to authenticated using (true);

-- ========================
-- 6. TABLE VEHICLE_LISTINGS (liens annonces en ligne)
-- ========================

create table if not exists vehicle_listings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  platform text not null,        -- 'leboncoin', 'lacentrale', 'autoscout24', etc.
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_listings_vehicle_id on vehicle_listings(vehicle_id);

alter table vehicle_listings enable row level security;

create policy "Authenticated users can select vehicle_listings"
  on vehicle_listings for select to authenticated using (true);

create policy "Authenticated users can insert vehicle_listings"
  on vehicle_listings for insert to authenticated with check (true);

create policy "Authenticated users can update vehicle_listings"
  on vehicle_listings for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete vehicle_listings"
  on vehicle_listings for delete to authenticated using (true);

-- ========================
-- 7. TABLE APP_SETTINGS (config utilisateur)
-- ========================

create table if not exists app_settings (
  id text primary key default 'default',
  expense_categories jsonb not null default '["Mécanique", "Carrosserie", "Pneus", "Contrôle technique", "Nettoyage", "Transport", "Carte grise", "Autre"]'::jsonb,
  document_types jsonb not null default '["carte_grise", "controle_technique", "facture", "autre"]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Insert default row
insert into app_settings (id) values ('default') on conflict do nothing;

-- RLS
alter table app_settings enable row level security;

create policy "Authenticated users can select app_settings"
  on app_settings for select to authenticated using (true);

create policy "Authenticated users can update app_settings"
  on app_settings for update to authenticated using (true) with check (true);
