# Presentation Vercel + backend local

Le frontend et les mockups sont deployes depuis `frontend-react`. SQLite reste local dans le serveur Node.

1. Installer Node 24+, puis `npm install` a la racine du projet.
2. Installer cloudflared: `winget install Cloudflare.cloudflared`.
3. Lancer le backend dans un terminal: `npm start`.
4. Dans un second PowerShell: `./scripts/tunnel.ps1`.
5. Copier la valeur affichee `VITE_API_BASE` (URL du tunnel + `/api`).
6. Creer le projet Vercel avec `frontend-react` comme **Root Directory**.
7. Ajouter `VITE_API_BASE` dans les variables d'environnement Vercel, puis redeployer.
8. Apres le premier deploy, redemarrer le backend dans PowerShell avec `$env:GALATEE_ALLOWED_ORIGIN="https://<projet>.vercel.app"; npm start` pour remplacer le `*` de developpement.
9. Tester le site, `/backoffice` et un fichier comme `/mockups/hero-a-warm.html` depuis un telephone en 4G.

Pour activer les comptes clients par code email, configurer aussi dans l'environnement du backend local: `BREVO_API_KEY`, `MAIL_FROM_EMAIL` et optionnellement `MAIL_FROM_NAME=Galatee`. Le sender doit etre verifie chez Brevo. Le frontend doit appeler les routes auth avec `credentials: "include"`; le backend repond alors avec un cookie HttpOnly. Le plan gratuit Brevo est limite a 300 emails par jour.

Le quick tunnel change d'URL a chaque lancement: mettre a jour `VITE_API_BASE` et redeployer quand cela arrive. Le script ne lance pas le backend et ne modifie aucune base.

## Variables d'environnement obligatoires en production

Depuis la baseline "production hardening", le backend REFUSE de demarrer en `NODE_ENV=production` sans les variables suivantes :

- `GALATEE_ADMIN_TOKEN` : token admin pour `/api/admin/*`. Comparaison a temps constant cote serveur. Le back-office l'envoie via `Authorization: Bearer <token>`.
- `GALATEE_ALLOWED_ORIGIN` : origine autorisee pour CORS. Une seule valeur (jamais `*`). Le serveur autorise credentials + preflight uniquement pour cette origine.

Variables recommandees :

- `TRUST_PROXY` : nombre de sauts de reverse proxy de confiance devant le backend. `1` derriere Nginx/Caddy/Hostinger, `0` en direct. `x-forwarded-for` n'est lu que si `TRUST_PROXY > 0`.
- `LOG_LEVEL` : `info` par defaut en prod, `debug` en dev.
- `RL_*_WINDOW_MS` / `RL_*_MAX` : override du rate limiting. Voir `.env.example` pour la liste.

En dev local, toutes ces variables restent optionnelles : le token admin absent laisse `/api/admin/*` ouvertes (avec un warning au boot), et `GALATEE_ALLOWED_ORIGIN` peut valoir `*`.

## Protections en place (baseline `feat/production-hardening`)

- Authentification admin par token via `Authorization: Bearer <token>`, comparaison a temps constant.
- CORS strict en production, avec `Access-Control-Allow-Credentials: true` + `Vary: Origin`.
- Headers de securite sur toutes les reponses : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self)`, `Strict-Transport-Security` en HTTPS prod uniquement.
- Rate limiting en memoire (429 + `Retry-After`) sur : auth client, auth livreur, creation commande, evenements analytics, uploads image, ensemble des routes admin. Configurables par env.
- Identite client authentifiee : `POST /api/orders` force firstName/lastName/phone/email depuis la session, ignore les valeurs du body.
- `Idempotency-Key` optionnelle sur `POST /api/orders` : deux appels avec la meme cle et la meme identite renvoient la meme reponse et ne creent qu'une seule commande.
- Health checks : `GET /health/live` (toujours 200 si le process tourne), `GET /health/ready` (verifie l'acces DB, renvoie 503 sinon). Ni l'un ni l'autre ne renvoie de secret.
- Arret propre : `SIGTERM`/`SIGINT` ferment le serveur HTTP puis la base SQLite (timeout dur 10 s).
- Logs structures JSON avec `requestId` + redaction des champs sensibles (`password`, `token`, `email`, `phone`, `otp`, ...).

## Health checks utiles pour l'infra

- `GET /health/live` -> `200 {"status":"ok"}` : liveness probe (le process repond).
- `GET /health/ready` -> `200 {"status":"ok","database":"ok"}` ou `503` : readiness probe (la base repond).

## Etapes restantes (non incluses dans cette baseline)

- Migration `SQLite -> PostgreSQL` : implique un nouveau driver + un shim des transactions actuelles + un plan de dump/replay des donnees.
- Passage du rate limiter et de l'idempotency store a Redis (les deux modules exposent la meme interface pour le swap).
- Deploiement Hostinger : reverse proxy + PM2 (ou systemd) + certificats + secrets injectes hors Git.
- Backups automatises de la base + rotation.

