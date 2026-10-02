# Déploiement mono-VPS

Cette procédure prépare un VPS unique pour le frontend compilé, le backend Node
et PostgreSQL. Redis reste optionnel tant qu'une seule instance backend tourne.

## Préparer le VPS

Installer Docker et Docker Compose sur une distribution Linux maintenue, puis
placer le projet dans un répertoire de déploiement, par exemple
`/srv/galatee`. Copier `deploy/env.production.example` vers
`.env.production` et remplacer toutes les valeurs `CHANGE_ME`.

Ne jamais transférer `.env.production` dans Git et ne jamais afficher sa valeur
dans un ticket ou un terminal partagé.

Avant de démarrer Docker, contrôler la configuration sans afficher les secrets:

```bash
npm run predeploy:check -- .env.production
```

La commande bloque les valeurs d'exemple, les origines HTTP, les URL PostgreSQL
incohérentes et les chemins d'upload non absolus. Elle signale aussi les emails
Brevo incomplets et Redis désactivé sans empêcher le scénario mono-instance.

## Première initialisation

```bash
docker compose up -d postgres
docker compose ps
```

La base PostgreSQL doit être saine avant la migration. La migration de la base
SQLite actuelle se fait depuis une copie vérifiée, jamais depuis la base en
production en cours d'utilisation:

```bash
docker compose run --rm \
  -v /srv/galatee/migration:/migration:ro \
  -e SQLITE_DATABASE_PATH=/migration/galatee.sqlite \
  -e POSTGRES_MIGRATION_CONFIRM=YES \
  app npm run db:postgres:import
```

La commande doit être exécutée une seule fois sur une base PostgreSQL neuve.
Avant `--apply`, lancer localement `npm run db:postgres:verify` et conserver le
hash SHA-256 et le nombre de lignes produits par la vérification.

## Démarrer l'application

```bash
docker compose up -d app
docker compose ps
curl -fsS http://127.0.0.1:3000/health/live
curl -fsS http://127.0.0.1:3000/health/ready
```

Le reverse proxy HTTPS (Caddy ou Nginx) sera placé devant le port local 3000.
Le port 3000 ne doit pas être exposé directement sur Internet.

## Sauvegarde et restauration

Créer une sauvegarde quotidienne avec `deploy/backup-postgres.sh`, puis copier
les archives hors du VPS. Une sauvegarde n'est validée qu'après un test de
restauration sur une base distincte.

```bash
BACKUP_DIR=/srv/galatee/backups ./deploy/backup-postgres.sh
```

En cas de problème, arrêter l'application, restaurer la sauvegarde dans une
base neuve, vérifier les compteurs, puis redémarrer une version compatible du
backend. On ne fait pas de rollback improvisé du schéma PostgreSQL.

## Redis partagé

Activer Redis seulement pour plusieurs instances backend:

```bash
docker compose --profile shared up -d redis
```

Dans ce cas, renseigner `REDIS_URL` avec l'hôte `redis` du réseau Compose et
redémarrer `app`. Le health check ready doit alors confirmer la disponibilité du
store partagé.
