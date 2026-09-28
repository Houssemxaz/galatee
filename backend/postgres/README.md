# Migration PostgreSQL Galatee

Le serveur continue à utiliser SQLite par défaut. PostgreSQL s'active
explicitement après import et validation de la base.

## Vérifier la source SQLite

Depuis la racine du dépôt :

```powershell
npm run db:postgres:verify
```

La commande vérifie l'intégrité SQLite, les clés étrangères, les tables et le
nombre de lignes. Elle n'ouvre aucune connexion PostgreSQL.

## Importer vers une base neuve

Créer d'abord une base PostgreSQL vide et fournir son URL hors du dépôt :

```powershell
$env:DATABASE_URL = "postgresql://galatee:mot-de-passe@hote:5432/galatee"
$env:POSTGRES_MIGRATION_CONFIRM = "YES"
npm run db:postgres:import
```

La migration crée le schéma, importe les tables dans l'ordre des dépendances,
vérifie les colonnes et compare les compteurs. Elle utilise une transaction et
refuse une base cible non vide par défaut.

Pour une reprise explicitement autorisée dans une base existante, définir
`POSTGRES_MIGRATION_ALLOW_EXISTING=YES`. Cette option ne supprime aucune donnée
et utilise `ON CONFLICT DO NOTHING`; elle doit être réservée à une migration
contrôlée après sauvegarde.

## Source différente

```powershell
$env:SQLITE_DATABASE_PATH = "C:\chemin\vers\galatee.sqlite"
```

Ne jamais versionner le fichier SQLite, son WAL, les exports, les mots de passe
ou `DATABASE_URL`.

## Activer PostgreSQL dans le runtime

Après avoir importé la base et vérifié les compteurs :

```powershell
$env:GALATEE_DATABASE = "postgres"
$env:DATABASE_URL = "postgresql://galatee:mot-de-passe@hote:5432/galatee"
npm start
```

L'adaptateur de compatibilité exécute les requêtes PostgreSQL dans un worker
dédié afin de préserver temporairement les contrats synchrones des modules
existants. SQLite reste le mode recommandé pour le développement local.

Le runtime commande n'initialise plus les tables historiques de réservation.
Le fichier `schema.sql` les conserve uniquement pour permettre une importation
historique contrôlée depuis une ancienne base SQLite; l'adaptateur runtime
ignore ces DDL legacy.

## Archiver puis retirer les réservations historiques

La commande suivante affiche d'abord les objets encore présents sans rien
modifier :

```powershell
$env:DATABASE_URL = "postgresql://utilisateur:mot-de-passe@hote:5432/galatee"
npm run db:postgres:reservations-preview
```

Pour l'opération destructive, définir explicitement la confirmation et un
chemin d'archive hors dépôt :

```powershell
$env:RESERVATION_ARCHIVE_CONFIRM = "YES"
$env:RESERVATION_ARCHIVE_PATH = "C:\chemin\galatee-reservations-archive.json"
npm run db:postgres:reservations-remove
```

Le script écrit l'archive, vérifie son SHA-256, supprime les huit tables
historiques et les événements analytics de réservation dans une transaction,
puis vérifie que les objets ont disparu.

La copie SQLite locale de secours peut être nettoyée avec la même confirmation :

```powershell
$env:RESERVATION_ARCHIVE_CONFIRM = "YES"
$env:RESERVATION_ARCHIVE_PATH = "C:\chemin\galatee-reservations-sqlite-archive.json"
npm run db:sqlite:reservations-remove
```

Ce mode est adapté à la validation et au lancement initial à faible trafic.
Avant une montée en charge importante, les modules métier devront être
convertis vers des appels PostgreSQL asynchrones afin d'éviter de sérialiser
les requêtes.

## Suite prévue

La base PostgreSQL doit encore être protégée par des sauvegardes restaurables,
des migrations CI/staging et une validation complète des commandes, comptes,
fidélité, livraison, livreurs et back-office avant le déploiement final.
