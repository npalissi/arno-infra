# Debugging Notes

## Auto1 "invalid input syntax for type integer: 113 116"
- **Cause** : L'API Auto1 retourne les nombres avec des espaces comme séparateurs de milliers (ex: `"113 116"` pour le kilométrage)
- **Fix** : `parseNum()` dans client.ts qui strip les espaces avant parseInt
- **Champs affectés** : km, horsepower, kw, doorCount, seats, handoverKeyCount, carPreownerCount

## .env.local mot de passe tronqué
- **Cause** : `AUTO1_PASSWORD=#Jfp14081969` — le `#` est interprété comme début de commentaire
- **Fix** : Guillemets : `AUTO1_PASSWORD="#Jfp14081969"`
- **Symptôme** : "AUTO1_EMAIL ou AUTO1_PASSWORD manquant dans .env.local" alors qu'ils sont bien présents

## Supabase RLS bloque les scripts admin
- **Cause** : La clé anon n'a pas de session auth → RLS rejette toutes les requêtes
- **Fix** : Utiliser `SUPABASE_SERVICE_ROLE_KEY` dans les scripts
- **Symptôme** : "Cannot coerce the result to a single JSON object" / véhicule introuvable

## Base UI nativeButton warning
- **Cause** : `<Button render={<Link>}>` rend un `<a>` au lieu d'un `<button>`
- **Fix** : Ajouter `nativeButton={false}` aux Button qui utilisent render avec Link
- **Fichiers** : `vehicles-client.tsx:62`, `detail-client.tsx:361`
