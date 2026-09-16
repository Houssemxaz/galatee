# Galatee - contexte partage

Galatee est le site de commande en ligne d'un restaurant de pates fraiches situe a Hydra, Alger, avec un back-office pour l'equipe.

## Produit actuel

- Le parcours public principal est la commande en ligne, avec livraison ou retrait sur place.
- Le paiement est prevu a la livraison ou au retrait.
- La livraison est configuree par commune, avec un tarif et un statut actif/inactif.
- Le restaurant traite les commandes dans le back-office: confirmation, annulation, preparation, commande prete, livraison/retrait et terminaison.
- Les comptes clients utilisent email + mot de passe. Le profil contient prenom, nom, telephone et commune de residence.
- Le client peut consulter ses commandes et sa progression de fidelite.
- Le programme de fidelite peut attribuer une remise apres un nombre configure de commandes qualifiantes.
- Le menu gere les plats, menus et offres, avec prix, description, image, publication, archivage et rupture de stock.
- Les statistiques suivent notamment le trafic, les visites du menu, les commandes, leurs statuts et la performance des produits.
- Le Pasta Lover Club possede une page publique et un module back-office pour sa presentation et ses evenements.

## Architecture

- `backend/server.js`: serveur HTTP natif Node.js, API `/api/*` et fichiers statiques.
- `backend/orderSystem.js`: commandes, livraison, communes et tarifs.
- `backend/customerAuthSystem.js`: comptes clients, sessions et hachage des mots de passe.
- `backend/loyaltySystem.js`: regles et recompenses de fidelite.
- `backend/menuSystem.js`: catalogue, revisions, publication et disponibilite.
- `backend/clubSystem.js`: contenu et evenements Pasta Lover Club.
- `frontend-react/`: application Vite + React 19.
- `frontend-react/src/backoffice/`: interface du logiciel de gestion.
- `frontend-react/public/mockups/`: mockups HTML statiques servis tels quels.
- `backend/data/`: donnees SQLite locales de demo, exclues du depot.

## Regles de collaboration

- Lire `AGENTS.md`, `tasks/lessons.md` et `tasks/todo.md` avant toute modification.
- Claude Code peut travailler sur le frontend, le design et les mockups.
- Les changements backend, API, base de donnees et securite doivent rester coordonnes avant fusion.
- Ne pas casser les contrats API existants ni supprimer les anciennes tables de reservation sans migration planifiee.
- Ne jamais committer de secrets, donnees personnelles reelles, base SQLite, logs ou fichiers generes.
- Apres chaque changement: lancer `npm test` puis `npm run build`.

## Commandes

```powershell
npm install
npm --prefix frontend-react install
npm test
npm run build
npm start
```

URLs locales: `http://localhost:3000`, `http://localhost:3000/backoffice.html` et `/mockups/<nom>.html`.

## Suite prevue

Les prochains sujets sont la finalisation de la livraison, les promotions avancees, les tests finaux, le SEO, la migration future vers une base de production, les sauvegardes et l'automatisation WhatsApp. Le chatbot RAG a ete retire du perimetre actuel.
