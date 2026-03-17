# Tâche courante — Post-session 2026-03-13

## Status: UI polish + frais CRUD + hydration fix TERMINÉS. Prochaine tâche = parser Auto1.

## Ce qui a été fait cette session (2026-03-13)

### 1. Redesign page Véhicules (inventaire)
- KPIs mis à jour : "En stock", "Achetés" (ce mois), "Vendus", "Marge nette" (en vert #059669)
- Calcul marge nette = brute - TVA sur marge, agrégé depuis les véhicules vendus
- Labels financiers raccourcis sur vehicle cards : "Achat" / "Total" / "Total est." / "Prix affiché"
- Hover shadow renforcée : `0 8px 30px rgba(0,0,0,0.08)`
- Section title "Parc Automobile" retirée

### 2. Font-weight 500 global
- `font-medium` ajouté sur `body` dans `src/app/globals.css`
- Plus aucun texte en font-weight 400

### 3. Page détail véhicule — layout compact 3 colonnes
- Layout `lg:grid-cols-[280px_1fr_320px]` : photo compacte (carré) | infos | résumé financier
- PhotoGallery mode `compact` : image carrée, thumbnails 52px, action bar masquée
- Tout visible au-dessus du fold

### 4. Section Frais CRUD complet
- Sortie des tabs → toujours visible entre le bloc 3-colonnes et les tabs
- **Ajout** : formulaire inline (catégorie, montant €, date, description, facture optionnelle)
- **Édition** : bouton crayon au hover → formulaire inline pré-rempli (composant `ExpenseForm` réutilisable)
- **Suppression** : bouton poubelle au hover + entrée historique `suppression_frais`
- Entrée historique auto : `ajout_frais`, `modification_frais`, `suppression_frais`
- Catégories prédéfinies : Mécanique, Carrosserie, Pneus, CT, Nettoyage, Transport, Carte grise, Autre

### 5. Upload factures
- API route `POST /api/upload-invoice` — upload vers bucket `vehicle-documents`
- Champ fichier dans formulaire d'ajout/édition de frais (PDF/JPG/PNG/WebP)
- Gestion facture après coup sur frais existant :
  - Pas de facture → icône Upload au hover pour en ajouter une
  - Facture existante → icône trombone cliquable + croix pour supprimer
  - En édition → bouton "Remplacer la facture..."

### 6. Fix hydration mismatch base-ui
- `mounted` state + `useEffect` sur `layout.tsx` (Sheet) et `vehicles-client.tsx` (2 Select)
- Composants base-ui rendus uniquement après montage client

### Build OK — 11 routes

## Prochaines étapes

1. **Parser Auto1 complet** — `src/lib/auto1/client.ts:147-155` — ajouter highlightItems + damageItems
2. **Deploy Vercel**
3. **Polish UI / bugs** — tester avec données réelles, responsive mobile
