# Runbook production — Pasta by Galatée

Procedures operationnelles pour deployer, sauvegarder, tourner et faire un
rollback du backend Node + du front-end React en production. Cible : un seul
serveur Node derriere un reverse proxy HTTPS (Nginx, Caddy, Hostinger).

Complete `DEPLOY.md` (qui documente la baseline de securite). Ce fichier est
la reference operationnelle : on le suit pendant un go-live, un incident ou
une bascule PostgreSQL.

- [1. Variables d'environnement](#1-variables-denvironnement)
- [2. Configuration CORS](#2-configuration-cors)
- [3. Configuration Brevo (emails transactionnels)](#3-configuration-brevo-emails-transactionnels)
- [4. Deploiement initial](#4-deploiement-initial)
- [5. Lancement du serveur](#5-lancement-du-serveur)
- [6. Sauvegarde et restauration](#6-sauvegarde-et-restauration)
- [7. Migration SQLite → PostgreSQL](#7-migration-sqlite--postgresql)
- [8. Procedure de rollback](#8-procedure-de-rollback)
- [9. Checklist de validation post-deploiement](#9-checklist-de-validation-post-deploiement)
- [10. Incident : contacts et escalade](#10-incident--contacts-et-escalade)

---

## 1. Variables d'environnement

Toutes les variables se posent au niveau processus (fichier `.env.production`
charge par systemd, PM2 ou `dotenv`). Ne jamais commiter les valeurs reelles.
`.env.example` contient la liste et les commentaires.

### Obligatoires en production

Le serveur **refuse de demarrer** en `NODE_ENV=production` sans ces variables.

| Variable | Format | Role |
|---|---|---|
| `NODE_ENV` | `production` | Active tous les verrous de securite prod (CORS strict, HSTS, refus de boot sans secrets). |
| `GALATEE_ADMIN_TOKEN` | chaine aleatoire >=32 caracteres | Token bearer pour `/api/admin/*`. Compare a temps constant. **Rotation semi-annuelle recommandee.** |
| `GALATEE_ALLOWED_ORIGIN` | URL complete, une seule | CORS. Jamais `*` en prod. Une valeur (`https://galatee.example`). |

### Fortement recommandees

| Variable | Format | Role |
|---|---|---|
| `PORT` | entier | Port d'ecoute du process Node. Defaut `3000`. |
| `TRUST_PROXY` | 0 ou 1 | Nombre de sauts de reverse proxy de confiance. `1` derriere Nginx/Caddy/Hostinger, `0` en direct. Necessaire pour que le rate limiter voie la vraie IP client via `X-Forwarded-For`. |
| `LOG_LEVEL` | `debug`\|`info`\|`warn`\|`error`\|`silent` | Defaut `info` en prod. Ne pas mettre `debug` en prod (verbeux). |
| `BREVO_API_KEY` | chaine Brevo | Reset mot de passe + codes signup. Voir §3. |
| `MAIL_FROM_EMAIL` | email verifie chez Brevo | Sender. Doit correspondre a un domaine ou une adresse validee cote Brevo. |
| `MAIL_FROM_NAME` | libre | Nom affiche (defaut `Galatee`). |

### Optionnelles (overrides rate limiting)

Toutes ont un defaut raisonnable dans `backend/server.js`. Ne changer que si
on observe un abus reel.

| Variable | Defaut | Effet |
|---|---|---|
| `RL_AUTH_WINDOW_MS` / `RL_AUTH_MAX` | 15 min / 20 | login, signup, reset password, verify code (client et livreur). |
| `RL_ORDER_WINDOW_MS` / `RL_ORDER_MAX` | 60 s / 8 | Creation de commande via `POST /api/orders`. |
| `RL_ANALYTICS_WINDOW_MS` / `RL_ANALYTICS_MAX` | 60 s / 60 | `POST /api/analytics/events`. |
| `RL_UPLOAD_WINDOW_MS` / `RL_UPLOAD_MAX` | 60 s / 10 | Upload d'image menu. |
| `RL_ADMIN_WINDOW_MS` / `RL_ADMIN_MAX` | 60 s / 120 | Ensemble des routes `/api/admin/*`. |

### Base de donnees et uploads

| Variable | Defaut | Role |
|---|---|---|
| `GALATEE_DB_PATH` | `backend/data/galatee.sqlite` | Chemin absolu de la base SQLite. Utile pour pointer vers un volume persistant Hostinger. |
| `GALATEE_UPLOAD_DIR` | `backend/data/uploads/menu` | Dossier d'uploads menu (WebP + originaux). Doit etre inclu dans les backups. |

### PostgreSQL (si applicable — voir §7)

| Variable | Format | Role |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@host:port/db?sslmode=require` | Connexion PostgreSQL. Presence = mode Postgres, absence = SQLite. |

---

## 2. Configuration CORS

Le backend applique une politique CORS stricte en production. Reference :
`backend/security.js` (`resolveCorsOrigin` + `applyCorsHeaders`).

### Regles

- **Une seule origine** dans `GALATEE_ALLOWED_ORIGIN`. Ex : `https://galatee-alger.dz`.
- `Access-Control-Allow-Origin` = cette valeur, jamais `*` en prod.
- `Access-Control-Allow-Credentials: true` (les cookies de session sont HttpOnly).
- `Access-Control-Allow-Headers` inclut `Content-Type`, `Authorization`, `Idempotency-Key`.
- `Access-Control-Expose-Headers` inclut `X-Request-Id`.
- `Vary: Origin` pour les caches intermediaires.
- Preflight `OPTIONS` repond `204 No Content` en ~0ms.

### Cas frequents

- **Deploiement Vercel du frontend + Node en tunnel** : `GALATEE_ALLOWED_ORIGIN=https://<projet>.vercel.app`. Redemarrer le backend apres changement.
- **Meme domaine (backend sert `frontend-react/dist/`)** : `GALATEE_ALLOWED_ORIGIN=https://<votre-domaine>`. Le CORS s'applique quand meme (defense en profondeur).
- **Environnement de recette** : configurer une deuxieme origine ? Non. Deployer un backend de recette dedie ou modifier la variable au deploy.

### Verification

```bash
curl -i -X OPTIONS https://api.galatee.example/api/admin/menu \
  -H "Origin: https://galatee.example" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"
```

Reponse attendue :
- Status `204`
- `Access-Control-Allow-Origin: https://galatee.example` (jamais `*`)
- `Access-Control-Allow-Credentials: true`
- `Vary: Origin`

---

## 3. Configuration Brevo (emails transactionnels)

Utilise pour : envoi du code OTP a la creation de compte, envoi du code de
reset de mot de passe. Aucun autre flux applicatif ne depend d'email.

### Setup initial

1. Compte Brevo (plan gratuit : **300 emails/jour** — suffisant en debut de
   vie du produit, a monter en offre payante si adoption > 300 codes / jour).
2. Aller dans **SMTP & API** → **API Keys** → creer une "Master Key" ou une
   "Restricted Key" limitee a l'envoi transactionnel.
3. Verifier le domaine ou l'adresse sender dans **Senders & IP** → **Senders**.
   Sans verification, les emails partent en spam ou ne partent pas du tout.
4. Positionner en prod :

   ```
   BREVO_API_KEY=xkeysib-…
   MAIL_FROM_EMAIL=noreply@galatee.example
   MAIL_FROM_NAME=Galatee
   ```

### Verification

```bash
# Cote client : demander un reset password. Verifier arrivee de l email + code
# 6 chiffres. Consulter le log Node pour le request-id correspondant.
curl -X POST https://api.galatee.example/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Reponse `202 Accepted` cote API. Cote Brevo, verifier dans **Transactional →
Statistics** que l'email est parti.

### Quotas et alerte

- Plan gratuit : 300 emails/jour. Au-dela, les requetes de reset retournent
  `AUTH_RESET_EMAIL_FAILED` (erreur logue, pas de code envoye).
- Monitorer le compteur Brevo au moins mensuellement.
- Prevoir la bascule vers un plan payant quand les codes OTP + resets
  depassent 250/jour en pic.

### Rotation de cle

Rotation tous les 6 mois ou apres un doute de compromission :
1. Creer une nouvelle cle chez Brevo.
2. Deployer la nouvelle valeur (voir §5).
3. Verifier envoi d'un mail de test.
4. Supprimer l'ancienne cle chez Brevo.

---

## 4. Deploiement initial

### Prerequis serveur

- Node.js **>=24** (utilise `node:sqlite`).
- `git` pour clone/pull.
- Reverse proxy HTTPS (Nginx ou Caddy) devant le port applicatif.
- Certificats TLS valides (Let's Encrypt via Caddy = mode le plus simple).
- Volume persistant pour `backend/data/` (SQLite + uploads).

### Etapes

1. Cloner le depot dans `/opt/galatee` (ou equivalent) :

   ```bash
   git clone https://github.com/Houssemxaz/galatee.git /opt/galatee
   cd /opt/galatee
   git checkout main
   ```

2. Installer les dependances :

   ```bash
   npm install
   npm --prefix frontend-react install
   ```

3. Construire le frontend :

   ```bash
   npm run build
   ```

   Sortie : `frontend-react/dist/`. Le backend le sert automatiquement.

4. Creer `/opt/galatee/.env.production` avec les variables du §1.
   `chmod 600 .env.production` et le proprietaire = utilisateur de service.

5. Reverse proxy : rediriger `/` vers le port applicatif Node avec les
   headers standard.

   Exemple **Nginx** :

   ```nginx
   server {
     listen 443 ssl http2;
     server_name galatee.example;

     ssl_certificate     /etc/letsencrypt/live/galatee.example/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/galatee.example/privkey.pem;

     location / {
       proxy_pass         http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header   Host              $host;
       proxy_set_header   X-Real-IP         $remote_addr;
       proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
       proxy_set_header   X-Forwarded-Proto $scheme;
     }
   }
   ```

   Avec Nginx devant, positionner `TRUST_PROXY=1` cote backend pour que
   le rate limiter voie la vraie IP client.

   Exemple **Caddy** (encore plus simple, TLS auto) :

   ```
   galatee.example {
     reverse_proxy 127.0.0.1:3000
   }
   ```

6. Configurer le lancement (§5).

---

## 5. Lancement du serveur

### Option A — systemd (recommandee)

`/etc/systemd/system/galatee.service` :

```ini
[Unit]
Description=Galatee reservation server
After=network.target

[Service]
Type=simple
User=galatee
WorkingDirectory=/opt/galatee
EnvironmentFile=/opt/galatee/.env.production
ExecStart=/usr/bin/node /opt/galatee/backend/server.js
Restart=on-failure
RestartSec=5
# Arret propre : le serveur ecoute SIGTERM (voir server.js)
KillSignal=SIGTERM
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
```

Commandes :

```bash
sudo systemctl daemon-reload
sudo systemctl enable galatee.service
sudo systemctl start galatee.service
sudo systemctl status galatee.service
sudo journalctl -u galatee -f          # logs live
```

### Option B — PM2

```bash
pm2 start backend/server.js --name galatee --node-args="--enable-source-maps"
pm2 save
pm2 startup      # genere le service systemd de PM2
```

Recharger la config au deploy :

```bash
pm2 reload galatee    # zero-downtime, respecte SIGTERM
```

### Verification de vie

```bash
curl -f https://galatee.example/health/live      # -> 200 {"status":"ok"}
curl -f https://galatee.example/health/ready     # -> 200 {"status":"ok","database":"ok"}
```

Un `/health/ready` `503` = base inaccessible. Voir §6 (restauration) et §10
(incident).

---

## 6. Sauvegarde et restauration

### SQLite (mode par defaut)

**Ce qu'il faut sauvegarder** :

- `backend/data/galatee.sqlite` (base principale, WAL actif)
- `backend/data/galatee.sqlite-wal`, `backend/data/galatee.sqlite-shm`
  (fichiers de journalisation, ne pas oublier)
- `backend/data/uploads/menu/` (images WebP + originaux)

**Snapshot cohérent (sans arret du serveur)** :

```bash
# Utilise .backup de sqlite3 : snapshot atomique meme en WAL mode.
sudo -u galatee sqlite3 /opt/galatee/backend/data/galatee.sqlite \
  ".backup '/backups/galatee-$(date +%F-%H%M).sqlite'"

# Uploads : sync incremental
rsync -a --delete /opt/galatee/backend/data/uploads/ /backups/uploads/
```

**Automatisation cron** (`/etc/cron.d/galatee-backup`) :

```
# Snapshot toutes les 6h + rsync uploads. Rotation a 14 jours.
0 */6 * * * galatee /opt/galatee/scripts/backup-sqlite.sh
```

Le script `scripts/backup-sqlite.sh` (a creer selon convention locale)
appelle la commande ci-dessus + une rotation `find /backups -mtime +14 -delete`.

**Verification hebdomadaire** : restaurer un snapshot dans un environnement
de recette et lancer `node --test backend/*.test.js`. Un backup non teste
est une hypothese, pas une assurance.

### Restauration SQLite

Serveur ARRETE (Sinon la base WAL en cours d'ecriture ecrase le restore) :

```bash
sudo systemctl stop galatee.service
sudo -u galatee cp /backups/galatee-2026-09-27-1200.sqlite \
  /opt/galatee/backend/data/galatee.sqlite
sudo -u galatee rm -f /opt/galatee/backend/data/galatee.sqlite-wal \
                       /opt/galatee/backend/data/galatee.sqlite-shm
sudo -u galatee rsync -a /backups/uploads/ /opt/galatee/backend/data/uploads/
sudo systemctl start galatee.service
```

Verifier `/health/ready` et faire passer la checklist §9.

### PostgreSQL (si applicable)

Backup :

```bash
pg_dump --format=custom --file=/backups/galatee-$(date +%F-%H%M).dump \
  "$DATABASE_URL"
```

Restauration :

```bash
sudo systemctl stop galatee.service
pg_restore --clean --if-exists --dbname="$DATABASE_URL" \
  /backups/galatee-2026-09-27-1200.dump
sudo systemctl start galatee.service
```

Retention conseillee : 14 jours de snapshots 6h + 3 mois de snapshots
quotidiens.

---

## 7. Migration SQLite → PostgreSQL

Cette migration n'est **pas encore** integree au code de la branche `main`
(voir `feat/postgresql-migration` pour le travail en cours de l'equipe).
Le plan ci-dessous decrit la procedure une fois le driver Postgres livre.

### Prerequis

- PostgreSQL 16+ hebergé (Hostinger, Neon, Supabase, etc.) avec `sslmode=require`.
- `DATABASE_URL` prete.
- Fenetre de maintenance de 30-60 min annoncee (le site est indispo pendant
  la bascule).

### Etape 1 — Snapshot final SQLite

```bash
sudo systemctl stop galatee.service
sudo -u galatee sqlite3 /opt/galatee/backend/data/galatee.sqlite \
  ".backup '/backups/galatee-final-avant-postgres.sqlite'"
```

Ce snapshot est la reference de rollback.

### Etape 2 — Deployer le code Postgres

```bash
cd /opt/galatee
git fetch origin
git checkout <tag-postgres-migration>   # ex: v2.0.0
npm install
npm --prefix frontend-react install
npm run build
```

### Etape 3 — Migrer les donnees

Utiliser le script fourni par la branche Postgres (typiquement
`node backend/scripts/migrate-sqlite-to-postgres.mjs`) :

- Lit la base SQLite via `node:sqlite`.
- Applique le schema `CREATE TABLE` PostgreSQL (`backend/db/schema.sql`).
- Copie table par table dans l'ordre des dependances (menu → menu_item_revisions
  → orders → order_items → ...).
- Verifie le compte de lignes source vs destination et abort en cas de
  divergence.

### Etape 4 — Switch de driver

```bash
# .env.production
DATABASE_URL=postgres://…
# (garder GALATEE_DB_PATH pour rollback rapide)
```

### Etape 5 — Redemarrage + verification

```bash
sudo systemctl restart galatee.service
curl -f https://galatee.example/health/ready   # -> database:"ok"
```

Passer la checklist §9 avant de reouvrir au public.

### Rollback rapide vers SQLite

Si un probleme critique apparait dans les 24h :

```bash
sudo systemctl stop galatee.service
# Revenir au tag precedent
git checkout <tag-avant-postgres>
npm install && npm run build
# Restaurer le snapshot final SQLite (§6)
sudo -u galatee cp /backups/galatee-final-avant-postgres.sqlite \
  /opt/galatee/backend/data/galatee.sqlite
# Retirer DATABASE_URL de .env.production
sudo systemctl start galatee.service
```

Les commandes creees dans Postgres depuis la bascule sont perdues — d'ou
l'importance de fixer la fenetre de rollback (24h max).

---

## 8. Procedure de rollback

### Cas 1 — Rollback applicatif (bug d'un deploy)

1. **Identifier la version cible** :

   ```bash
   git log --oneline -20
   ```

   Choisir le dernier commit sain (ex : `abc1234`).

2. **Basculer le code** :

   ```bash
   cd /opt/galatee
   git fetch origin
   git checkout abc1234
   npm install
   npm --prefix frontend-react install
   npm run build
   ```

3. **Redemarrer** :

   ```bash
   sudo systemctl restart galatee.service
   ```

4. **Verifier** : checklist §9.

Aucune modification de base necessaire tant qu'aucune migration n'a ete
appliquee entre les deux versions. Verifier avec `git diff abc1234..HEAD --
backend/orderSystem.js backend/*.js` : si des colonnes ont ete ajoutees, le
rollback code seul suffit (les colonnes restent, pas de casse). Si des
colonnes ont ete **retirees** ou renommees, restaurer aussi la DB (§6).

### Cas 2 — Rollback de donnees (corruption, mauvaise migration)

1. **Arreter le serveur** :

   ```bash
   sudo systemctl stop galatee.service
   ```

2. **Restaurer le dernier snapshot sain** (§6).

3. **Rejouer manuellement les commandes perdues** entre le snapshot et
   l'incident. Consulter les logs (`journalctl -u galatee --since ...`)
   pour identifier les orders concernees, rappeler les clients au besoin.

4. **Redemarrer** et communiquer sur l'incident.

### Cas 3 — Rollback d'urgence via bascule DNS

Si le serveur n'est pas accessible :

1. Mettre en ligne la page de maintenance statique (nginx + `return 503`).
2. Basculer le DNS vers un backup si disponible.
3. Investiguer en dehors du chemin critique.

---

## 9. Checklist de validation post-deploiement

Passer ces 10 points apres chaque deploy en production, dans l'ordre.
Un ecart = ne pas ouvrir au public tant qu'il n'est pas resolu.

### Sante du process

- [ ] `curl -f https://galatee.example/health/live` → `200 {"status":"ok"}`
- [ ] `curl -f https://galatee.example/health/ready` → `200 {"status":"ok","database":"ok"}`
- [ ] Logs applicatifs : aucune ligne `level:"error"` dans les 5 dernieres min
  (`journalctl -u galatee --since '5 min ago' | grep -i error`).

### Auth admin

- [ ] `curl -i https://galatee.example/api/admin/menu` → `401` (aucun token).
- [ ] `curl -i -H "Authorization: Bearer WRONG" https://galatee.example/api/admin/menu` → `401`.
- [ ] `curl -i -H "Authorization: Bearer $GALATEE_ADMIN_TOKEN" https://galatee.example/api/admin/menu` → `200`.

### CORS + headers de securite

- [ ] Preflight `OPTIONS /api/orders` avec `Origin` correct → `204` + `Access-Control-Allow-Origin: https://galatee.example` (jamais `*`).
- [ ] Toute reponse renvoie `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `X-Request-Id`.
- [ ] En HTTPS : `Strict-Transport-Security: max-age=15552000; includeSubDomains`.

### Parcours utilisateur critiques

- [ ] Ouvrir le site public en navigation privee, aller sur `/commande`,
      ajouter un plat, passer a `/commande/coordonnees`, envoyer un ordre de
      test. Recevoir l'ecran "Commande recue". **Supprimer la commande de
      test cote backoffice.**
- [ ] Se connecter au backoffice `/backoffice.html`, verifier que la section
      Commandes affiche la liste et que le passage a "confirmee" fonctionne.
- [ ] PWA livreur `/livreur` : login avec un vrai compte livreur, verifier
      que le pool s'affiche et que "Je pars livrer" + "Livree" fonctionnent.

### Emails (Brevo)

- [ ] Demander un reset password sur un compte de test : l'email arrive dans
      les 60 s. Confirmer le reset avec le code recu.

### Rate limiting

- [ ] Depuis une meme IP, faire 25 tentatives `POST /api/auth/login` en 30 s
      avec un email inexistant : au moins une reponse doit renvoyer `429` +
      header `Retry-After`.

### Monitoring / alerting

- [ ] La sonde externe (UptimeRobot, HetrixTools, Grafana Cloud) est verte
      sur `/health/ready`.
- [ ] Les logs sont rediriges vers l'outil central (fluentbit, journald,
      Papertrail...) ou consultables via `journalctl -u galatee`.

### Backup

- [ ] Le dernier snapshot SQLite/Postgres a moins de 6h ET la commande
      `sqlite3 <backup> "PRAGMA integrity_check"` renvoie `ok`.
- [ ] Le `rsync` des uploads est passe (dernier fichier < 1h dans
      `/backups/uploads/`).

---

## 10. Incident : contacts et escalade

- **Houssem (owner)** — decisions produit + acces GitHub / Vercel / Brevo / DNS.
- **Autre developpeur (collegue)** — connait aussi le repo et l'infra.
- **Hostinger support** — via le panneau client, escalation infra serveur.

### Priorites

- **P0 — site inaccessible** : `/health/ready` en 503 ou timeout.
  Rollback (§8) sous 15 min.
- **P1 — feature critique cassee** : impossible de passer commande, login
  bloque, backoffice inaccessible.
  Investigation < 1h, rollback si necessaire.
- **P2 — degradation** : lenteurs, warnings dans les logs, quotas atteints.
  Ticket + investigation en heure ouvree.

### Journal d'incident

Chaque P0/P1 doit produire une note dans `tasks/lessons.md` avec date +
symptome + cause racine + correctif + prevention. Voir les entrees existantes
comme modele.
