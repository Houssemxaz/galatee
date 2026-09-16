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
