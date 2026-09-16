# Instructions Galatee

## Avant de travailler

Lire `tasks/lessons.md` et `tasks/todo.md` avant toute modification. Pour une tâche en plusieurs étapes, écrire un plan dans `tasks/todo.md` avant de coder.

## Architecture

- Backend Node.js 24+ avec serveur HTTP natif et `node:sqlite`; ne pas remplacer Express ni migrer la base sans demande explicite.
- Frontend Vite + React 19 dans `frontend-react/`.
- `backend/server.js` sert l'API et le build statique `frontend-react/dist/`.
- Les mockups de `frontend-react/public/mockups/` sont statiques et ne doivent pas être modifiés sans demande.

## Collaboration

- Claude Code travaille prioritairement sur le frontend, le design et les mockups.
- Les changements backend, API, base de données et sécurité doivent être coordonnés avant fusion.
- Préserver les contrats API et les données historiques; ne pas supprimer les anciennes tables de réservation sans migration planifiée.
- Ne jamais committer de secrets, données personnelles réelles, base SQLite, logs ou fichiers générés.
- Utiliser `apply_patch` pour les modifications manuelles.

## Vérification

Après une modification fonctionnelle, lancer depuis la racine:

```powershell
npm test
npm run build
```

Après une correction, ajouter une leçon datée dans `tasks/lessons.md`.
