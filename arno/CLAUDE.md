# Arno — Gestion stock véhicules (achat-revente VO)

## Context Recovery

IMPORTANT: At session start, read all .md files in the /docs/ directory to restore full project context from the previous session.

## Current State

- **Branch**: main
- **Status**: Redesign UI v3 (KPIs + détail compact + frais CRUD + hydration fix). Build OK. Reste: parser Auto1 complet, deploy Vercel, polish/bugs.
- **Last updated**: 2026-03-13

## Task Progress

- [x] Setup projet Next.js 15 + Tailwind + shadcn/ui + Supabase JS + Zod
- [x] Schéma BDD (6 tables: vehicles, vehicle_photos, vehicle_documents, vehicle_expenses, vehicle_history, vehicle_listings)
- [x] Types TypeScript miroir DB (`src/types/database.ts`) — inclut VehicleListing
- [x] Auth Supabase SSR (middleware, signIn/signOut, login page useActionState React 19)
- [x] Layout sidebar + StatusBadge
- [x] Server actions CRUD véhicules + expenses + photos + documents + history + listings
- [x] Server actions formulaire (createVehicleFromForm, updateVehicleFromForm avec Zod coerce)
- [x] Types Auto1 + mapper + compression images (client OffscreenCanvas + server sharp)
- [x] API route POST /api/auto1/import (fetch → compress → upload Storage → insert DB)
- [x] Page liste véhicules (filtres search/status/brand, VehicleCards)
- [x] Page détail véhicule (galerie compact, infos, financier, frais CRUD, tabs docs/historique/annonces)
- [x] Formulaire create/edit véhicule (VehicleForm réutilisable, conversion euros→centimes)
- [x] Page /vehicles/new avec tabs Saisie manuelle + Import Auto1
- [x] Page /vehicles/[id]/edit — champs non-required en mode edit
- [x] Dashboard KPIs (4 cards + activité récente)
- [x] Page Rapports mensuels (tableau vendus, KPIs mois, sélecteur mois)
- [x] Export CSV (séparateur ;, BOM UTF-8, centimes→euros)
- [x] Supabase connecté (.env.local avec URL, anon key, service_role key)
- [x] Schema SQL exécuté en DB (6 tables + indexes + RLS + trigger updated_at)
- [x] Storage buckets créés (vehicle-photos, vehicle-documents) avec policies
- [x] 4 pages migrées de mocks vers vrais appels Supabase (vehicles list, detail, edit, reports)
- [x] Client Auto1 réel câblé — vrais appels HTTP à auto1.com avec auto-login (`src/lib/auto1/client.ts`)
- [x] Table vehicle_listings + server actions + UI tab Annonces (liens leboncoin, lacentrale, etc.)
- [x] Page `/` redirige vers `/dashboard`
- [x] Fix Base UI nativeButton warning sur boutons Link
- [x] Script `scripts/delete-vehicle.ts` (supprime véhicule + Storage, utilise service_role key)
- [x] Composant PhotoGallery avec reclassification photo→document + mode compact
- [x] Server action `reclassifyAsDocument` dans `src/lib/actions/photos.ts`
- [x] **Redesign UI v1** — dark theme, DM Sans, amber accent (remplacé par v2)
- [x] **Redesign UI v2** — light theme (#F7F5F2), Inter font, accent #DE5E36, badges colorés
- [x] **Redesign UI v3** — KPIs (En stock/Achetés/Vendus/Marge nette verte), labels financiers raccourcis, hover shadow renforcée
- [x] **Font-weight 500 global** — `font-medium` sur body dans globals.css
- [x] **Page détail layout compact 3 colonnes** — `lg:grid-cols-[280px_1fr_320px]` : photo carrée | infos | financier
- [x] **Section Frais CRUD complet** — ajout/édition inline/suppression + upload facture + historique traçabilité
- [x] **API route POST /api/upload-invoice** — upload factures vers bucket vehicle-documents
- [x] **Gestion facture après coup** — ajouter/remplacer/supprimer facture sur frais existant
- [x] **Fix hydration mismatch base-ui** — mounted guard sur Sheet (layout) + Select (toolbar)
- [ ] Mettre à jour le parser Auto1 pour récupérer toutes les photos (gallery + highlights + damages) ← NEXT
- [ ] Deploy Vercel
- [ ] Polish UI / bugs restants

## Design System v2 (light theme, 2026-03-13)

### Palette
- **Background app** : #F7F5F2 (warm beige)
- **Surfaces** : #FFFFFF (white cards)
- **Text** : #1C1C1E (main), #8E8E93 (secondary), #B0B0B5 (tertiary)
- **Brand accent** : #DE5E36 (orange-red) — sidebar indicator, active nav icon
- **Primary buttons** : #1A1A1A (dark) — NOT the brand color
- **Positive** : #059669 (green) — margins, financial positive values
- **Destructive** : #DC2626 (red)

### Badges
- En stock : bg #E6F4EA, text #1E8E3E (green)
- En prépa : bg #E8F0FE, text #1A73E8 (blue)
- En vente : bg #FEF7E0, text #B06000 (yellow)
- Vendu : bg #F1F3F4, text #5F6368 (gray)

### Typography
- **Font** : Inter (400, 500, 600, 700) — `src/app/layout.tsx`
- **Font-weight minimum** : 500 (font-medium) — aucun texte en 400
- **Micro-caps** : 11px, semibold, uppercase, 0.5px tracking

### Layout
- **Sidebar** : 260px, beige bg (#F7F5F2), white active cards with shadow + left orange bar (3px)
- **Topbar** : 64px, white bg, title left, notification bell + avatar right
- **Cards** : white, rounded-2xl (16px), shadow `0 4px 16px rgba(0,0,0,0.04)`
- **Vehicle cards hover** : translateY(-2px) + shadow `0 8px 30px rgba(0,0,0,0.08)`
- **Inputs/buttons** : rounded-[10px]
- **Badges** : rounded-[6px]
- **Page détail** : 3 colonnes `[280px_1fr_320px]` — photo compact | infos | financier

### CSS Variables
- `--brand` / `--emerald` = #DE5E36 (brand accent orange)
- `--positive` = #059669 (green for margins)
- `--primary` = #1A1A1A (dark buttons)
- NO dark theme — light only

## Key Decisions

- **Prix en centimes (integer)** : évite les erreurs floating point. UI affiche en euros, conversion ×100 au submit.
- **TVA sur marge = marge_brute × 20/120** : PAS ×0.2. C'est une TVA incluse dans la marge.
- **Supabase type casts** : `as unknown as { data: T }` nécessaire car les types générés par Supabase ne résolvent pas correctement avec `select('*')`.
- **Zod v4** : `import { z } from 'zod/v4'` partout pour cohérence.
- **CSV français** : séparateur point-virgule + BOM UTF-8 pour Excel.
- **Pas de multi-sites, pas de rôles** : tous les users ont les mêmes droits.
- **Photos compressées** : max 1920px, JPEG 80%, sharp côté serveur.
- **Auto1 direct HTTP** : pas de MCP dans l'app, appels directs à auto1.com avec cookie auth + auto-login.
- **Env .env.local** : mot de passe Auto1 contient # → doit être entre guillemets.
- **Scripts admin** : utilisent SUPABASE_SERVICE_ROLE_KEY pour bypasser RLS.
- **Formulaire edit** : tous les champs optionnels (required={!isEdit}) pour modifier partiellement.
- **Tri photos/documents = manuel** : OCR automatique pas fiable. Solution: tri manuel post-import via dropdown sur chaque photo.
- **Reclassification photo→document** : déplace de vehicle_photos vers vehicle_documents, garde la même URL (pas de copie fichier).
- **Hydration mismatch base-ui** : composants Sheet/Select wrappés avec `mounted` guard (`useEffect` + `useState`) pour éviter les IDs SSR/client divergents.
- **Frais historique complet** : ajout_frais, modification_frais, suppression_frais — traçabilité complète dans vehicle_history.
- **Factures dans bucket vehicle-documents** : réutilise le bucket existant, pas de nouveau bucket. Upload via API route `/api/upload-invoice`.

## Auto1 API — Sources de photos

L'API Auto1 renvoie des photos dans 3 endroits :
- `gallery.galleryImages[]` — photos principales (actuellement parsées)
- `quality.highlightItems[]` — photos de détails/état (partName, description, fullUrl, photo, thumbnail)
- `quality.damageItems[]` — photos de dégâts (partName, description, fullUrl, photo)
Le parser actuel (`src/lib/auto1/client.ts:147-155`) ne récupère que galleryImages. Il faut aussi récupérer highlightItems et damageItems.

## Pentagon Agents

CTO: galatea. Backend: thalassa. Frontend: pandora. Intégrations: tethys.
Note: les threads de conversation sont souvent pleins (reply limit) → utiliser un nouveau conversationId à chaque message.

## Routes (11)

/login, /dashboard, /vehicles, /vehicles/[id], /vehicles/[id]/edit, /vehicles/new, /reports, /api/auto1/import, /api/upload-invoice

## Key Files

- `src/lib/auto1/client.ts` — Client HTTP Auto1 réel (login, fetch car details, parser)
- `src/lib/auto1/mapper.ts` — Convertit Auto1Vehicle → VehicleInsert
- `src/lib/actions/photos.ts` — CRUD photos + reclassifyAsDocument (déplace photo→document)
- `src/lib/actions/expenses.ts` — CRUD frais (create/update/delete) + entrées historique auto
- `src/lib/actions/listings.ts` — CRUD annonces (getVehicleListings, addListing, deleteListing)
- `src/components/vehicles/photo-gallery.tsx` — Galerie avec tri photo/document + mode compact
- `src/app/(dashboard)/vehicles/[id]/detail-client.tsx` — Page détail véhicule (3 colonnes + frais CRUD + factures)
- `src/app/(dashboard)/vehicles/vehicles-client.tsx` — Page inventaire (KPIs + toolbar + grid)
- `src/app/api/upload-invoice/route.ts` — Upload factures vers Supabase Storage
- `src/lib/supabase/schema.sql` — Schéma complet (6 tables)
- `src/lib/supabase/storage-policies.sql` — Buckets + policies Storage
- `scripts/delete-vehicle.ts` — Script admin suppression véhicule
- `.env.local` — Supabase URL/keys + Auto1 credentials
