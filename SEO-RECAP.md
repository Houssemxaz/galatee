# SEO — Récapitulatif des travaux · Pasta by Galatée

**Date** : septembre 2026
**Portée** : Optimisation SEO technique complète du site `galatee.dz`
**Objectif** : Positionner le site sur les requêtes locales Alger / Hydra / pâtes fraîches, permettre l'indexation Google, activer les cartes riches (rich snippets) et le partage propre sur les réseaux sociaux.

---

## Table des matières

1. [Résumé pour le devis](#résumé-pour-le-devis)
2. [État initial du site](#état-initial-du-site)
3. [Travaux réalisés](#travaux-réalisés)
4. [Fichiers créés ou modifiés](#fichiers-créés-ou-modifiés)
5. [À faire côté client au moment du déploiement](#à-faire-côté-client-au-moment-du-déploiement)
6. [Impact business attendu](#impact-business-attendu)
7. [Glossaire technique](#glossaire-technique)

---

## Résumé pour le devis

Le site a été mis aux standards SEO 2026 pour un restaurant local :

| Poste | Statut | Effort réel |
|---|---|---|
| Métadonnées HTML statiques (title, description, OG, Twitter) | ✅ Livré | ~1h |
| Métadonnées dynamiques par page (react-helmet-async) | ✅ Livré | ~2h |
| Données structurées JSON-LD (Restaurant + Menu + MenuItem) | ✅ Livré | ~1h |
| `robots.txt` + `sitemap.xml` | ✅ Livré | ~15min |
| Manifest PWA (installable sur mobile) | ✅ Livré | ~15min |
| Alt text descriptifs sur images clés | ✅ Livré | ~20min |
| Optimisation performance (WebP srcset, content-visibility, backend auto-conversion) | ✅ Livré (session précédente) | ~4h |
| Splash screen allégé pour FCP | ✅ Livré | ~10min |
| Retrait preload PNG obsolète | ✅ Livré | ~2min |

**Total technique livré** : ~9h de travail directement facturable en tant que "prestation SEO on-page technique".

Le site est **techniquement prêt pour être indexé et partagé**. Les actions restantes (Google Business Profile, Search Console, Analytics) sont côté client car elles nécessitent son compte Google et son adresse exacte.

---

## État initial du site

Avant intervention, le site présentait plusieurs manques critiques pour un restaurant local :

- ❌ Titre et description identiques sur toutes les pages (un seul `<title>` statique dans `index.html`)
- ❌ Aucune balise Open Graph → partage vide sur Facebook, WhatsApp, Instagram, LinkedIn
- ❌ Aucune balise Twitter Card
- ❌ Aucune donnée structurée (JSON-LD Schema.org) → pas de fiche restaurant Google, pas de rich snippets
- ❌ Pas de `robots.txt`
- ❌ Pas de `sitemap.xml`
- ❌ Pas d'URL canonique par page
- ❌ Pas de manifest PWA (site non installable)
- ❌ Images alt vides ou absentes sur les visuels principaux
- ❌ Preload d'un PNG de 1,6 MB qui n'était plus utilisé après conversion WebP
- ❌ Splash screen bloquant le FCP pendant 600ms minimum
- ⚠️ Site SPA (React) sans prérendu → bots réseaux sociaux ne voyaient rien

---

## Travaux réalisés

### 1. Refonte complète du `<head>` HTML

Le fichier `index.html` a été enrichi avec :

**Métadonnées primaires**
- `<title>` : *Pasta by Galatée — Pâtes fraîches à Hydra, Alger · Livraison*
- `<meta name="description">` : phrase ciblée avec géolocalisation
- `<meta name="keywords">` : long-tail Alger (pâtes fraîches Alger, restaurant italien Hydra, spaghetti carbonara Alger…)
- `<meta name="author">`
- `<link rel="canonical">`
- `<meta name="format-detection">` pour éviter l'auto-linking iOS des numéros

**Open Graph (partage Facebook, WhatsApp, LinkedIn, Instagram)**
- `og:type = restaurant.restaurant`
- `og:site_name`, `og:url`, `og:title`, `og:description`
- `og:image` pointant vers un WebP 960w optimisé
- `og:image:alt` descriptif
- `og:locale = fr_DZ`

**Twitter Card**
- `twitter:card = summary_large_image`
- Titre, description, image dédiés

**Favicons et PWA**
- `favicon.svg` (déjà présent)
- `apple-touch-icon`
- Lien vers `manifest.webmanifest`

### 2. Données structurées JSON-LD Restaurant

Un bloc `<script type="application/ld+json">` a été ajouté dans `index.html` avec le schéma Schema.org **Restaurant** complet :

- Nom, alternate name, description
- Adresse postale (Hydra, Alger, code postal, pays DZ)
- Coordonnées GPS (36.7451, 3.0397 — Hydra approximatif, à préciser)
- Téléphone, email
- Prix (1500-4000 DA)
- Cuisines servies : Italian, Pasta, Mediterranean
- `acceptsReservations: true`
- Lien vers le menu
- **Horaires d'ouverture** (mercredi-samedi, 19h-23h30) au format machine
- Zone servie : Alger
- Liens réseaux sociaux (`sameAs` : Instagram, TikTok, Snapchat)
- URLs des images principales

**Impact** : Google peut désormais afficher une fiche restaurant riche dans les résultats (horaires, prix, cuisine, image, avis futurs). Éligible aux cartes de résultats "Restaurants à proximité".

### 3. Métadonnées dynamiques par page

Un composant React `SEO` a été créé (`src/components/SEO.jsx`) utilisant `react-helmet-async`. Chaque page injecte ses propres métadonnées lors de la navigation :

| Route | Titre injecté | Description injectée | JSON-LD |
|---|---|---|---|
| `/` | Trattoria italienne à Hydra, Alger | Description locale complète | (hérite du Restaurant global) |
| `/menu` | La carte — Pâtes fraîches quotidiennes | Description de la carte | **Menu + MenuItem** pour chaque plat |
| `/menu/:slug` | Nom du plat — description | Description du plat | **MenuItem + Offer** (prix, disponibilité) |
| `/informations` | Informations — Horaires, livraison, groupes | Description info | — |
| `/pasta-lover-club` | Pasta Lover Club — Le cercle des habitués | Description du club | — |
| `/contact` | Contact — Téléphone, email, Instagram | Description contact | — |
| `/commande` | Commander — Livraison ou retrait à Alger | Description order | — |
| `/commande/coordonnees` | Finaliser la commande | Description checkout | `noindex` |
| `/compte` (anonyme) | Espace client — Connexion ou création | Description accès | `noindex` |
| `/compte` (connecté) | Mon espace client | Description membre | `noindex` |
| `404` | Page introuvable — 404 | Message d'erreur | `noindex` |

Les pages privées (checkout, compte, 404) sont marquées **noindex** pour ne pas polluer l'index Google.

**Impact** : chaque page apparaît dans Google avec son propre titre pertinent. Fini le "Galatee — Maison de pâtes fraîches" sur toutes les pages.

### 4. `robots.txt` et `sitemap.xml`

Deux fichiers essentiels créés dans `frontend-react/public/` :

**`robots.txt`**
```
User-agent: *
Allow: /
Disallow: /backoffice
Disallow: /_unused
Sitemap: https://galatee.dz/sitemap.xml
```

**`sitemap.xml`** liste 7 URLs publiques avec priorités et fréquences de mise à jour :
- `/` (priorité 1.0, weekly)
- `/menu` (0.9, weekly)
- `/commande` (0.9, monthly)
- `/informations` (0.7, monthly)
- `/pasta-lover-club` (0.6, monthly)
- `/contact` (0.6, monthly)
- `/compte` (0.4, monthly)

**Impact** : Google découvre toutes les pages en un seul crawl et sait quelles sont prioritaires.

### 5. Manifest PWA

Fichier `public/manifest.webmanifest` créé :

- Nom complet + short name pour l'écran d'accueil
- `start_url: /`
- `display: standalone` — l'app s'ouvre sans barre navigateur
- `theme_color` olive (nav bar Android)
- `background_color` crème (splash Android)
- Catégories `food, lifestyle`
- Icône SVG (à compléter avec PNG 192 et 512 côté client)

**Impact** : le site est installable sur mobile ("Ajouter à l'écran d'accueil"). Amélioration typique de l'engagement mobile de +30 à +40 %.

### 6. Optimisations performance (rappel session précédente)

Ces optimisations comptent aussi pour le SEO (Core Web Vitals influencent le ranking) :

- **Conversion WebP** avec srcset 640w/960w/1280w pour toutes les images de plats
- Backend intégrant `sharp` pour **conversion automatique** à chaque upload via backoffice
- **`content-visibility: auto`** sur les sections hors viewport
- **Réduction des `filter: blur()`** coûteux
- **`background-attachment: fixed`** supprimé (jank scroll)
- **Suppression du preload PNG obsolète** (1,6 MB téléchargés pour rien)
- **107 MB d'images inutilisées** déplacées hors du build

**Impact** : `/menu` passe d'environ 14 MB téléchargés à ~500 KB. LCP largement amélioré. Bon signal Core Web Vitals pour Google.

### 7. Splash screen allégé

Avant : minimum 600 ms d'affichage forcé, transition 480 ms, animations pulse continues.
Après : suppression du minimum, transition 320 ms, animations pulse retirées.

**Impact** : le contenu réel apparaît environ 500 ms plus tôt. Bon pour le First Contentful Paint mesuré par Google.

### 8. Alt text descriptifs

Correction de l'attribut `alt=""` vide sur le hero home :

- Avant : `alt=""`
- Après : `alt="Spaghetti pomodoro dans une box PASTA by Galatée avec basilic frais et vapeur"`

Les images de plats servies par `DishImage.jsx` utilisent déjà le champ `alt` du menu (via `dish.alt || item.imageAlt`). Cela reste **côté client** de bien renseigner le champ "texte alternatif" pour chaque plat dans le backoffice.

---

## Fichiers créés ou modifiés

### Créés

| Chemin | Rôle |
|---|---|
| `frontend-react/public/robots.txt` | Directives pour crawlers |
| `frontend-react/public/sitemap.xml` | Plan du site pour Google |
| `frontend-react/public/manifest.webmanifest` | PWA installable |
| `frontend-react/src/components/SEO.jsx` | Composant réutilisable pour métadonnées dynamiques |

### Modifiés

| Chemin | Modifications |
|---|---|
| `frontend-react/index.html` | Refonte complète du `<head>` + JSON-LD Restaurant |
| `frontend-react/src/main.jsx` | Ajout `HelmetProvider` |
| `frontend-react/src/pages/HomePage.jsx` | Composant SEO + alt text hero |
| `frontend-react/src/pages/MenuPage.jsx` | Composant SEO + JSON-LD Menu |
| `frontend-react/src/pages/DishPage.jsx` | Composant SEO + JSON-LD MenuItem par plat |
| `frontend-react/src/pages/InformationsPage.jsx` | Composant SEO |
| `frontend-react/src/pages/ContactPage.jsx` | Composant SEO |
| `frontend-react/src/pages/OrderPage.jsx` | Composant SEO |
| `frontend-react/src/pages/CheckoutContactPage.jsx` | Composant SEO (noindex) |
| `frontend-react/src/pages/AccountPage.jsx` | Composant SEO (noindex) sur les deux vues |
| `frontend-react/src/pages/PastaLoverClubPage.jsx` | Composant SEO |
| `frontend-react/src/pages/NotFoundPage.jsx` | Composant SEO (noindex) |
| `frontend-react/package.json` | Ajout dépendance `react-helmet-async` |

---

## À faire côté client au moment du déploiement

Ces items **n'ont pas pu être livrés depuis le code** — ils demandent l'accès aux comptes Google du client ou des informations précises que seul le client peut fournir.

### Priorité 1 — Indispensable

**1. Renseigner l'adresse exacte du restaurant**
Actuellement le JSON-LD dit `"streetAddress": "Hydra"` et les coordonnées GPS sont approximatives. Le client doit fournir :
- L'adresse postale complète (rue, numéro, code postal exact)
- Les coordonnées GPS précises (via Google Maps)

À remplacer dans :
- `frontend-react/index.html` (JSON-LD Restaurant)
- `frontend-react/public/manifest.webmanifest` si besoin

**2. Renseigner le vrai numéro de téléphone**
Actuellement `+213` sans suite. À corriger dans :
- `frontend-react/index.html` (JSON-LD)
- `frontend-react/src/components/SiteFooter.jsx`
- `frontend-react/src/pages/ContactPage.jsx`
- `frontend-react/src/components/FaqSection.jsx`

**3. Créer / vérifier la fiche Google Business Profile**
C'est **la source #1 de trafic pour un restaurant local**. Le client doit :
- Créer sa fiche Google Maps (categoria "Restaurant italien")
- Ajouter photos, horaires, menu
- Vérifier la fiche (code postal ou téléphone)
- S'assurer de la **cohérence NAP** (Name Address Phone) entre le site et la fiche

Impact réel : sans cette fiche, le site n'apparaîtra pas dans les résultats "restaurant proche de moi" ni dans le pack Maps sur Alger.

**4. Inscrire le site à Google Search Console**
- Ajouter la propriété `galatee.dz`
- Vérifier la propriété (méta DNS ou fichier HTML)
- Soumettre le sitemap : `https://galatee.dz/sitemap.xml`
- Surveiller les erreurs d'indexation

### Priorité 2 — Fortement recommandé

**5. Installer un tracker analytics**
Deux options :
- **Google Analytics 4** (gratuit, complet, mais tracker Google)
- **Plausible** (payant ~9€/mois, RGPD-friendly, sans cookies, plus rapide)

Recommandation : Plausible si le client tient à la privacy, GA4 sinon. Nous fournirons le code d'intégration une fois le compte créé.

**6. Certificat SSL / HTTPS**
Aujourd'hui probablement en local. En production, HTTPS obligatoire (Google déclasse les sites HTTP). Généralement fourni gratuitement par l'hébergeur (Netlify, Vercel, Cloudflare, Let's Encrypt).

**7. Icônes PNG pour PWA**
Le manifest référence uniquement le SVG. Idéalement ajouter aussi :
- `/icon-192.png` (192×192, PWA Android)
- `/icon-512.png` (512×512, PWA Android)
- `/apple-touch-icon.png` (180×180, iOS)

Peut être généré à partir du SVG existant en 5 minutes.

### Priorité 3 — Optionnel mais bonus

**8. Prérendu au build (SPA prerender)**
Actuellement, le site est une SPA React. Les métadonnées dynamiques (title, OG par page) fonctionnent bien pour Google (qui exécute le JS), mais **Facebook, WhatsApp, Twitter et LinkedIn ne les voient pas** — ils lisent le HTML statique.

Résultat : le partage de la racine `/` fonctionne bien (les métadonnées sont dans `index.html`), mais le partage d'une page profonde comme `/menu/spaghetti-carbonara` renvoie l'aperçu générique du site.

**Solution** : ajouter `vite-plugin-prerender-spa-plugin` ou équivalent. Au moment du `npm run build`, un navigateur headless visite chaque route et sauvegarde un HTML statique par route. Facebook & co voient alors les bons OG tags.

**Effort estimé** : 2h de mise en place + 30min de tests. À inclure dans le devis si le client fait beaucoup de partages sociaux ciblés (posts Instagram avec lien vers une fiche plat spécifique).

**9. Enrichissement contenu texte**
La page `/menu` a peu de texte hors les cartes plats. Google favorise les pages avec au moins 300 mots de contenu textuel. Ajouter :
- Un paragraphe "Notre philosophie des pâtes" en tête de `/menu`
- Un texte "Comment ça marche" en tête de `/commande`
- Éventuellement une page `/notre-histoire` avec ~500 mots

**Effort estimé** : c'est de la rédaction (idéalement avec le client) — 1h de rédaction + 30min d'intégration.

**10. Backlinks locaux**
Le client peut demander à être référencé sur :
- Annuaires locaux Alger (Tripadvisor Algérie, TheFork si présent en DZ, Zomato…)
- Blogs food algériens
- Instagram / TikTok influenceurs food Alger

Ce n'est pas du développement — c'est du travail de relations extérieures.

---

## Impact business attendu

### Court terme (0-3 mois après déploiement + configuration Google)

- Le site apparaît dans Google pour la requête `pasta by galatee` (marque)
- La fiche Google Business apparaît sur `restaurant italien Hydra`, `pâtes fraîches Alger`
- Le partage WhatsApp / Instagram du site affiche un aperçu propre avec image du plat
- Les visiteurs peuvent "ajouter à l'écran d'accueil" sur mobile → engagement récurrent

### Moyen terme (3-12 mois)

- Positionnement sur les requêtes long-tail : `carbonara Hydra`, `livraison pâtes Alger centre`, `restaurant italien Ben Aknoun`…
- Trafic organique croissant depuis Google Maps ("restaurant proche de moi")
- Éligibilité aux rich snippets Google (fiche horaires + prix + image directement dans les résultats)

### Ordre de grandeur estimatif

Pour un restaurant de niche italienne bien positionné à Alger avec toutes les optimisations en place, on peut viser :

- **50-200 visites organiques/mois** dans les 3 premiers mois
- **300-800 visites organiques/mois** à 6-12 mois
- **10-30 commandes/mois** directement attribuables au SEO organique une fois le programme mature

Ces chiffres dépendent fortement de la concurrence locale et de la qualité du contenu ajouté au fil du temps.

---

## Glossaire technique

Pour comprendre les termes utilisés dans ce document lors des discussions avec le client :

- **SEO** : Search Engine Optimization — optimisation pour être trouvé sur Google.
- **On-page SEO** : optimisations dans le code du site (ce que nous avons fait).
- **Off-page SEO** : optimisations extérieures (backlinks, fiche Google Business, avis).
- **JSON-LD** : format Google-recommandé pour les données structurées Schema.org.
- **Schema.org** : vocabulaire standardisé décrivant les entités (restaurant, plat, événement…) pour aider les moteurs.
- **Rich snippets / rich results** : résultats Google enrichis avec image, prix, horaires, avis. Réservés aux sites avec bonnes données structurées.
- **Open Graph (OG)** : protocole Facebook adopté par tous les réseaux pour l'aperçu des liens partagés.
- **Twitter Card** : équivalent Twitter.
- **Canonical URL** : URL de référence pour Google, évite le contenu dupliqué.
- **Sitemap** : plan XML du site pour Google.
- **robots.txt** : instructions aux crawlers (accès autorisé/interdit).
- **Manifest PWA** : fichier qui rend le site "installable" comme une app.
- **LCP** (Largest Contentful Paint) : temps d'affichage du plus gros élément visible. Google le mesure pour le ranking. Objectif < 2,5s.
- **FCP** (First Contentful Paint) : temps du premier pixel visible. Objectif < 1,8s.
- **CLS** (Cumulative Layout Shift) : mesure des sauts de layout pendant le chargement. Objectif < 0,1.
- **Core Web Vitals** : ces 3 métriques (LCP, FCP-INP, CLS) que Google utilise directement pour ranker.
- **NAP** : Name, Address, Phone — la triple info restaurant qui doit être cohérente partout.
- **NAP consistency** : cohérence NAP entre site + Google Business + annuaires. Critère majeur du SEO local.
- **noindex** : instruction pour dire à Google "ne référence pas cette page" (pour checkout, comptes, 404).
- **SPA** (Single Page Application) : app JS qui rend tout côté client. Nécessite quelques précautions SEO (prérendu, react-helmet-async).
- **Prerender** : génération de HTML statique par route au build, pour que les bots voient le contenu directement.
- **PWA** (Progressive Web App) : site installable comme une app native.

---

**Document rédigé pour** : Houssem — pour référence lors du devis client Galatée
**Version** : 1.0 · septembre 2026
