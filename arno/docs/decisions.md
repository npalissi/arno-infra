# Décisions — Arno

## 2026-03-11 — Architecture initiale

### Prix en centimes (integer)
- **Décision** : Tous les prix stockés en centimes (integer) dans la DB
- **Rationale** : Évite les erreurs de floating point avec les calculs financiers
- **Impact** : UI affiche en euros (÷100), conversion ×100 au submit des formulaires

### TVA sur marge = brute × 20/120
- **Décision** : Formule TVA sur marge pour véhicules d'occasion
- **Rationale** : Régime fiscal VO — la TVA est incluse dans la marge, pas ajoutée dessus
- **Attention** : NE PAS utiliser ×0.2 (20%) — c'est ×20/120

### Supabase type casts
- **Décision** : Utiliser `as unknown as { data: T }` sur les retours Supabase
- **Rationale** : Les types générés par supabase-js ne résolvent pas correctement avec `select('*')` — retourne `{}` au lieu du Row type
- **Alternative considérée** : Générer les types avec `supabase gen types` — à faire en Phase 4

### Zod v4 partout
- **Décision** : `import { z } from 'zod/v4'` dans tous les fichiers
- **Rationale** : Cohérence du codebase, évite les bugs de mismatch entre versions

### CSV format français
- **Décision** : Séparateur point-virgule + BOM UTF-8
- **Rationale** : Standard français pour ouverture directe dans Excel sans import wizard

### Pas de multi-sites, pas de rôles
- **Décision** : Tous les utilisateurs ont les mêmes droits, un seul lieu
- **Rationale** : 2 utilisateurs actuellement, même société. Simplification MVP.

### Photos compressées
- **Décision** : Max 1920px largeur, JPEG 80%, sharp côté serveur
- **Rationale** : Réduire le stockage et le temps de chargement tout en gardant une qualité suffisante

### shadcn/ui base-ui
- **Décision** : Utiliser shadcn/ui avec le backend base-ui (pas radix)
- **Rationale** : Plus léger, meilleur support Next.js 15
- **Gotcha** : Select onValueChange passe string|null — guard `(v) => v && set(v)` nécessaire

### VehicleForm onSubmit type
- **Décision** : Type union `Promise<void> | Promise<{ error: string } | null>` + async wrapper
- **Rationale** : React 19 `<form action>` exige `Promise<void>`, mais server actions retournent `FormActionResult`. Wrapper `async handleSubmit` avec `await onSubmit(formData)` résout le problème sans perte de type safety.

### Conversion euros→centimes dans le form
- **Décision** : `handleSubmit` intercepte le FormData et multiplie ×100 les champs prix avant appel onSubmit
- **Rationale** : UX naturelle (l'utilisateur saisit en euros), DB stocke en centimes. La conversion se fait au dernier moment dans le composant form, pas dans le server action.

## 2026-03-12 — Phase 4

### Auto1 direct HTTP au lieu de MCP
- **Contexte** : Le MCP Auto1 tourne en local via stdio, pas accessible depuis le runtime Next.js
- **Décision** : Reproduire les appels HTTP du MCP directement dans `src/lib/auto1/client.ts`
- **Rationale** : Auto1 n'a pas d'API publique, le MCP fait du scraping authentifié. Même logique reproduite.

### Table vehicle_listings
- **Contexte** : Noah veut pouvoir tracker les liens d'annonces quand un véhicule est en vente
- **Décision** : Nouvelle table vehicle_listings (id, vehicle_id, platform, url, created_at)
- **Rationale** : Table séparée = plus propre pour CRUD, cascade on delete, index sur vehicle_id

### Formulaire edit sans champs required
- **Contexte** : Noah veut modifier un seul champ sans remplir tout le formulaire
- **Décision** : `required={!isEdit}` sur tous les champs du VehicleForm

### service_role key pour scripts admin
- **Contexte** : Le script delete-vehicle.ts échouait avec la clé anon (RLS)
- **Décision** : Utiliser SUPABASE_SERVICE_ROLE_KEY dans les scripts admin

## 2026-03-12 — Photos & Documents

### Tri photos/documents = manuel (pas OCR)
- **Contexte** : Auto1 mélange photos véhicule et documents (carte grise, CT) dans les mêmes galeries
- **Alternatives testées** :
  - Tesseract.js seul : confidence trop basse (~20-40%), rate la majorité des documents
  - Tesseract.js + sharp (grayscale+normalize+sharpen) : détecte 4/17, améliore la confidence
  - Python OpenCV + Tesseract : CLAHE + seuillage adaptatif + contours rectangles, détecte 5/17
  - OSS-DocumentScanner (GitHub) : C++ natif OpenCV, overkill pour notre stack
  - Dynamsoft : SDK payant, pas viable
- **Décision** : Tri manuel post-import via dropdown sur chaque photo
- **Rationale** : 100% fiable, instantané, simple. Sur ~17 photos, trier 3-5 documents prend 10s

### Reclassification photo → document (même URL)
- **Contexte** : Quand l'utilisateur classe une photo comme document
- **Décision** : Déplacer de vehicle_photos vers vehicle_documents sans copier le fichier
- **Rationale** : Le fichier reste dans le bucket vehicle-photos mais l'URL est stockée dans vehicle_documents.file_url. Évite une copie de fichier coûteuse et inutile.

### Auto1 a 3 sources de photos (pas 1)
- **Contexte** : Le parser ne récupérait que gallery.galleryImages (6 photos sur la 208 VM79011)
- **Découverte** : quality.highlightItems (11 photos) et quality.damageItems aussi contiennent des photos
- **Décision** : Mettre à jour le parser pour tout récupérer
- **Impact** : ~3x plus de photos importées par véhicule

## 2026-03-12 — Redesign UI complet

### Direction esthétique "Refined Automotive"
- **Contexte** : Noah trouvait le design trop basique/template shadcn. Voulait "plus pro, plus clair"
- **Décision** : Palette warm charcoal (oklch hue 260°) + accent amber/gold + DM Sans + JetBrains Mono
- **Rationale** : Évoque le luxe automobile, plus chaleureux que le zinc froid. DM Sans est distinctif sans être fantaisiste.
- **Alternatives considérées** : Vert emerald original, Geist font — trop générique pour un outil métier

### Variable --emerald = amber (pas renommée)
- **Contexte** : Le code utilise `bg-emerald`, `text-emerald` partout
- **Décision** : Changer la VALEUR de `--emerald` (oklch 0.76 0.16 84 = amber) sans renommer
- **Rationale** : Évite un renommage massif dans 13+ fichiers. Le nom est sémantiquement "accent primaire".
- **Attention** : `text-emerald-400` (Tailwind built-in) reste VERT — utilisé pour indicateurs positifs (marge +)

### StatusBadge avec dot indicators
- **Contexte** : Badges trop lourds visuellement avec les backgrounds colorés
- **Décision** : Petit dot (1.5) + texte coloré + fond très léger (8% opacity)
- **Couleurs** : en_stock=emerald, en_preparation=sky, en_vente=amber, vendu=zinc

## 2026-03-13 — Redesign UI v2 (light theme)

### Passage au light theme
- **Contexte** : Noah a fourni un HTML de référence complet pour un nouveau design light
- **Décision** : Réécrire tout le design system — dark → light, DM Sans → Inter, amber → brand orange #DE5E36
- **Rationale** : Design plus pro et plus clair, palette warm beige (#F7F5F2) avec cartes blanches
- **Impact** : 13 fichiers réécrits, suppression du dark theme

### Boutons primary = dark (#1A1A1A), pas brand accent
- **Contexte** : Dans le design fourni, les boutons principaux sont noirs, pas orange
- **Décision** : `--primary: #1A1A1A`, brand accent (#DE5E36) réservé au sidebar indicator + liens
- **Rationale** : Le orange en accent subtil est plus élégant que des boutons orange partout

### StatusBadge rectangulaires (plus de dots)
- **Contexte** : Le nouveau design utilise des badges rectangulaires avec fonds colorés
- **Décision** : rounded-[6px], pas de dot indicator, bg colorés opaques
- **Couleurs** : en_stock=#E6F4EA/#1E8E3E, en_preparation=#E8F0FE/#1A73E8, en_vente=#FEF7E0/#B06000, vendu=#F1F3F4/#5F6368

### Ajout variable CSS --positive et --brand
- **Contexte** : Besoin de distinguer brand accent (orange) et positive (vert pour marges)
- **Décision** : `--brand: #DE5E36`, `--positive: #059669` — nouvelles variables
- **Rationale** : Plus clair que de réutiliser `text-emerald-400` (Tailwind) pour le vert

## 2026-03-13 — Session UI polish + Frais CRUD

### Font-weight minimum 500
- **Contexte** : Noah trouvait Inter trop fine en 400, "fait mal aux yeux"
- **Décision** : `font-medium` (500) sur body dans globals.css — aucun texte en 400
- **Rationale** : Inter est conçue pour être lisible en 400 sur écran, mais sur ce type d'interface métier le 500 est plus confortable

### Page détail véhicule — layout 3 colonnes compact
- **Contexte** : La photo prenait tout l'écran, il fallait scroller pour voir les infos
- **Décision** : Layout `lg:grid-cols-[280px_1fr_320px]` — photo carrée compacte | infos | financier
- **Rationale** : Dashboard compact, pas page produit e-commerce. Tout visible sans scroll.
- **Impact** : PhotoGallery accepte un prop `compact` (image carrée, thumbnails 52px, pas d'action bar)

### Section Frais sortie des tabs
- **Contexte** : Les frais étaient cachés dans un tab, impossible d'en ajouter facilement
- **Décision** : Section Frais toujours visible entre le bloc 3-colonnes et les tabs (Documents/Historique/Annonces)
- **Rationale** : C'est une fonctionnalité essentielle, pas un détail à cacher

### ExpenseForm réutilisable (ajout + édition)
- **Contexte** : Besoin d'ajouter ET modifier des frais avec le même formulaire
- **Décision** : Composant `ExpenseForm` avec prop `expense?` optionnel — même UI pour les 2 cas
- **Rationale** : DRY, cohérence UX, bouton "Mettre à jour" vs "Enregistrer" selon le mode

### Factures dans bucket vehicle-documents (pas nouveau bucket)
- **Contexte** : Les factures sont des documents véhicule
- **Décision** : Upload via `/api/upload-invoice` vers le bucket `vehicle-documents` existant
- **Rationale** : Policies Storage déjà en place, pas besoin d'un bucket séparé
- **Chemin** : `{vehicleId}/{uuid}.{ext}`

### Traçabilité complète des frais dans vehicle_history
- **Contexte** : Noah voulait que la suppression de frais soit tracée dans l'historique
- **Décision** : 3 entrées auto : `ajout_frais`, `modification_frais`, `suppression_frais`
- **Description** : Inclut catégorie + montant (ex: "Frais supprimé : Mécanique — 350.00 €")

### Fix hydration mismatch base-ui — mounted guard
- **Contexte** : IDs `base-ui-_R_...` différents SSR/client → warnings console
- **Décision** : `useState(false)` + `useEffect(setMounted)` → composants rendus uniquement après montage
- **Composants** : Sheet (layout.tsx), Select ×2 (vehicles-client.tsx)
- **Alternative rejetée** : `suppressHydrationWarning` — masque le problème sans le résoudre
