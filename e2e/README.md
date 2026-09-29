# Tests E2E Galatee

La suite lance un serveur backend dédié sur une base SQLite temporaire et une
copie de build frontend. Elle ne lit ni n'écrit la base locale du projet.

## Commandes

```powershell
npm run test:e2e:install
npm run test:e2e
```

Pour relancer uniquement les scénarios navigateur après un build déjà effectué:

```powershell
npm run test:e2e:only
```

Le rapport HTML est généré dans `playwright-report/` et les traces d'échec dans
`test-results/`.
