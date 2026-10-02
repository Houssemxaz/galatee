# Galatee - roadmap complète du projet

Document de passation pour la finalisation technique, la mise en production et
le suivi post-lancement. La branche de travail actuelle est
`feat/postgresql-migration`.

## 0. État actuel

### Stack

- Frontend: React 19 + Vite dans `frontend-react/`.
- Backend: serveur HTTP natif Node.js 24 dans `backend/server.js`.
- Développement/tests: SQLite avec `node:sqlite`.
- Production prévue: PostgreSQL via `backend/postgres/`.
- Déploiement prévu: Docker Compose sur un VPS unique.
- Redis: optionnel sur une instance, recommandé avec plusieurs instances.
- Tests: tests Node et scénarios Playwright E2E.

### Déjà réalisé

- Site public, menu, commande, comptes clients et historique.
- Back-office: commandes, menu, livraison, livreurs, fidélité, promotions,
  club et statistiques.
- PWA livreur mobile et version desktop.
- Cycle de livraison avec annulation finale et chiffres cohérents.
- Promotions directes séparées de la fidélité, par plat ou par pack.
- Authentification client et livreur avec sessions sécurisées.
- Headers de sécurité, CORS, request IDs, rate limiting, idempotence et health
  checks.
- Adaptateur PostgreSQL, schéma et outil de migration SQLite vers PostgreSQL.
- Packaging Docker, Compose mono-VPS, sauvegarde et contrôle de configuration.
- Tests E2E isolés et documentation de déploiement.
- Dernière vérification: 72 tests backend passants et build frontend réussi.

## 1. Revue de branche et gel fonctionnel

**Objectif:** choisir la version livrée et éviter les divergences.

1. Travailler sur `feat/postgresql-migration`, qui contient la version la plus
   récente.
2. Comparer cette branche avec `origin/main`, car les historiques ont divergé.
3. Vérifier que géolocalisation, alertes sonores, E2E, optimisation bundle et
   runbook sont présents dans la release.
4. Geler les nouvelles fonctionnalités pendant la migration et le déploiement.
5. Créer une branche de release à partir de la version validée.

**Sortie attendue:** un commit de release unique, revu et identifié.

## 2. Validation fonctionnelle finale

**Client:** menu, fiche plat, panier, promotion, fidélité, livraison/retrait,
commune, tarif, commande idempotente, confirmation et historique.

**Back-office:** modifier/publication d’un plat, prix, tarif de livraison,
promotion par plat/pack, règle fidélité, commandes, affectation livreur,
statistiques et modes clair/sombre.

**Livreur:** connexion PIN, blocage après cinq erreurs, course disponible,
prise, préparation, départ, livraison, annulation, compteurs et affichage
mobile/desktop.

**Sortie attendue:** aucun blocage critique et chaque transition est visible
dans l’historique attendu.

## 3. Migration PostgreSQL

1. Faire une copie immuable de la base SQLite source.
2. Vérifier le manifeste:

   \`\`\`bash
   npm run db:postgres:verify
   \`\`\`

3. Démarrer PostgreSQL en préproduction.
4. Importer la copie avec `POSTGRES_MIGRATION_CONFIRM=YES`.
5. Vérifier commandes, plats, prix, communes, comptes, promotions, fidélité
   et statistiques.
6. Rejouer l’import sur une base vide pour confirmer la reproductibilité.

**Sortie attendue:** les compteurs correspondent et `/health/ready` indique
`databaseMode: postgres`.

## 4. Préparation du VPS

- acheter et initialiser un VPS Linux maintenu;
- créer un utilisateur non-root avec clé SSH;
- activer les mises à jour de sécurité et le pare-feu;
- n’exposer publiquement que SSH limité, HTTP et HTTPS;
- installer Docker et Docker Compose;
- installer Caddy ou Nginx pour HTTPS;
- faire pointer le domaine vers le VPS;
- ne pas exposer directement PostgreSQL, Redis ou le port 3000.

**Sortie attendue:** le VPS est accessible en SSH, le domaine résout vers le
serveur et les services internes restent privés.

## 5. Secrets et configuration de production

Créer `.env.production` depuis `deploy/env.production.example`, sans le
committer. Définir au minimum:

- `NODE_ENV=production`;
- `GALATEE_DATABASE=postgres`;
- `DATABASE_URL`;
- `GALATEE_ADMIN_TOKEN` fort et aléatoire;
- `GALATEE_ALLOWED_ORIGIN` avec l’origine HTTPS exacte;
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`;
- `GALATEE_UPLOAD_DIR` persistant;
- variables Brevo si les emails sont activés.

Valider sans afficher les secrets:

\`\`\`bash
npm run predeploy:check -- .env.production
\`\`\`

Redis peut rester désactivé sur une seule instance. Il devient recommandé
pour plusieurs instances, un équilibrage de charge ou un rate limiting partagé.

**Sortie attendue:** aucune valeur `CHANGE_ME`, URL HTTP ou secret dans les
fichiers suivis.

## 6. Déploiement Docker

\`\`\`bash
docker compose up -d postgres
docker compose ps
docker compose run --rm \
  -v /srv/galatee/migration:/migration:ro \
  -e SQLITE_DATABASE_PATH=/migration/galatee.sqlite \
  -e POSTGRES_MIGRATION_CONFIRM=YES \
  app npm run db:postgres:import
docker compose up -d app
curl -fsS http://127.0.0.1:3000/health/live
curl -fsS http://127.0.0.1:3000/health/ready
\`\`\`

Configurer ensuite le reverse proxy HTTPS et vérifier `/`, `/menu`,
`/backoffice`, `/livreur`, `/robots.txt`, `/sitemap.xml` et les deux
health checks.

**Sortie attendue:** conteneurs sains, application accessible en HTTPS et port
3000 non public.

## 7. SEO et visibilité

Le projet possède déjà `SEO.jsx`, titles, descriptions, canonical, Open Graph,
`sitemap.xml`, `robots.txt` et des données structurées Restaurant.

1. Confirmer le domaine canonique `https://galatee.dz`.
2. Vérifier la propriété Google Search Console.
3. Soumettre le sitemap.
4. Créer ou revendiquer Google Business Profile.
5. Uniformiser nom, adresse, téléphone, horaires et zones de livraison.
6. Tester les données structurées avec Google et Schema.org.
7. Auditer les pages après rendu React et pas seulement le HTML initial.
8. Vérifier mobile, images, textes alternatifs et Core Web Vitals.

Claude SEO peut aider à auditer ces points, mais ne remplace pas la validation
des informations métier ni le déploiement sur un domaine public.

**Sortie attendue:** sitemap accepté, fiche locale complète et aucune erreur
SEO critique.

## 8. Sauvegarde, supervision et sécurité

- sauvegarde PostgreSQL quotidienne;
- copie des sauvegardes hors du VPS;
- test de restauration mensuel sur une base distincte;
- volume persistant pour les images menu;
- surveillance de `/health/live` et `/health/ready`;
- rotation des tokens et mots de passe de services;
- logs sans cookies, tokens, PIN ou mots de passe;
- renouvellement TLS vérifié;
- test du rate limiting après redémarrage;
- Redis activé avant de multiplier les instances backend.

**Sortie attendue:** restauration complète testée et procédure documentée.

## 9. Recette avant ouverture

Tester sur téléphone et desktop:

- livraison et retrait;
- tarifs par commune;
- prix avec promotion et fidélité;
- commande visible dans le back-office;
- affectation et parcours livreur;
- livraison confirmée et annulation;
- statistiques et CA cohérents;
- emails/notifications;
- absence d’erreur console et réseau;
- restauration d’une sauvegarde.

**Sortie attendue:** validation écrite du restaurant et aucun problème bloquant
ou critique ouvert.

## 10. Mise en ligne et rollback

### Mise en ligne

1. Figer la base source et faire la sauvegarde finale.
2. Importer PostgreSQL.
3. Démarrer la version release.
4. Vérifier les health checks et une commande contrôlée.
5. Surveiller logs et commandes pendant les premières heures.

### Rollback

- revenir à l’image Docker précédente si le problème vient du code;
- restaurer PostgreSQL dans une base distincte si le problème vient des données;
- ne jamais réécrire directement les tables historiques;
- conserver le commit et l’image de chaque déploiement.

## 11. Après lancement

### Première semaine

- surveiller commandes, erreurs et temps de réponse;
- comparer statistiques et réalité du restaurant;
- vérifier les emails;
- suivre l’indexation dans Search Console;
- corriger les problèmes clients et livreurs.

### Premier mois

- activer Redis si la charge le justifie;
- renforcer le blocage par compte des tentatives de mot de passe;
- ajouter métriques serveur et alertes;
- analyser recherches locales et plats demandés;
- planifier les mises à jour Node, Docker, PostgreSQL et dépendances.

## 12. Ordre de lecture conseillé

1. `AGENTS.md`.
2. `docs/PROJECT-HANDOFF.md`.
3. Ce fichier.
4. `backend/server.js`, `backend/security.js`, `backend/rateLimit.js`.
5. `backend/postgres/README.md` et `docs/DEPLOYMENT-MONO-VPS.md`.
6. `deploy/env.production.example` et `deploy/check-production-config.mjs`.
7. Les tests backend puis `e2e/tests/`.

