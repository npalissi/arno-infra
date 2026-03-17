# Backend State — thalassa

Last updated: 2026-03-11

## Fichiers créés cette session

### Schéma & Types
- `src/lib/supabase/schema.sql` — 5 tables + indexes + trigger updated_at + RLS policies CRUD authenticated
- `src/lib/supabase/storage-policies.sql` — Buckets vehicle-photos + vehicle-documents + policies INSERT/SELECT/DELETE
- `src/types/database.ts` — Type Database format supabase-js v2 complet (Row/Insert/Update/Relationships + Views/Functions/Enums/CompositeTypes). Aliases exportés pour chaque table.

### Clients Supabase
- `src/lib/supabase/client.ts` — createBrowserClient<Database> (browser)
- `src/lib/supabase/server.ts` — createServerClient<Database> (server, cookies async Next.js 16)

### Server Actions
- `src/lib/actions/vehicles.ts` — getVehicles(filters?), getVehicle(id), createVehicle(data), updateVehicle(id, data), deleteVehicle(id)
- `src/lib/actions/expenses.ts` — getExpenses(vehicleId), createExpense(data), updateExpense(id, data), deleteExpense(id)
- `src/lib/actions/photos.ts` — getPhotos, uploadPhoto (Storage + auto is_primary + position), deletePhoto (Storage + promotion primary), reorderPhotos, setPrimaryPhoto
- `src/lib/actions/documents.ts` — getDocuments, uploadDocument (Storage + Zod type carte_grise/controle_technique/facture/autre), deleteDocument (Storage + DB)
- `src/lib/actions/history.ts` — getHistory(vehicleId)
- `src/lib/actions/vehicle-form.ts` — createVehicleFromForm(FormData) + updateVehicleFromForm(id, FormData) avec z.coerce, redirect
- `src/lib/actions/auth.ts` — signIn(data), login(prevState, formData), signOut()
- `src/lib/actions/dashboard.ts` — getDashboardStats() + getRecentActivity(limit)
- `src/lib/actions/reports.ts` — getMonthlyReport(year, month)

### Auth
- `src/middleware.ts` — Refresh tokens, /login↔/dashboard redirects, matcher exclut statiques

### Pages (backend-driven)
- `src/app/(auth)/login/page.tsx` — useActionState + login action
- `src/app/(dashboard)/dashboard/page.tsx` — 4 KPI cards + activité récente

### Config
- `.env.local.example` — NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY

## Patterns établis

- **ActionResult<T>** : `{ data: T; error: null } | { data: null; error: string }` — dupliqué dans 3 fichiers, à factoriser dans src/lib/types.ts
- **FormActionResult** : `{ error: string } | null` — pour actions form avec redirect
- **Type casts Supabase** : `as unknown as { data: T | null; error: { message: string } | null }` partout car select('*') retourne {}
- **Batch expenses** : récupérer en une requête + agréger avec Map<vehicleId, total>
- **Calcul marge** : brute = sale - purchase - expenses, TVA = brute × 20/120 si brute > 0, nette = brute - TVA
- **Historique auto** : achat, changement_status, vente, ajout_frais, ajout_document
- **Zod FormData** : z.coerce pour numériques (FormData envoie strings), parseFormData helper (empty→undefined)

## Prochaines étapes probables
- Connecter à Supabase réel (exécuter schema.sql + storage-policies.sql)
- Factoriser ActionResult<T> dans src/lib/types.ts
- Ajouter des actions pour settings si demandé
