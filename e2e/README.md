# Tests E2E Playwright

Suite de bout en bout qui verifie les parcours critiques du site avec un vrai
navigateur (Chromium) contre un backend Galatee **isole**. La base
`backend/data/galatee.sqlite` du dev n'est jamais lue ni modifiee.

## Ce qui est couvert

- **`order-client.spec.js`** — Un client anonyme ouvre `/commande`, ajoute un
  plat, passe a l'etape coordonnees, remplit le formulaire, envoie ; le
  serveur repond 201 avec `status: "pending"` et l'ecran de confirmation
  s'affiche.
- **`driver-flow.spec.js`** — Un livreur se connecte a `/livreur` avec son
  telephone + PIN, prend une course visible dans le pool, la fait passer par
  "en route" puis "Livree" (test 1). Test 2 : meme scenario mais annulation
  avec motif "Client injoignable".
- **`backoffice-access.spec.js`** — L'API admin renvoie 401 sans token, 401
  avec mauvais token, 200 avec le bon. L'UI `/backoffice.html` accepte le
  token dans la AuthGate et charge `/api/admin/orders`.

## Isolation des donnees

Chaque `npm run test:e2e` lance `e2e/test-server.mjs` qui :

- Cree un dossier temporaire sous `os.tmpdir()` (`galatee-e2e-<pid>/`).
- Positionne `GALATEE_DB_PATH`, `GALATEE_UPLOAD_DIR`, `GALATEE_ADMIN_TOKEN`
  et `PORT=3199` dans `process.env` **avant** d'importer `backend/server.js`.
- Cree un plat publie "Spaghetti Pomodoro E2E" et un livreur (`+213 555 000 001`
  / PIN `1234`).
- Nettoie le dossier temporaire a l'arret (`SIGTERM`/`SIGINT`).

Aucune modification n'atteint `backend/data/galatee.sqlite`.

## Prerequis (une fois par machine)

```bash
npm run test:e2e:install
```

Telecharge Chromium (~150 MB) dans `~/.cache/ms-playwright` (Linux/Mac) ou
`%LOCALAPPDATA%\ms-playwright` (Windows).

## Executer

```bash
# Build + boot serveur + tous les specs
npm run test:e2e

# Boot serveur + tests (sans rebuild — plus rapide en iteration)
npm run test:e2e:only

# Mode UI interactif de Playwright (utile pour debug)
npm run test:e2e:ui
```

Le premier run ecrit dans `playwright-report/` (rapport HTML) et
`test-results/` (screenshots + video + traces sur echec).

## Debug

- Un echec produit une capture d'ecran (`test-results/<spec>/`) et une trace
  Playwright que l'on peut ouvrir avec `npx playwright show-trace <fichier>`.
- Pour cibler un seul spec : `npx playwright test e2e/tests/order-client.spec.js`.
- Pour lancer sans le rebuild frontend : `npm run test:e2e:only`.
- Pour voir le browser tourner : `npx playwright test --headed`.

## Variables d'environnement

- `E2E_PORT` (defaut `3199`) — port sur lequel le test-server ecoute.
- `E2E_ADMIN_TOKEN` (defaut `e2e-admin-token-abcdef`) — token admin pour les
  tests. A garder aligne entre les specs et le test-server (le fichier
  `test-server.mjs` lit la variable au boot).
