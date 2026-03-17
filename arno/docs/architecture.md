# Architecture — Arno

## Stack
- **Frontend** : Next.js 15 (App Router) + Tailwind CSS + shadcn/ui (base-ui)
- **Backend** : Server Actions Next.js + Supabase (PostgreSQL + Auth + Storage)
- **Hosting** : Vercel
- **Intégration** : MCP Auto1 (import véhicules depuis site d'enchères)

## Structure des dossiers
```
src/
├── app/
│   ├── (auth)/login/page.tsx          # Login (useActionState React 19)
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # Sidebar + header + breadcrumbs
│   │   ├── dashboard/page.tsx         # KPIs + activité récente
│   │   ├── vehicles/
│   │   │   ├── page.tsx               # Liste filtrable
│   │   │   ├── new/page.tsx           # Tabs: saisie manuelle + import Auto1
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Détail (galerie, infos, financier, tabs)
│   │   │       └── edit/page.tsx      # Formulaire édition
│   │   └── reports/page.tsx           # Rapports mensuels + export
│   └── api/auto1/import/route.ts      # POST import Auto1
├── components/
│   ├── layout/sidebar.tsx
│   ├── shared/status-badge.tsx
│   ├── ui/                            # shadcn/ui components
│   └── vehicles/
│       ├── vehicle-card.tsx
│       ├── vehicle-form.tsx           # Réutilisable create + edit
│       └── auto1-import-form.tsx
├── lib/
│   ├── actions/
│   │   ├── auth.ts                    # signIn, login, signOut
│   │   ├── vehicles.ts               # CRUD véhicules
│   │   ├── expenses.ts               # CRUD frais
│   │   ├── photos.ts                 # Upload/delete/reorder/setPrimary
│   │   ├── documents.ts              # Upload/delete documents
│   │   ├── history.ts                # getHistory
│   │   ├── vehicle-form.ts           # createVehicleFromForm, updateVehicleFromForm
│   │   ├── dashboard.ts              # getDashboardStats, getRecentActivity
│   │   └── reports.ts                # getMonthlyReport
│   ├── auto1/
│   │   ├── types.ts                   # Types Auto1 (Auto1Vehicle, etc.)
│   │   ├── mapper.ts                  # mapAuto1ToVehicle → VehicleInsert
│   │   ├── mock.ts                    # Mock fetchAuto1Vehicle
│   │   └── client.ts                  # Wrapper MCP (TODO: vrais appels)
│   ├── export/csv.ts                  # generateVehiclesCSV + downloadCSV
│   ├── images/compress.ts             # Client (OffscreenCanvas) + Server (sharp)
│   ├── supabase/
│   │   ├── client.ts                  # createBrowserClient<Database>
│   │   ├── server.ts                  # createServerClient<Database>
│   │   ├── schema.sql                 # 5 tables + RLS + trigger
│   │   └── storage-policies.sql       # 2 buckets + policies
│   └── format.ts                      # formatPrice, formatDate, formatMileage, daysInStock
├── types/database.ts                   # Types Supabase (Vehicle, VehiclePhoto, etc.)
└── middleware.ts                       # Auth guard + redirect logic
```

## Modèle de données
- **vehicles** : infos véhicule + prix (centimes) + statuts + notes
- **vehicle_photos** : url, position, is_primary, imported_from_auto1
- **vehicle_documents** : type (carte_grise/ct/facture/autre), file_url, name
- **vehicle_expenses** : category, amount (centimes), description, date, invoice_url
- **vehicle_history** : action, description, date, created_by

## Calcul financier
```
marge_brute = sale_price - purchase_price - total_expenses
TVA sur marge = marge_brute × 20 / 120  (si brute > 0, sinon 0)
marge_nette = marge_brute - TVA
% marge = marge_nette / sale_price × 100
```

## Patterns clés
- **Server Actions** : 'use server', Zod validation, `as unknown as` cast pour types Supabase, revalidatePath après mutations
- **FormData** : z.coerce pour convertir strings → numbers, parseFormData helper (empty → undefined)
- **Prix** : stockés en centimes, affichés en euros, conversion ×100 au submit du formulaire
- **Auth** : useActionState React 19, middleware Supabase SSR, redirect /login ↔ /dashboard
