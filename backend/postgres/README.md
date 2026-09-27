# Migration PostgreSQL Galatee

Cette première étape prépare PostgreSQL sans modifier le runtime : le serveur
continue à utiliser SQLite tant que l'adaptateur PostgreSQL n'a pas été revu.

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

## Suite prévue

Cette migration est un outil de préparation. L'application ne doit être
basculée vers PostgreSQL qu'après ajout d'un adaptateur de persistance, des
migrations CI/staging, des sauvegardes restaurables et une validation complète
des commandes, comptes, fidélité, livraison, livreurs et back-office.
