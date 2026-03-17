# Decisions Log — Backend (thalassa)

## 2026-03-11 — Session initiale

### Database type format
**Decision**: Écrire le type Database au format exact supabase gen types (avec Relationships, Views, Functions, Enums, CompositeTypes) plutôt qu'un format simplifié.
**Rationale**: Le format simplifié (juste Row/Insert/Update) cause des `never` et `{}` dans les inférences de type. Le format complet est nécessaire pour que `@supabase/supabase-js` v2.99 résolve correctement les types.
**Alternative rejetée**: Utiliser `supabase gen types` — pas possible sans projet Supabase connecté au moment du dev.

### Type assertions Supabase
**Decision**: Utiliser `as unknown as { data: T }` sur toutes les queries Supabase plutôt que `.returns<T>()`.
**Rationale**: `.returns<T>()` ne fonctionne pas de manière fiable avec les queries chaînées (.eq, .order, .single). Les casts `as unknown as` sont plus prévisibles et le linter les ajoute automatiquement.

### Zod v4 avec coerce
**Decision**: Utiliser `z.coerce.number()` dans les schemas de formulaire et `z.int()` dans les schemas API.
**Rationale**: FormData envoie toujours des strings → coerce nécessaire. Les server actions API reçoivent déjà des types corrects → int() suffit.

### Login avec useActionState
**Decision**: Créer une action `login(prevState, formData)` wrapper autour de `signIn(data)`.
**Rationale**: useActionState React 19 attend `(prevState, formData)`. signIn existant accepte `unknown`. Le wrapper extrait email/password du FormData et délègue.

### Storage paths
**Decision**: Chemin fichier `{vehicleId}/{uuid}.{ext}` dans les buckets Storage.
**Rationale**: Groupement par véhicule pour faciliter le nettoyage. UUID empêche les collisions. Extension préservée pour les content-types.
