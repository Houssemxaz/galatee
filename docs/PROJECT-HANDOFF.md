# Galatee - guide de lecture et de mise en production

Ce document est destiné à la personne qui reprend le projet côté backend,
infrastructure et mise en production. Il décrit l'état réel du code au
29 septembre 2026 et complète `AGENTS.md`, `DEPLOY.md` et
`docs/DEPLOYMENT-MONO-VPS.md`.

## 1. Vue d'ensemble

Galatee est une application de restauration composée de trois espaces:

- le site public React pour le menu, les comptes clients, les commandes et le
  club fidélité;
- le back-office React pour les commandes, le menu, les livreurs, la livraison,
  les promotions, la fidélité et les statistiques;
- la PWA livreur React, accessible sous `/livreur`, pour la connexion PIN, les
  courses, les changements de statut et les statistiques du livreur.

Le backend est un serveur HTTP natif Node.js. Il sert l'API `/api/*` et le build
statique de `frontend-react/dist/`. Il n'y a pas d'Express à maintenir.

## 2. Stack technique

- Node.js 24 ou plus récent.
- React 19 + Vite dans `frontend-react/`.
- Base locale: `node:sqlite`, pratique pour le développement et les tests.
- Base de production: PostgreSQL via l'adaptateur synchrone
  `backend/postgres/syncDatabase.js`.
- Redis optionnel pour partager le rate limiting et l'idempotence entre
  plusieurs instances backend.
- Docker Compose pour PostgreSQL, l'application et, si nécessaire, Redis.
- Playwright pour les parcours E2E.

Le serveur sélectionne le moteur avec `GALATEE_DATABASE`:

- absent ou `sqlite`: fichier local `backend/data/galatee.sqlite`;
- `postgres`: `DATABASE_URL` est obligatoire et l'application utilise
  PostgreSQL.

En `NODE_ENV=production`, le serveur refuse volontairement de démarrer avec
SQLite. Cela évite de croire que les données locales sont les données client.

## 3. Arborescence utile

```text
backend/
  server.js                  Point d'entrée HTTP et routage API
  *System.js                 Services métier et schémas de compatibilité
  rateLimit.js               Limiteurs mémoire/Redis
  idempotency.js             Protection des créations de commande répétées
  security.js                CORS, headers, IP, logs et tokens
  schema.sql                 Schéma SQLite historique
  postgres/                  Schéma et migration vers PostgreSQL
frontend-react/
  src/pages/                 Pages publiques
  src/backoffice/            Application back-office et ses sections
  src/driver/                PWA livreur
  src/lib/                   Adaptateurs API et calculs partagés
  dist/                      Build généré, ignoré par Git
deploy/
  env.production.example     Variables sans secret
  check-production-config    Validation avant démarrage
  backup-postgres.sh         Sauvegarde PostgreSQL
docs/
  DEPLOYMENT-MONO-VPS.md     Procédure Docker mono-VPS
  PROJECT-HANDOFF.md         Ce guide
e2e/
  tests/                     Scénarios Playwright
tasks/
  todo.md                    Historique des tâches
  lessons.md                 Leçons de maintenance et de correction
```

## 4. Démarrage local

Depuis la racine:

```powershell
npm install
npm start
```

Le serveur local est disponible sur `http://localhost:3000`. Pour travailler
sur le frontend avec Vite dans un autre terminal:

```powershell
npm run dev
```

Le frontend utilise `/api` quand il est servi par le backend. Pour un frontend
Vite séparé, configurer `VITE_API_BASE` avec le préfixe `/api` inclus.

Le mode local peut fonctionner sans `GALATEE_ADMIN_TOKEN`, mais les routes
`/api/admin/*` sont alors ouvertes. Ne jamais exposer ce mode sur Internet.

## 5. Tests et build

```powershell
npm test
npm run build
npm run test:e2e
```

`npm test` couvre les services métier, la sécurité, le rate limiting,
l'idempotence, PostgreSQL et les routes HTTP. `npm run test:e2e` reconstruit le
frontend et lance un serveur isolé avec une base SQLite temporaire.

Avant toute release, vérifier aussi:

```powershell
npm run predeploy:check -- .env.production
git diff --check
```

## 6. Contrats backend importants

Les systèmes métiers sont initialisés dans `backend/server.js` puis injectés
dans `createApp`, ce qui permet de tester les routes avec des bases et services
temporaires. Les principaux domaines sont:

- `menuSystem`: plats, prix, disponibilité, publication et images;
- `orderSystem`: panier, prix, promotions, fidélité, livraison et transitions;
- `loyaltySystem`: seuils de commandes et récompenses;
- `promotionsSystem`: promotions directes indépendantes de la fidélité;
- `driverSystem`: livreurs, sessions, PIN, affectations et courses;
- `analyticsSystem`: événements, commandes, chiffre d'affaires et statistiques;
- `customerAuthSystem`: comptes, codes, mots de passe et sessions;
- `clubSystem`: contenu du Pasta Lover Club.

Les nouveaux endpoints doivent préserver les contrats existants et les données
historiques. Toute modification de schéma PostgreSQL doit être reflétée dans
`backend/postgres/schema.sql`, la migration et les tests associés.

## 7. Authentification, autorisation et sécurité

- Les comptes clients utilisent des sessions stockées côté serveur et un cookie
  HttpOnly. Les mots de passe sont dérivés avec `scrypt` et les codes sont
  hachés.
- Les livreurs utilisent un PIN haché, une session HttpOnly et un verrouillage
  temporaire après cinq échecs.
- Le back-office utilise actuellement un Bearer token fourni par
  `GALATEE_ADMIN_TOKEN`. La comparaison utilise `timingSafeEqual`.
- En production, le token admin et une origine CORS explicite sont obligatoires.
- Les mutations livreur vérifient l'origine web configurée.
- Les headers de sécurité et l'identifiant de requête sont ajoutés par
  `backend/security.js`.

Rate limiting actuel:

| Domaine | Fenêtre | Limite par IP |
| --- | ---: | ---: |
| Authentification client/livreur | 15 min | 20 |
| Création de commande | 1 min | 8 |
| Analytics publique | 1 min | 60 |
| Upload image menu | 1 min | 10 |
| API admin | 1 min | 120 |

Sans `REDIS_URL`, ces compteurs sont en mémoire dans le processus Node. Cela
convient à un seul VPS avec une seule instance, mais les compteurs sont perdus
au redémarrage et ne sont pas partagés entre plusieurs instances. Avec Redis,
les compteurs et les clés d'idempotence deviennent partagés et atomiques.

## 8. Déploiement mono-VPS recommandé

1. Installer Docker et Docker Compose sur un VPS Linux maintenu.
2. Copier `deploy/env.production.example` vers `.env.production` et remplacer
   chaque `CHANGE_ME` par une vraie valeur.
3. Définir un `GALATEE_ADMIN_TOKEN` long et aléatoire, une URL HTTPS dans
   `GALATEE_ALLOWED_ORIGIN` et une `DATABASE_URL` cohérente avec Compose.
4. Démarrer PostgreSQL et attendre son health check:

   ```bash
   docker compose up -d postgres
   docker compose ps
   ```

5. Vérifier puis importer une copie de la base SQLite historique avec les
   commandes décrites dans `docs/DEPLOYMENT-MONO-VPS.md`.
6. Démarrer l'application:

   ```bash
   docker compose up -d app
   curl -fsS http://127.0.0.1:3000/health/live
   curl -fsS http://127.0.0.1:3000/health/ready
   ```

7. Placer Caddy ou Nginx devant le port local 3000 pour terminer HTTPS. Le
   port 3000 ne doit pas être publié directement sur Internet.
8. Mettre en place les sauvegardes PostgreSQL et tester une restauration sur
   une base distincte avant de considérer la sauvegarde fiable.

Redis est facultatif pour la première installation mono-instance. Il devient
recommandé si plusieurs conteneurs backend sont lancés, si un équilibrage de
charge est ajouté ou si le rate limiting doit survivre aux redémarrages.

## 9. Variables de production à connaître

- `NODE_ENV=production`: active les garde-fous de démarrage.
- `GALATEE_DATABASE=postgres`: sélectionne PostgreSQL.
- `DATABASE_URL`: connexion PostgreSQL de l'application.
- `GALATEE_ADMIN_TOKEN`: secret du back-office.
- `GALATEE_ALLOWED_ORIGIN`: origine exacte du frontend, sans chemin `/api`.
- `GALATEE_UPLOAD_DIR`: chemin persistant des images menu dans le conteneur.
- `TRUST_PROXY`: nombre de proxies de confiance, à régler seulement si le
  reverse proxy transmet correctement `X-Forwarded-For`.
- `REDIS_URL`: active le store partagé; laisser vide en mono-instance si voulu.
- `REDIS_KEY_PREFIX`: préfixe isolant les clés de cette installation.
- `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`: envoi des emails de
  comptes clients, si cette fonctionnalité est activée.

## 10. Points ouverts à surveiller

- Exécuter la migration PostgreSQL sur la base de production après achat et
  initialisation du VPS.
- Décider si Redis est activé dès le premier déploiement ou seulement lors d'un
  passage à plusieurs instances.
- Déplacer le verrouillage PIN livreur vers Redis si plusieurs instances sont
  utilisées.
- Ajouter, si nécessaire, une limite par compte en plus de la limite IP pour
  les tentatives de mot de passe distribuées.
- Vérifier les sauvegardes, les logs, le renouvellement TLS, les permissions du
  volume d'upload et la procédure de rollback avec le client.

## 11. Ordre de lecture conseillé

1. `AGENTS.md` pour les règles de contribution.
2. Ce fichier pour comprendre l'architecture et les décisions actuelles.
3. `backend/server.js`, `backend/security.js`, `backend/rateLimit.js` et
   `backend/idempotency.js` pour le périmètre HTTP et sécurité.
4. `backend/postgres/README.md` et `docs/DEPLOYMENT-MONO-VPS.md` pour la base et
   le déploiement.
5. `frontend-react/src/backoffice/BackofficeApp.jsx` et
   `frontend-react/src/driver/DriverApp.jsx` pour les deux espaces métier.
6. Les tests correspondants avant toute modification d'API.
