# CLAUDE.md — Galatée (Pasta by Galatée)

> **Ce fichier est lu automatiquement par Claude Code au démarrage de chaque session.**
> Il est la source de vérité partagée entre les deux Claude qui bossent sur ce repo
> (celui de Houssem et celui de son collègue). À maintenir à jour à chaque décision
> structurelle.

## 🎯 Projet

**Pasta by Galatée** — Trattoria italienne à Hydra, Alger. Site web + backoffice + backend
Node/SQLite. Le client final est non-technique et gère la carte via le backoffice.

- Repo : https://github.com/Houssemxaz/galatee
- Branche principale : `main`
- Devs : Houssem (owner) + un collègue, assistés chacun d'un Claude Code.

## 🤝 Règles de collaboration Git

Les deux Claude bossent sur le même repo. Pour éviter d'écraser le travail de l'autre :

1. **Toujours pull avant de démarrer une session**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Jamais de commit direct sur `main`.** Toujours une branche feature :
   ```bash
   git checkout -b feat/nom-clair   # ou fix/, refactor/, chore/
   ```

3. **Push régulièrement** (toutes les ~1h de travail) et **ouvrir une Pull Request**
   sur GitHub. Pas de merge direct depuis local.

4. **PAS de zip par mail/WhatsApp** entre nous. Tout passe par Git. Un zip risque
   d'écraser des semaines de refonte silencieusement.

5. **En cas de conflit de merge** : lire les deux versions, comprendre les intentions,
   faire un merge propre. Jamais `--force` sur `main`.

6. **Avant de push** :
   ```bash
   cd backend && npm test              # 68/68 tests doivent passer
   cd frontend-react && npm run build  # doit build sans erreur
   ```

7. **Messages de commit clairs, en français, atomiques** :
   - `feat(auth): flow reset password`
   - `fix(menu): pluralisation pièces`
   - `refactor(backoffice): migration vers Geist`

## 🎨 Design system — À respecter STRICTEMENT

### Site public (`frontend-react/src/pages/*`, `App.css`)

- **Palette** : olive/tomate/crème
  - `--charcoal` (encre), `--accent` (tomate), `--paper` (crème)
  - `--basil` (vert basilic), `--gold` (doré chaleureux)
- **Fonts** : Antonio Bold (display) + DM Sans (body) + Caveat (script manuscrit)
- **Composants signature** : `ShineCTA`, `PopCTA`, `GlowCard`, `TiltCard`, `Slideover`
- **Animations** : Framer Motion + `Reveal.jsx` avec fallback 250ms. Respecter
  `prefers-reduced-motion`.
- **Identité** : trattoria méditerranéenne assumée, `PASTA. MUSIC. MEMORIES.`

### Backoffice (`frontend-react/src/backoffice/*`)

- **Palette** : zinc + emerald (Linear-like, tech premium SaaS)
- **Fonts** : Geist Sans + Geist Mono (Vercel)
- **Composants clés** : tables Linear-like, Slideover, Cmd+K palette, skeleton loaders,
  empty states, StatusBadge, SortableTh
- **Style** : sobre, dense, aucune emphase émotionnelle. Look "logiciel de gestion pro".

## 🚫 NE PAS TOUCHER sans coordination explicite

- **`backend/menuSystem.js` → `DEFAULT_MENU` + `LEGACY_TO_CANONICAL`**
  Contient les 3 plats canoniques : `spaghetti-pomodoro`, `spaghetti-carbonara`,
  `tiramisu-me-up`. Migration legacy en place. Toucher ça peut faire réapparaître
  d'anciens plats (Tagliolini/Ravioli/Tortelli) qui ne doivent plus exister.

- **`frontend-react/src/lib/api.js` → `PBG_CANONICAL_MENU` + `LEGACY_TO_CANONICAL`**
  Mirror frontend du seed. Cohérence à maintenir avec le backend.

- **Backoffice tech premium** (`frontend-react/src/backoffice/`)
  Refonte complète zinc/emerald + Geist + Cmd+K + slide-over déjà en place.
  Modifier avec parcimonie.

- **SEO** : `react-helmet-async` + JSON-LD Restaurant/Menu déjà implémentés.
  Ne pas casser les schemas.

- **Nav bar transparente** : liste des routes dans `SiteHeader` :
  `/commande`, `/compte`, `/pasta-lover-club`, `/contact`. Ne pas ajouter/retirer
  sans raison.

## 📁 Fichiers partagés à haute friction

Avant de toucher massivement ces fichiers, **coordonner via WhatsApp/Slack** :

- `frontend-react/src/App.css` (~3300 lignes)
- `frontend-react/src/lib/api.js`
- `backend/server.js`
- `backend/menuSystem.js`
- `frontend-react/src/pages/AccountPage.jsx`
- `frontend-react/src/pages/OrderPage.jsx`

Les deux Claude ne doivent PAS travailler simultanément dans le même fichier.

## 🧪 Tests

- Backend : `cd backend && npm test` (68 tests, tous doivent passer)
- Frontend : `cd frontend-react && npm run build` (doit build sans erreur)
- Test manuel obligatoire pour les changements UI : lancer les deux servers
  (`node backend/server.js` + `npm run dev` dans `frontend-react/`) et valider
  visuellement.

## 🌐 Servers de dev

- **Backend** : `cd backend && node server.js` (port 3000)
- **Frontend** : `cd frontend-react && npm run dev -- --host 0.0.0.0` (port 5173)
- Base SQLite : `backend/data/galatee.sqlite` (WAL mode, ne pas supprimer)

## 📝 Langue

- **Français** partout : commits, PR, commentaires, UI, docs.
- **Accents obligatoires** : "Galatée" jamais "Galatee". "à", "é", "ç" toujours.
- **Pluriels corrects** : `${n} pièce${n > 1 ? "s" : ""}` (pas de "1 pièces").

## 🔑 Variables d'environnement

- `GALATEE_ADMIN_TOKEN` : token admin backoffice (à définir en prod)
- `VITE_API_BASE` : base URL API frontend (défaut `/api`)

## 📌 Décisions récentes (à ne pas défaire)

- **2026-09** : Merge de `password-reset-and-archive-restore` (reset mot de passe
  + restauration items archivés).
- **2026-09** : Refonte tech premium du backoffice (zinc/emerald, Geist).
- **2026-09** : Migration des images menu vers WebP (14 MB → 854 KB, sharp).
- **2026-09** : SEO complet (react-helmet-async, JSON-LD Restaurant/Menu, sitemap).
- **2026-09** : Fix nav bar transparente pour `/contact`.
- **2026-09** : Correction pluralisation "1 pièce" et accents "Galatée".

## 🆘 En cas de doute

- Lire ce fichier en premier
- Regarder `git log --oneline -20` pour comprendre le contexte récent
- Regarder les fichiers `tasks/todo.md` et `tasks/lessons.md` (workflow Houssem)
- Demander au dev humain avant de faire un choix structurel

---

**Dernière mise à jour** : 2026-09-24
**Mainteneurs** : Claude (Houssem) + Claude (collègue)
