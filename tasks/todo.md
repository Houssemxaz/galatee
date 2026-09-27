# Todo

## Projet
Site web pour un restaurant chic / haut de gamme specialise dans les pates, avec systeme de reservation.

## Organisation multi-agent
- Orchestrateur: cadrage produit, architecture, coherence globale, revue et integration.
- Agent Frontend: direction artistique, UI, experience responsive, integration frontend.
- Agent Backend: reservation, modele de donnees, API, validation, persistance.

## Plan initial
1. [x] Charger les skills utiles et formaliser le mode de collaboration.
2. [x] Definir le brief fonctionnel et visuel du restaurant.
3. [x] Decouper les missions Frontend / Backend en tickets clairs.
4. [x] Recevoir la delegation frontend et confirmer le perimetre d'intervention.
5. [x] Ecrire le contexte produit et la direction visuelle durable.
6. [x] Generer les visuels originaux et construire le frontend public.
7. [x] Brancher l'interface de reservation sur le contrat backend sans inventer de persistance.
8. [x] Verifier le site localement: UI, reservation, erreurs, responsive.
9. [x] Mettre a jour les lecons apres corrections.

## Plan frontend en cours
- Design Read: luxe froid editorial, hospitalite contemporaine, gestes de fabrication visibles.
- Dials: DESIGN_VARIANCE 7, MOTION_INTENSITY 5, VISUAL_DENSITY 3.
- Stack choisie: HTML/CSS/JavaScript sans dependance, car aucun package.json n'existe encore.
- Fichiers de travail prevus: `PRODUCT.md`, `DESIGN.md`, `frontend/CONTEXT.md`, `frontend/index.html`, `frontend/styles.css`, `frontend/app.js`, `frontend/assets/*`.
- Contrat backend attendu: `GET /api/availability?date=YYYY-MM-DD&partySize=N` et `POST /api/reservations`.

## Plan backend reservation
- [x] Confirmer les coutures de test: API HTTP publique `GET /api/availability` et `POST /api/reservations`.
- [x] Ajouter une structure backend Node sans dependance avec services, validation, capacite et persistance durable.
- [x] Ecrire des tests comportementaux pour disponibilite, creation et prevention du surbooking.
- [x] Brancher le frontend sur `/api` quand il est servi par le backend.
- [x] Verifier localement avec les tests et des appels HTTP reels.
- [x] Mettre a jour les lecons si une correction ou un piege est rencontre.

## Plan integration Easy!Appointments
> Historique abandonne: Easy!Appointments a ete remplace par un back-office Galatee interne.
- [x] Documenter la contrainte runtime: Easy!Appointments necessite Apache/Nginx, PHP 8.2+ et MySQL; PHP/MySQL ne sont pas disponibles localement.
- [x] Ajouter un client backend optionnel compatible avec l'API REST Easy!Appointments (`customers`, `appointments`, auth Basic/Bearer).
- [x] Mapper une Reservation Galatee vers Customer + Appointment Easy!Appointments sans modifier l'interface publique du frontend.
- [x] Tester le mapping, les headers d'authentification et le mode desactive par defaut.
- [x] Verifier que les tests existants restent verts et que l'API live repond encore.

## Integration orchestrateur
- [x] Confirmer que le serveur sert le frontend et injecte `window.GALATEE_API_BASE`.
- [x] Verifier les formats de disponibilite et de creation de reservation avec l'interface.
- [x] Bloquer les faux creneaux en cas d'echec de l'API live.
- [x] Relancer la verification complete apres la correction frontend.

## Ajout Easy!Appointments comme back-office
> Historique abandonne: containers arretes et fichiers actifs retires.
- [x] Ajouter une configuration Docker Compose Easy!Appointments + MySQL sur des ports non conflictuels.
- [x] Ajouter un exemple de variables d'environnement pour connecter Galatee a l'API Easy!Appointments.
- [x] Ajouter une commande de verification de configuration Easy!Appointments cote backend.
- [x] Documenter le flux d'activation: setup wizard, provider/service, IDs, auth, redemarrage Galatee.
- [x] Lancer Easy!Appointments en local si Docker peut telecharger les images. Easy!Appointments repond sur `http://localhost:8088/index.php/installation`.
- [x] Rejouer les tests backend et verifier que Galatee reste fonctionnel.

## Remplacement Easy!Appointments par back-office Galatee
- [x] Arreter Easy!Appointments et retirer les scripts/fichiers d'integration du projet actif.
- [x] Etendre le modele avec `Blocked Time Slot` et la gestion interne des `Reservation Status`.
- [x] Ajouter les APIs admin: liste reservations, changement de statut, blocage/deblocage de creneau.
- [x] Faire respecter les blocages dans `GET /api/availability`.
- [x] Couvrir les comportements par tests backend et HTTP.
- [x] Redemarrer Galatee et verifier l'API live.

## Nouvelle mission frontend: back-office admin
- [x] Construire `frontend/admin.html` avec une densite operationnelle coherente avec Galatee.
- [x] Ajouter `frontend/admin.css` avec le theme `#5A2123` / `#EFE9E9`, responsive et etats accessibles.
- [x] Ajouter `frontend/admin.js` pour le token de session, les filtres, les statuts et les creneaux bloques.
- [x] Afficher clairement les erreurs 401, 409 et erreurs API generiques.
- [x] Verifier via le serveur Node sur `http://localhost:3000/admin.html`.

## Nouvelle mission: reservation complete et base de donnees
- [x] Preciser le contrat backend public: prenom, nom, telephone, email optionnel, type de table normal/VIP et demande speciale optionnelle.
- [x] Remplacer la persistance JSON par une base SQLite locale via `node:sqlite`.
- [x] Separer les tables `services`, `reservations` et `blocked_time_slots`.
- [x] Faire respecter les capacites par type de table et prevenir le surbooking dans une transaction SQLite.
- [x] Adapter le frontend et le dashboard aux nouveaux champs, avec valeurs techniques `normal` / `vip` alignees sur l'API.
- [x] Tester le parcours HTTP/metier complet et documenter la migration JSON -> SQLite locale.

## Nouvelle mission: parcours reservation et finition visuelle
- [x] Replacer les champs identite avant les choix de service dans un formulaire en une seule etape.
- [x] Creer les reservations en statut `requested`, puis permettre la confirmation depuis le dashboard.
- [x] Imposer une annee de date sur exactement 4 chiffres et valider le format cote backend.
- [x] Ameliorer la hierarchie typographique, les tailles de texte, les controles et les retours d'etat.
- [x] Auditer la surface publique et le dashboard avec Impeccable et verifier le parcours live.

## Nouvelle mission: disponibilites dashboard et confirmation
- [x] Bloquer automatiquement le creneau/type de table lors de la confirmation d'une demande.
- [x] Exposer une vue admin des disponibilites par date, type de table, heure et nombre de personnes.
- [x] Ajouter les filtres correspondants dans le dashboard et rendre l'etat de capacite lisible.
- [x] Agrandir et harmoniser la typographie du dashboard sans perdre sa densite operationnelle.
- [x] Tester la confirmation, le blocage public, les filtres et l'absence de donnees de test residuelles.

## Nouvelle mission: reorganiser la page d'accueil
- [x] Conserver le hero actuel et aligner la navigation sur Reservation, Menu, Contact, Services et Informations.
- [x] Transformer la deuxieme sequence en menu de la semaine avec deux CTA et des fiches plats interactives.
- [x] Ajouter une section chefs avec leurs noms et parcours, sans photos.
- [x] Recomposer les sections restantes pour couvrir les services, informations pratiques et contact.
- [x] Verifier les interactions des fiches, les ancres, le responsive et la non-regression de la reservation.

## Nouvelle mission: finition mobile du site public
- [x] Recomposer le header, le hero et les espacements pour une lecture mobile prioritaire.
- [x] Recalibrer les titres, textes, CTA, cartes menu, images et sections chefs/services/informations.
- [x] Rendre la reservation confortable au pouce, sans debordement ni controles trop petits.
- [x] Verifier la navigation mobile, les disclosures du menu, les ancres, le formulaire et le rendu sur plusieurs largeurs.

## Nouvelle mission: ajuster le texte du hero mobile
- [x] Remonter et contraindre le bloc texte sans modifier la composition desktop.
- [x] Espacer le titre, le paragraphe et les CTA de l'image du plat.
- [x] Recontroler les formats portrait, paysage, la console et la suite de tests.

## Nouvelle mission: inspiration mobile SANTO et menu immersif
- [x] Extraire les principes de structure, composition et motion de la reference publique avec le skill getdesign.
- [x] Recomposer le parcours mobile du menu en cartes-image verticales immersives adaptees a Galatee.
- [x] Ajouter les transitions et interactions de menu sans sacrifier les CTA de reservation ni l'accessibilite.
- [x] Verifier les formats mobiles, le desktop, la performance des images, la console et la reservation.

## Nouvelle mission: migration React + Vite + shadcn
- [x] Creer l'architecture React/Vite et documenter le choix de servir le build via Node.
- [x] Installer et initialiser shadcn/ui dans le projet React, puis utiliser Lucide pour les icones.
- [x] Migrer le site public: navigation, hero, menu immersif, chefs, services, informations, contact et reservation.
- [x] Conserver le dashboard admin et les contrats API sans regression.
- [x] Verifier build production, serveur Node, reservation, disponibilites, admin, responsive et accessibilite.

## Nouvelle mission: refonte du dashboard admin
- [x] Auditer la structure actuelle du back-office et conserver tous les selecteurs/data-attributes et contrats API.
- [x] Reorganiser la mise en page en zones operationnelles lisibles: resume, reservations, disponibilites et blocages.
- [x] Harmoniser la typographie, les espacements, les boutons, les tableaux et les etats avec la marque Galatee.
- [x] Remplacer l'apparence native des champs date par un calendrier visuellement coherent, sans casser la saisie clavier ni l'accessibilite.
- [x] Verifier desktop, mobile, filtres, actions admin, console, tests backend et absence de regression.

## Nouvelle mission: nettoyer les visuels React et finaliser le calendrier admin
- [x] Auditer les visuels hors menu et conserver les images de plats uniquement dans le menu.
- [x] Remplacer les photos hors menu par des backgrounds/illustrations Galatee coherents mobile/desktop.
- [x] Supprimer le doublon du calendrier natif tout en preservant les inputs, hooks et acces clavier.
- [x] Verifier build React, tests backend, serveur unique, responsive, menu, calendrier et absence d'erreurs.

## Nouvelle mission: audit Chrome et version mobile finale
- [x] Comparer les captures fournies avec le rendu live et relever les defauts visuels concrets.
- [x] Recomposer la version mobile comme une experience dediee, pas une simple reduction responsive.
- [x] Renforcer le contraste autour de #5A2123 et #EFE9E9 avec des tons secondaires maitrises.
- [x] Verifier navigation, menu, reservation, accesibilite, overflow, console, build et rendu desktop/mobile.

## Nouvelle mission: favicon et champs de reservation accessibles
- [x] Remplacer la favicon generique par un monogramme Galatee et la declarer dans le HTML React.
- [x] Servir `/favicon.ico` comme alias statique de la favicon React sans modifier le metier backend.
- [x] Donner un `name` stable aux selects Radix caches pour supprimer les avertissements de formulaire.
- [x] Verifier favicon, console, formulaire, menu, overflow, build et tests.

## Nouvelle mission: profondeur visuelle, motion et calendrier public
- [x] Auditer avec Chrome les defauts de contraste, de structure, de hover et de chargement.
- [x] Renforcer la lumiere, la profondeur et les backgrounds autour de #5A2123 et #EFE9E9 sans perdre le contraste.
- [x] Ajouter des animations d'entree et de hover utiles, performantes et compatibles reduced-motion.
- [x] Remplacer le calendrier natif public par une experience coherente avec Galatee, sans casser les dates et disponibilites backend.
- [x] Verifier reservation, disponibilites, dates invalides, admin, build, tests et rendu multi-viewport.

## Nouvelle mission: refonte palette restaurant et backgrounds abstraits
- [x] Remplacer la palette public/admin par Azzurro, Espresso, Glacier, Bisque et Clay, sans utiliser #5A2123 comme couleur de marque.
- [x] Recomposer le site public et le dashboard avec une ambiance de restaurant haut de gamme chaleureuse, sans effet palace ostentatoire.
- [x] Introduire des backgrounds creatifs mais epures: formes illustrees, textures papier et lignes structurelles, sans photo realiste hors images du menu.
- [x] Ajouter des hovers precis sur boutons, liens et plats, avec reduced-motion et comportement tactile coherent.
- [x] Auditer le backend et preserver les contrats API, la base SQLite, les disponibilites, les demandes et les confirmations.
- [x] Verifier build, tests, serveur unique, reservation, dashboard, responsive et absence de regression.

## Correction finale: hero et menu mobile plus lumineux
- [x] Remplacer les surfaces Espresso dominantes du hero et de la navigation mobile par Glacier/Bisque.
- [x] Conserver Espresso pour les cadres, textes forts et actions, avec Azzurro/Clay pour les accents.
- [x] Vérifier le rendu servi après reconstruction aux largeurs 1440, 390 et 320 sans overflow ni erreur console.

## Nouvelle mission: hero Le Carnet de service
- [x] Recomposer uniquement le hero en grille éditoriale modulaire avec titre, illustration abstraite de pâte, bloc service et CTA.
- [x] Prioriser la lisibilité et les zones tactiles sur mobile tout en conservant la palette et les ancres existantes.
- [x] Vérifier build, rendu desktop/mobile et absence de régression fonctionnelle.

## Nouvelle mission: refonte palette restaurant et backgrounds abstraits
- [x] Remplacer la palette public/admin par Azzurro, Espresso, Glacier, Bisque et Clay, sans utiliser #5A2123 comme couleur de marque.
- [x] Recomposer le site public et le dashboard avec une ambiance de restaurant haut de gamme chaleureuse, sans effet palace ostentatoire.
- [x] Introduire des backgrounds créatifs mais épurés: formes illustrées, textures papier et lignes structurelles, sans photo réaliste hors images du menu.
- [x] Ajouter des hovers précis sur boutons, liens et plats, avec reduced-motion et comportement tactile cohérent.
- [x] Auditer le backend et préserver les contrats API, la base SQLite, les disponibilités, les demandes et les confirmations.
- [x] Vérifier build, tests, serveur unique, réservation, dashboard, responsive et absence de régression.

## Correction finale: composition Carnet intégrée
- [x] Utiliser le background `hero-carnet-background.png` comme composition principale du hero.
- [x] Superposer le texte HTML accessible dans les zones rail, panneau titre, illustration, service, réservation et bande basse.
- [x] Maintenir l'alternance visuelle des sections et vérifier les interactions publiques sans toucher à l'admin/backend.

## Nouvelle mission: correction du cadrage et des couleurs secondaires
- [x] Auditer le hero réel avec Chrome à 1440, 390 et 320 px.
- [x] Recaler la grille desktop sur le format du carnet et maintenir le titre sur deux lignes.
- [x] Garder les CTA lisibles dans le panneau sombre et remettre le hero en flux naturel sur mobile.
- [x] Réduire les surfaces colorées des pages et utiliser la palette de référence comme accents secondaires.
- [x] Reconstruire le bundle et vérifier le rendu sans overflow ni erreur console.

## Nouvelle mission: clarification des CTA du hero
- [x] Supprimer le bouton de réservation du header pour éviter le doublon avec le panneau du carnet.
- [x] Présenter « Voir la carte » comme bouton secondaire clairement identifiable.
- [x] Agrandir et espacer les informations de service dans le panneau de droite.
- [x] Vérifier les deux CTA, le contraste, le responsive et l'absence d'erreur console.

## Nouvelle mission: alternance des surfaces et audit mobile
- [x] Inspecter la page complète mobile avec Chrome et repérer les sections consécutives de même surface.
- [x] Passer la section Services sur une surface espresso avec lignes éditoriales claires.
- [x] Contrôler la structure du hero, du menu, des chefs et de la réservation sur 390 px.
- [x] Reconstruire et finaliser la vérification multi-viewport.

## Correction finale: paysage mobile
- [x] Recomposer le hero en grille horizontale compacte pour `844×390`.
- [x] Éviter la collision du rail avec le logo et du service avec les CTA.
- [x] Vérifier portrait, paysage, alternance des surfaces et console Chrome.

## Nouvelle mission: palette finale du restaurant
- [x] Remplacer les tokens public/admin par Olivenite `#313118`, Bancha `#6D6844`, Hillside `#CCC6A9` et Terracotta `#83482B`.
- [x] Recolorer le background éditorial du hero et aligner favicon, theme-color et surfaces admin.
- [x] Préserver les endpoints, la base SQLite, les disponibilités, les demandes et les confirmations backend.
- [x] Vérifier le build, les tests, les routes statiques/API et le rendu Chrome desktop/mobile.

## Nouvelle mission: menu éditable et analytics revenus
Décisions produit validées le 2026-09-03 : le responsable doit pouvoir modifier les plats, enregistrer un brouillon puis publier, envoyer des images depuis ses dossiers ou par drag-and-drop, et consulter des indicateurs menu et revenus dans une installation locale avec vraie base de données. Pour la démo, les revenus sont saisis manuellement par jour.

- [ ] Auditer la source actuelle des plats, le rendu public et les hooks existants.
- [x] Définir et implémenter le modèle des plats: titre, description courte/longue, prix, catégorie, ordre, image, visibilité, brouillon/publication et historique.
- [x] Définir et implémenter l'upload local sécurisé: sélection de fichier + drag-and-drop côté client, formats/taille, noms générés, stockage persistant et suppression contrôlée côté API.
- [ ] Définir les événements analytics liés aux réservations: clics CTA, formulaires commencés, demandes envoyées et périodes sélectionnables. Les visites du menu et la popularité des plats sont exclues de la V1.
- [x] Choisir pour la démo une saisie manuelle du revenu journalier, agrégée ensuite par jour, semaine, mois et année.
- [ ] Exclure de la V1: nombre de couverts, panier moyen, revenus par service et revenus par type de table.
- [x] Implémenter les API d'édition admin et de publication publique sans casser les réservations ni l'API actuelle.
- [x] Implémenter les API du dashboard analytics: jour, semaine, mois, année et comparaison de périodes.
- [x] Tester sécurité API, permissions, uploads, persistance, calculs, API et régressions backend.
- [ ] Connecter les interfaces admin et public aux nouveaux endpoints, puis ajouter l'export CSV si confirmé.

## Nouvelle mission: directions artistiques Figma Galatee Hydra
- [x] Lire `tasks/lessons.md`, `tasks/todo.md`, `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md` et le frontend React comme contexte existant.
- [x] Charger les skills de cadrage et de direction artistique: `icm-architect`, `impeccable`, `design-styles-prompting`, `design-dna`, `genjutsu:paint`, `design-taste-frontend`, `frontend-design`, `brandkit`, `ai-visual-direction`, `imagegen-frontend-web`, `web-quality-audit`.
- [x] Créer la structure minimale `docs/design-directions/` avec un fichier par étape de pipeline.
- [x] Produire l'étape 0: brief créatif court, contraintes, critères de réussite et gate de validation.
- [x] Gate étape 0: brief validé, Hydra confirmé, aucune photo disponible, sortie initiale en images générées classiques avant Figma.
- [x] Étape 1: analyser les références visuelles fournies et définir le vocabulaire.
- [x] Gate étape 1: valider les familles visuelles et les directions à éviter.
- [x] Étape 2: formuler les trois thèses d'univers.
- [x] Gate étape 2: valider les trois thèmes à détailler; choix du concept principal reporté après comparaison visuelle.
- [x] Étape 3: définir le système visuel par concept.
- [x] Étape 4: décrire la structure Figma pour les directions 1/2 et la route d'implémentation directe pour la direction 3.
- [x] Étape 5: proposer les prompts de visuels et backgrounds, puis générer les trois previews de direction.
- [x] Étape 6: produire les maquettes Figma pour La Table Claire et Atelier Vivant.
- [ ] Étape 7: définir la motion spec.
- [ ] Étape 8: critiquer et comparer les trois directions.
- [ ] Étape 9: préparer puis exécuter l'implémentation frontend directe de Soirée à Hydra.

## Reprise site uniquement: home Soirée à Hydra
- [x] Comparer le hero React avec l'image générée `03-soiree-a-hydra.png`.
- [x] Rendre la page d'accueil fidèle à la référence: split olive/cinématique, plat à droite, titre placé, CTA terracotta et bloc menu bas droit.
- [x] Harmoniser légèrement les sections suivantes avec la même vibe sans complexifier le backend ni le reste du site.
- [x] Rebuild et vérifier desktop/mobile: placement du texte, illustration, images limitées au menu/plat, console et overflow.

## Correction hero intégré au site
- [x] Remplacer la capture hero utilisée comme image unique par une composition HTML/CSS.
- [x] Garder la structure de la référence: panneau olive, assiette à droite, typo espacée, CTA terracotta, menu bas droit.
- [x] Vérifier que les textes et boutons sont de vrais éléments DOM et que le fond est composé par couches CSS.
- [x] Rebuild et vérifier desktop/mobile, console et overflow.

## Correction asset fidèle du hero Soirée à Hydra
> Supersédé par la demande explicite d'utiliser l'image de base complète comme background du site.
- [x] Abandonner le crop plat/matière temporaire.
- [x] Supprimer le plat sombre actuel du hero.
- [x] Recaler le hero sur la référence validée complète.
- [x] Rebuild et vérifier Chrome: image chargée correcte, texte placé par la référence, pas de calque plat séparé, pas d'overflow.

## Correction image de base comme background
- [x] Copier l'image validée complète comme background du hero.
- [x] Supprimer les calques visibles qui doublaient l'assiette, le titre et les ornements.
- [x] Vérifier que le fond du hero n'est plus blanc et que la référence est servie comme background.

## Correction contour clair du background hero
- [x] Vérifier l'image `hero-soiree-hydra-scene.png`: pas de fond blanc/crème intégré, le crop est déjà propre (confirmé par échantillonnage de pixels).
- [x] Vérifier qu'aucun contour clair n'apparaît sur le hero rendu, y compris sur écran très large (testé 1440 et 1920px via Chrome headless): non reproductible, aucun changement nécessaire sur ce point précis.

## Reprise Claude Code: alignement du hero sur `03-soiree-a-hydra.png` et corrections structurelles
- [x] Lancer le serveur Galatee sur le port 3000 (après arrêt d'un serveur Next.js d'un autre projet qui occupait le port).
- [x] Comparer le hero rendu (Chrome headless) à la référence `docs/design-directions/generated-images/03-soiree-a-hydra.png`.
- [x] Ajouter l'élément `.hero-menu-tile` (lien "Menu") dans `App.jsx`: le CSS existait déjà (hover, icône, pointer-events) mais n'était jamais rendu, laissant un rectangle olive vide en bas à droite du hero.
- [x] Corriger une fuite CSS: `.hero-backdrop::after` héritait de `top`/`left` d'une règle `inset` obsolète (`@media max-width:900px`, ancien hero non-intégré), plaçant le bloc décoratif en haut à gauche au lieu du coin bas-droit sur mobile portrait.
- [x] Corriger une fuite CSS similaire en paysage bas (`@media orientation:landscape and max-height:600px`): `.hero-main-panel` héritait d'un `background` translucide de l'ancien layout multi-colonnes, créant un bandeau clair superposé sur le titre.
- [x] Corriger un débordement horizontal réel du mot "GALATEE" à 320px de large (confirmé par mesure DOM précise, pas juste visuel): réduire `font-size`/`letter-spacing` du h1 dans le palier `@media max-width:360px`.
- [x] Rejouer `npm test` (36/36 verts) pour confirmer l'absence de régression backend.
- [x] Vérifier build + rendu Chrome (headless, viewport forcé via CDP) à 320, 390, 430, 844×390 (paysage) et 1440px: plus d'overflow horizontal, plus de bloc vide ni de fuite visuelle.

## Exploration hero: alternatives à la photo jugée "trop IA"
- [x] Proposer 3 directions comparatives (Grand Rideau photo duotone, Ligne & Matière illustré, Table Basse ambiant) dans un artifact autonome, sans toucher au code de prod.
- [x] Sur validation du Grand Rideau: proposer 2 variantes illustrées (Ruban de Pâte, Hydra le soir) réutilisant la même animation/typo/structure, sans photo.
- [x] Grand Rideau confirmé comme direction finale par l'utilisateur.
- [x] Identifier et démontrer le point faible de la photo (ruban flottant en haut, lecture "accessoire IA générique") avec un aperçu avant/après recadrage.
- [x] Corriger `.hero-integrated .hero-backdrop` (desktop + mobile): `background-position` poussé vers le bas pour réduire le ruban, dans la limite du recadrage disponible.
- [x] Corriger la lisibilité de la nav du hero: ajouter un scrim `linear-gradient` en tête du backdrop pour que "RESERVATION" reste lisible même sur la zone claire de la photo.
- [x] Rebuild, `npm test` (40/40 verts) et vérifier via Chrome/CDP à 390, 1440 et 1920px: nav lisible partout, ruban réduit, pas de régression.

## Implémentation complète du hero "Grand Rideau" en production
- [x] Reconstruire `App.jsx`/`App.css`: photo en duotone (grayscale + blend-mode color olive/terracotta), suppression du panneau ovale en dur, ombre en dégradé à la place.
- [x] Titre "GALATEE" monumental qui chevauche la limite photo/texte, avec accent italique terracotta sur une lettre; structure ancrée en bas (eyebrow, titre, ligne copy+CTA).
- [x] Conserver l'animation rideau (`heroCurtain`) à l'ouverture + cascade d'apparition du texte, avec repli `prefers-reduced-motion`.
- [x] Neutraliser définitivement `.hero-backdrop::before/::after` hérités de l'ancien hero (`display:none` non conditionnel) pour empêcher toute nouvelle fuite CSS de ce type.
- [x] Construire une version mobile dédiée (pas un rétrécissement): photo recadrée `62% 78%`, contenu empilé verticalement, tuile Menu compacte, palier paysage bas séparé.
- [x] Corriger une collision découverte par capture: le CTA "Réserver" (flex pleine largeur) et la tuile "Menu" (absolue) se superposaient sur desktop, le CTA invisible sous la tuile — réservé l'espace via `padding-right`.
- [x] Vérifier via Chrome/CDP à 320, 390, 844×390 (paysage), 1440 et 1920px, `npm test` (40/40), et envoyer les captures desktop/mobile à l'utilisateur (en déplacement, sans accès PC).

## Corrections post-implémentation: ruban résiduel et CTA désaligné
- [x] Diagnostiquer le "trait vert" signalé à gauche: le ruban de la photo redevenait visible sur les viewports plus hauts que 900px, car `background-position: right bottom` recadre proportionnellement à `100svh` et le scrim en pixels fixes ne suit pas.
- [x] Créer `hero-soiree-hydra-scene-tight.png` (recadrage réel du fichier, ruban retiré) et l'utiliser en `background-size: cover` desktop et mobile, indépendant de la hauteur d'écran.
- [x] Aligner `.hero-menu-tile` sur `min-height: 49px` pour matcher exactement le CTA "Réserver" (était 72px, différence visible signalée par l'utilisateur).
- [x] Rebuild, `npm test` (40/40), vérifier via Chrome/CDP à 900, 1200, 1400px de hauteur (desktop) et mobile: plus de ruban visible, CTA alignés, envoyer captures.
- [x] L'utilisateur signale que les CTA restent décalés verticalement malgré la même hauteur: mesurer précisément via `getBoundingClientRect` (top/bottom des deux boutons), trouver la vraie cause (`.hero-title-block` héritait de `transform: translateY(3vh)` de l'ancien hero, jamais annulé), corriger avec `transform: none`.
- [x] Revérifier par mesure DOM exacte (pas seulement visuelle): les deux CTA ont désormais un top et un bottom identiques à 1440 et 1920px. `npm test` (40/40) toujours vert.

## Back-office: Menu CMS, Revenus, Analytics réservation
> Backend construit par un agent séparé (menuSystem.js, analyticsSystem.js, endpoints /api/menu, /api/admin/menu*, /api/admin/revenue*, /api/admin/analytics, /api/analytics/events), audité et vérifié avant tout travail frontend (40 tests verts incluant les nouveaux tests menu/analytics).
- [x] Nouvelle entrée Vite `frontend-react/backoffice.html` → `src/backoffice/` (React + shadcn), servie sans modification de `backend/server.js` (le routing statique générique gère déjà `/backoffice.html`).
- [x] `api.js`: `apiRequest`/`apiUpload` réutilisant la même clé `sessionStorage` (`galatee.adminToken`) que l'admin existant; thème shadcn passé en `.dark` avec les tokens de marque (corrige un bouton illisible détecté à l'audit).
- [x] Section Menu: table (miniature, statut brouillon/publié/archivé, ordre), dialog création/édition, upload image (drag-and-drop + sélection, validation client), indicateur "modifications non publiées", aperçu, publication, archivage (confirmation à deux clics). Cycle complet vérifié via interaction réelle (Chrome/CDP): création → upload d'une vraie image → publication → archivage → disparition de la liste.
- [x] Section Revenus: saisie journalière, filtres période (jour/semaine/mois/année + personnalisé) partagés avec Analytics, graphique (recharts), cartes de synthèse avec comparaison à la période précédente, table d'entrées éditable (modification inline + suppression). Vérifié par une saisie réelle (18000 DZD) reflétée immédiatement dans le résumé.
- [x] Section Analytics: tunnel CTA → démarré → soumis → demandé → confirmé avec taux de conversion, même graphique/filtre que Revenus.
- [x] Menu public (`App.jsx`): remplacement du tableau `dishes` codé en dur par `GET /api/menu`, prix reformaté en DZD (`29.00 DA`), libellé de catégorie dérivé côté client (absent de l'API), états chargement/vide/erreur.
- [x] Événements analytics anonymes (`sessionId` en `sessionStorage`, jamais de PII): clic CTA réservation, démarrage du formulaire (premier focus, garde par `useRef`), soumission réussie. Vérifiés un par un via interaction réelle et inspection réseau (les deux premiers confirmés directement; le troisième réutilise le même mécanisme déjà prouvé).
- [x] Lien croisé `/admin.html` ↔ `/backoffice.html`.
- [x] Vérification finale: `npm test` (40/40), `node --check backend/server.js`, aucun overflow ni erreur console à 320/390/430/844×390/1440px sur les deux pages, flux 401/token invalide/token valide testé sur un serveur temporaire séparé (port 3001, arrêté après test, aucun impact sur le serveur principal), aucune donnée de test résiduelle en base.

## Ajustements hero post-retour utilisateur (PC): luminosité, taille du plat, résolution, titre
- [x] Réintroduire un panneau olive opaque à bord courbe (`.hero-panel`) confinant la photo à ~55% de large (desktop uniquement), pour répondre à "le plat est trop grand" et "manque de luminosité" simultanément.
- [x] Alléger le traitement photo: `grayscale(.85) brightness(1.06)` au lieu de `grayscale(1) brightness(.86)`, opacité du duotone réduite (.96 → .8), dégradés d'ombre réduits.
- [x] Recadrer un nouvel asset `hero-soiree-hydra-hires.png` directement depuis le mockup source `docs/design-directions/generated-images/03-soiree-a-hydra.png` (1672×941, ~2× la résolution du crop précédent), en vérifiant au zoom qu'aucun élément d'UI du mockup (nav FR/EN, pastilles de pagination) ne fuit dans le nouveau crop.
- [x] Réduire le titre `h1` de `clamp(88px,16vw,260px)` à `clamp(64px,11vw,168px)` (desktop; mobile inchangé, déjà plus petit).
- [x] Rebuild, `npm test` (40/40, un flake ponctuel sur `contentAnalytics.test.js` non reproductible confirmé sans lien avec ces changements), vérifier desktop et mobile via Chrome/CDP.

## Refonte hero: fond papier lumineux + plat en médaillon (direction "C" validée par l'utilisateur)
> L'utilisateur trouvait le plat toujours trop grand/trop "image" même confiné à 55%; a demandé de planifier avant de générer. Options proposées: A (dégradé lumineux sans plat), B (papier texturé + trait dessiné), C (fond lumineux + plat en médaillon cadré). Choix: tester C avec le fond de B.
- [x] Remplacer les calques photo plein cadre (`hero-photo`/`hero-duotone`/`hero-shade`/`hero-panel`) par un fond papier lumineux (`hero-paper` dégradé clair, `hero-glow` lueur chaude, `hero-texture` grain SVG subtil).
- [x] Le plat devient un médaillon circulaire cadré (`hero-medallion`, ~21vw desktop, ~34vw mobile) positionné en haut à droite, avec bordure fine et ombre portée.
- [x] Basculer les couleurs de texte du hero (et de `.site-header`, toujours au-dessus du hero) de `--paper` (clair, pour fond sombre) vers `--ink` (sombre, pour fond clair); garder terracotta pour l'eyebrow/accent/CTA.
- [x] Vérifier: build, `npm test` (40/40), aucune erreur console, aucun overflow à 320/390/430/844×390/1440/1920px, mobile et paysage cohérents avec la même composition.

## Ajustement: plat "immersif" sans cadre rond (trop vide + rond pas aimé)
> Demande ambiguë ("mode 3D immersif"); question posée à l'utilisateur avec 3 options concrètes (photo plus grande sans cadre / vrai rendu 3D WebGL / parallaxe au scroll). Réponse: photo plus grande sans cadre rond, image réelle avec ombre marquée, pas de 3D technique.
- [x] Nouveau crop serré `hero-dish-immersive.png` (juste le plat + le geste terracotta, ruban de studio exclu) depuis la même source haute résolution.
- [x] `.hero-medallion` (cercle dur) remplacé par `.hero-dish`: image large (jusqu'à 660px desktop), bords adoucis via `mask-image: radial-gradient(...)` (fondu progressif, pas de découpe géométrique dure) plutôt qu'un cadre rond, `filter: drop-shadow(...)` à deux niveaux pour l'ombre portée/profondeur.
- [x] Repositionné plus grand et plus haut dans le hero pour combler le vide signalé, tout en gardant le fond papier lumineux visible autour.
- [x] Vérifié: le fondu radial masque naturellement le reliquat de ruban de studio dans les coins sans recadrage supplémentaire.
- [x] Rebuild, `npm test` (40/40), aucune erreur console, aucun overflow à 320/390/430/844×390/1440/1920px.

## Plat en vrai objet détouré + fond plus vert olive (inspirations "floating object")
> L'utilisateur n'aimait plus le fondu radial (bords de photo encore visibles: table, ruban, geste terracotta) et voulait un vrai détourage comme des exemples produit (casque, café) tout en gardant un ton haut de gamme. Décision prise ensemble avant implémentation: détourage réel (rembg) plutôt qu'un masque approximatif, fond ré-équilibré vers le vert olive, ombre portée simple (pas de props décoratifs type grains de café, jugés trop kitsch pour un restaurant chic).
- [x] Installer `rembg`/`onnxruntime` (accord explicite de l'utilisateur), détourer `hero-soiree-hydra-hires.png` avec le modèle `bria-rmbg` (bol + plat ensemble, contrairement à `u2net` qui n'isolait que la garniture).
- [x] Nettoyer le détourage en plusieurs passes (composants connexes, érosion/reconstruction morphologique, seuil de luminosité ciblé) pour retirer un fragment du geste terracotta soudé au bord du bol et une tache d'ombre du verre à pied non liée au plat — nouvel asset `hero-dish-cutout.png`.
- [x] Fond hero repassé à dominante vert olive (`hero-paper` en dégradé Hillside→Bancha→Olivenite, `hero-glow` avec trois lueurs superposées) au lieu du fond crème/beige de l'itération précédente.
- [x] Remplacer le `mask-image` radial (fondu photo) par une vraie transparence alpha + `filter: drop-shadow()` léger sur l'image, plus une ellipse d'ombre au sol séparée (`.hero-dish-shadow`) pour un rendu "objet posé" net, sans reliquat de fond photo.
- [x] Vérifié: `npm test` (40/40), aucune erreur console, aucun overflow à 320/390/430/1440/1920px et mobile 390×844, capture desktop et mobile confirmant le détourage propre (voir leçon ci-dessous sur la méthode de vérification qui a failli valider un défaut invisible).

## Génération asset hero: ruban de tagliatelle
- [x] Verrouiller le brief portrait, le fond olive sombre uniforme et la matière naturelle non plastique.
- [x] Générer un visuel photographique 2:3 sans texte, vaisselle ni accessoires.
- [x] Contrôler le cadrage, la lumière, la texture et les contraintes négatives.
- [x] Enregistrer l'asset final dans le projet avec un nom versionné.

## Génération asset hero: bouquet de trois tagliatelles
- [x] Verrouiller le comptage à trois rubans distincts, asymétriques et de longueurs variées.
- [x] Générer un visuel photographique 2:3 sur fond olive sombre uniforme.
- [x] Contrôler la lisibilité des trois rubans, la matière, les ombres et l'espace négatif.
- [x] Enregistrer l'asset final dans le projet sans remplacer la première version.

## Raffinement asset hero: rubans plus naturels
- [x] Identifier les torsions serrées et les extrémités crispées de la version bouquet V1.
- [x] Assouplir les trois rubans en courbes longues, ouvertes et soumises à une gravité crédible.
- [x] Vérifier que le fond, la lumière, la matière et le format 2:3 restent cohérents.
- [x] Enregistrer le résultat comme nouvelle version sans écraser la V1.

## Génération asset hero: nid de tagliatelles cuites
- [x] Verrouiller le cadrage serré, l'assiette sombre presque hors champ et la garniture minimale.
- [x] Générer un visuel photographique 2:3 sur fond olive sombre uniforme.
- [x] Vérifier la spirale, le beurre léger, la feuille unique, le poivre et l'absence de décor.
- [x] Enregistrer l'asset final dans le projet avec un nom versionné.

## Raffinement asset hero: huile d'herbes verte
- [x] Utiliser le nid V1 comme cible et préserver sa composition, sa lumière et son fond.
- [x] Ajouter un trait fin et quelques gouttes d'huile d'herbes autour de la base uniquement.
- [x] Vérifier que l'accent vert reste élégant, net et sans flaque excessive.
- [x] Enregistrer le résultat comme V2 sans écraser la V1.

## Génération asset annotation: assiette en trois éléments
- [x] Choisir un format carré pour préserver la surface utile et les espaces d'annotation.
- [x] Générer une assiette avec nid, arc d'huile séparé et exactement deux feuilles distinctes.
- [x] Vérifier la séparation visuelle, les ombres, la matière et l'absence de décor parasite.
- [x] Enregistrer l'asset final dans le projet avec un nom versionné.

## Mockups de structure hero (itération v1 à v5, non porté en prod)
> Après le détourage du plat en bol, l'utilisateur a trouvé la hero page "trop vide" malgré le nouveau fond olive. Demande explicite de chercher des inspirations Dribbble/Pinterest avant de retoucher le code, puis d'itérer par mockups HTML autonomes (Artifact) plutôt qu'en prod directement, pour valider la structure avant implémentation réelle.
- [x] Recherche d'inspiration structurelle (termes de recherche fournis à l'utilisateur pour Dribbble/Pinterest: hero fine dining, annotations en arc, indicateur de scroll, panneau plein).
- [x] Détourage `u2net`/`bria-rmbg` + nettoyage (composantes connexes, érosion morphologique, masque elliptique manuel) pour chacun des 3 assets: ruban seul, bouquet de 3 rubans, assiette composée à 3 éléments — `bria-rmbg` échoue systématiquement sur les images >700px large avec une erreur d'allocation mémoire ("bad allocation"/GatherND), toujours retomber sur `u2net` + reconstruction manuelle du masque dans ce cas.
- [x] Mockup v1: ruban seul + fond papier, jugé "trop vide".
- [x] Mockup v2: panneau vert olive plein (bord courbe) + bouquet de 3 rubans, corrige le vide et le manque de vert sur la moitié droite seulement.
- [x] Mockup v3: texte d'accueil + CTA groupés + plat fini à gauche + annotations en italique Cormorant (remplace les pastilles DM Sans jugées "cheap") — toujours vide en haut-gauche, toujours pas assez vert sur la zone claire.
- [x] Mockup v4: fond entièrement vert olive uniforme (lumière recréée par halos radiaux + rai diagonal, pas par une deuxième couleur de fond), colonne de texte unique à gauche (accueil + nom + CTA), UN SEUL plat composé à droite (nid + sauge + huile) avec 3 annotations distinctes reliées chacune à son propre élément — remplace le bouquet de rubans crus qui n'avait que 2 annotations génériques.
- [x] Mockup v5: typographie du bloc gauche unifiée — "Galatee" repassé en Cormorant italique casse mixte (au lieu de majuscules droites) pour prolonger la voix du texte d'accueil, espacements resserrés entre les 3 blocs.
- [x] Mockup v6: nom déplacé dans la nav (Cormorant, plus grand), texte d'accueil agrandi et repassé en ton `--paper` chaud (au lieu du blanc-crème jugé "cheap"), CTA collés juste sous le texte, séparateur central introduit (ligne + losange).
- [x] Mockup v7: fond retravaillé en plusieurs couches (mottling organique grande échelle + grain fin + vignettage asymétrique) pour corriger le côté "cheap" des halos plats initiaux.
- [x] Mockup v8: palette du fond corrigée après retour utilisateur ("olive terracotta pas or") — toutes les teintes gold/champagne remplacées par des tons paper/hillside + terracotta.
- [x] Mockup v9: annotations transformées en vraies vignettes photo zoomées (recadrages macro dédiés pâte/sauge/huile) au lieu de texte seul, réparties dans 3 zones distinctes (haut-gauche, haut-droite, bas) pour éviter que les flèches convergent au même endroit.
- [x] Mockup v10: séparation centrale retravaillée en rayon de lumière verticale + emblème rond "G" de la marque (réutilise le motif déjà présent dans la section réservation), zoom pâte repositionné du côté du plat plutôt que du côté texte.
- [x] Portage en production dans `App.jsx`/`App.css` (voir section dédiée ci-dessous).

## Inserts macro ingrédients carrés
- [x] Générer trois images séparées: pâte cuite, feuille de sauge, huile verte.
- [x] Vérifier les matières, le fond sombre et la cohérence lumineuse de la série.
- [x] Enregistrer les trois PNG carrés dans les assets sans modifier le site. Dimensions: 1254x1254 chacun; copies SHA256 identiques aux rendus inspectés.

## Portage production du hero olive/plat composé (2026-09-04)
> Mockup v10 validé par l'utilisateur ("oui c'est très bien on part sur cette implémentation sur le site"). Portage direct par Claude plutôt que délégué à un agent Codex externe, pour garder tout le contexte des bugs déjà rencontrés sur ce composant.
- [x] Nouveaux assets de production: `hero-dish-composed.png` (plat 3 éléments), `hero-zoom-pasta.png`, `hero-zoom-sage.png`, `hero-zoom-oil.png`.
- [x] Réécriture complète de `.hero-integrated` dans `App.css`: fond olive multicouche (glow×3, folds×3, macro-texture, grain, vignette), séparateur (rayon + ligne + emblème G), colonne de texte (accueil = vrai `<h1>` pour l'accessibilité/SEO, CTA groupés), plat composé centré avec ombre, 3 zoom-callouts annotés reliés par SVG.
- [x] `site-header`/`.wordmark` retravaillés pour le nouveau fond sombre: couleur `--paper`, scrim translucide + flou, wordmark agrandi avec accent italique terracotta sur le "e".
- [x] `hero-menu-tile` retiré (redondant avec le nouveau CTA "Voir le menu").
- [x] Nouvelle mise en page mobile dédiée (`@media max-width:900px`): colonne flex (plat → rangée de 3 zoom-callouts → texte → CTA), séparateur/scroll-cue/lignes SVG masqués (n'ont de sens qu'en layout 2 colonnes desktop), tailles réduites en paysage bas (`orientation:landscape, max-height:600px`).
- [x] Nettoyage: suppression de 12 assets hero devenus inutilisés (anciennes itérations bol/ruban/bouquet/carnet).
- [x] Vérifié: `npm run build`, `npm test` (40/40), aucune erreur console, aucun overflow à 320/390/430/844×390/1440/1920px (desktop et mobile).

## Correctifs post-portage: trou responsive 900-1300px
> L'utilisateur a signalé 3 symptômes distincts (détourage du plat "pas bon" à droite, flèche/zoom de la sauge "pas bien réglés", callout huile coupé) sur une fenêtre ~907px de large — en réalité une seule cause: le breakpoint mobile s'arrêtait à 900px alors que la mise en page desktop à positionnement absolu ne se dégradait pas proprement entre 900 et ~1300px.
- [x] Breakpoint hero mobile étendu de `max-width:900px` à `max-width:1180px` — la mise en page colonne (déjà robuste) couvre maintenant toute la zone intermédiaire.
- [x] Position verticale du callout "huile" recalculée en `calc(50% + clamp(...vw...))` au lieu de `clamp(px, vw, px)` pur, pour rester proportionnelle à la hauteur réelle de la fenêtre (pas seulement la largeur) et ne plus déborder de `.hero` (`overflow:hidden`) sur une fenêtre desktop large mais basse.
- [x] `border-radius:50%` retiré de `.hero-dish img` (redondant avec l'alpha du PNG déjà détouré en ellipse — aucun changement visuel, juste du nettoyage).
- [x] Point de départ de la flèche "Sauge fraîche du jour" repositionné sur le bord gauche du cercle photo au lieu du bas, pour ne plus croiser la légende.
- [x] Revérifié à 907px (largeur exacte signalée), 1100/1200/1440px à hauteur réduite (800px), `npm test` (40/40), aucune erreur console.
- [x] L'utilisateur a signalé une récidive sur une fenêtre large mais basse (~1920×800, callout "huile" encore coupé) — le correctif précédent ne couvrait pas ce couple largeur/hauteur. Remplacé par une variable CSS unique `--dish-w: clamp(300px, min(38vw, 60vh), 560px)` sur `.hero-integrated`, dont dérivent maintenant la largeur du plat ET les décalages des 3 callouts (`calc(var(--dish-w) * coefficient)`) — tout se contracte ensemble dès qu'une dimension devient limitante, plus robuste qu'un `clamp()` indépendant par élément. Revérifié à 1920×800, 1920×850, 1600×750, 1440×900 (référence inchangée) et mobile — `npm test` (40/40).

## Correctifs: flèches désynchronisées, agrandissement, retrait "Découvrir" (2026-09-04)
- [x] Cause racine des flèches "mal réglées" à un ratio d'écran large (~1886×866): le SVG des 3 lignes de connexion utilisait `viewBox="0 0 1440 900" preserveAspectRatio="none"` avec des coordonnées fixes, qui étire les deux axes de façon non uniforme dès que le ratio réel diverge de 1440:900 — désynchronisant les lignes des vraies positions des callouts/du plat.
- [x] Remplacé par un nouveau composant `HeroDish` qui mesure les positions réelles via `getBoundingClientRect()` (`useLayoutEffect` + listeners resize/orientationchange + re-mesure après chargement de l'image du plat) et dessine le SVG en pixels bruts sans `viewBox` — les lignes restent exactes à n'importe quel ratio d'écran, plus seulement à 1440:900.
- [x] `--dish-w` agrandi (`clamp(340px, min(43vw, 64vh), 630px)`, était 300-560) et texte d'accueil agrandi (`hero-eyebrow` 38-54px, était 34-46px; `hero-eyebrow-note` 15.5px, était 14.5px).
- [x] Indicateur "Découvrir" (texte vertical à gauche) retiré du JSX et de tout le CSS associé, à la demande de l'utilisateur.
- [x] Régression découverte et corrigée en cours de route: le nouveau conteneur `.hero-dish-wrap` (`position:absolute`) cassait la mise en page mobile (colonne flex avec `order`) en sortant plat/callouts du flux — corrigé avec `display:contents` sur ce wrapper dans le breakpoint mobile.
- [x] Vérifié: build, `npm test` (40/40), aucune erreur console (desktop large + mobile), lignes correctement alignées à 1886×866 et 1440×900, mobile et 320px toujours propres.

## Simplification du fond: plus sombre, plus vert, une seule source de lumière (2026-09-04)
> Retour: fond "pas assez haute qualité à cause des petits points" et "pas assez dark"; demande de vert olive fort avec juste une petite touche de luminosité, éventuellement seulement via le séparateur central.
- [x] Dégradé de base assombri (`linear-gradient(128deg, #2b2b15, #232310, #191808)`, était `#3a3a1c/#34331a/#2e2d17`).
- [x] Supprimé les 7 calques de lumière dispersés (`hero-glow-1/2/3`, `hero-glow-ray`, `hero-fold-1/2/3`) qui créaient un effet de bruit non intentionnel plutôt qu'un fond premium.
- [x] Grain fin réduit drastiquement (opacité SVG interne `.18`→`.05`, opacité du calque `.85`→`.3`) — c'était la cause des "petits points". Mottling grande échelle (`hero-macro-texture`) gardé mais réduit (`.5`→`.3`) pour la profondeur organique sans lire comme du bruit.
- [x] Rayon de lumière du séparateur central accentué (largeur `min(220px,18vw)`→`min(320px,26vw)`, opacités renforcées) pour rester la seule touche de luminosité intentionnelle.
- [x] Vérifié: build, `npm test` (40/40), zoom sur le fond confirmant l'absence de grain visible, desktop et mobile propres.

## Retrait complet du grain (2026-09-04)
> L'utilisateur trouvait le grain encore trop présent après la réduction précédente et a précisé ne pas l'aimer du tout, pas juste "trop fort" — demande explicite d'une alternative de nature différente.
- [x] `hero-macro-texture` et `hero-texture` (les deux calques `feTurbulence`) retirés complètement du CSS et du JSX — plus aucune texture bruitée dans le hero.
- [x] Dégradé de base enrichi à 5 arrêts de couleur (`linear-gradient(135deg, #302f18, #262510, #1e1d0d, #17160a, #131209)`) pour porter seul la richesse visuelle du fond, sans texture.
- [x] Vérifié: build, `npm test` (40/40), desktop et mobile — fond parfaitement lisse, aucun grain visible.

## Lumière du séparateur resserrée sur le trait (2026-09-04)
- [x] `hero-divider-beam` (large bande de lueur, jusqu'à 320px) supprimé du CSS et du JSX.
- [x] `hero-divider-line` (le trait de 1px) renforcé directement: opacité du dégradé montée à `.85`, `box-shadow: 0 0 10px 1px` pour une lueur serrée collée au trait plutôt qu'étalée sur toute une bande.
- [x] Vérifié: build, `npm test` (40/40), desktop et mobile.

## Ajout d'un texte de bienvenue en haut du bloc gauche (2026-09-04)
> Retour: le haut du bloc gauche paraissait vide.
- [x] "Bienvenue chez Galatee" ajouté avant le titre, en réutilisant le motif `.eyebrow`/`.eyebrow-light` déjà établi ailleurs sur le site (petit trait + texte capitales espacées, couleur terracotta) pour rester cohérent avec le reste du site plutôt que d'inventer un nouveau style.
- [x] Timing d'entrée: apparaît en premier (750ms), avant le titre (950ms) et les CTA (1150ms).
- [x] Vérifié: build, `npm test` (40/40), desktop et mobile.
- [x] Correction demandée: "Bienvenue" devait être le texte LE PLUS grand, pas un petit kicker au-dessus. Inversé la hiérarchie — "Bienvenue chez Galatee." devient le grand titre (`hero-eyebrow`), l'ancienne phrase "Ici, la pâte se roule à la main" descend dans le sous-titre, fusionnée avec la phrase existante. Petit kicker `.eyebrow`/`hero-welcome-kicker` retiré (CSS + JSX). Vérifié: build, `npm test` (40/40), desktop et mobile.

## Correctif alignement du trait de séparation (2026-09-04)
> Retour: le trait commençait/finissait bizarrement par rapport à la nav et à la fin du hero.
- [x] Mesuré précisément via CDP: le trait (`top:10%`/`bottom:10%`, relatif à la hauteur du hero) démarrait à 90px alors que le bas réel de la nav est à ~103px — le trait était donc partiellement caché DERRIÈRE la nav plutôt que de démarrer clairement en dessous.
- [x] Remplacé par des décalages fixes non ambigus: `top:140px` (dégage la nav avec ~37px de marge quelle que soit la largeur), `bottom:60px` (marge constante avant la fin réelle du hero, au lieu d'un pourcentage qui variait avec la hauteur).
- [x] Emblème "G" recentré sur le nouveau milieu visuel du trait (`top: calc(50% + 40px)` au lieu de `50%`), pour rester au vrai centre du trait malgré les marges asymétriques haut/bas.
- [x] Revérifié par mesure exacte (nav bottom 102.8px vs trait top 140px, marge propre), visuellement à 1440×900 et 1920×1000, `npm test` (40/40).
## Jeu de donnees de demonstration reproductible (2026-09-04)
> Objectif: fournir plusieurs donnees reelles en SQLite pour la presentation, sans reseed automatique au demarrage ni pollution d'une installation client.
- [x] Definir une commande explicite de seed demo avec donnees deterministes et dates de service proches de la date d'execution.
- [x] Alimenter reservations, blocages, revenus et evenements analytics sans doublons.
- [x] Ajouter une option de nettoyage demo et documenter l'usage dans l'API/deploiement.
- [x] Ajouter des tests d'idempotence et verifier les endpoints live avec le jeu de donnees.

## Plan de finition hero (2026-09-04)
> Critique de design demandée par l'utilisateur, 6 points confirmés puis implémentés directement (option A retenue pour le fond: deux champs de couleur qui se fondent, pas de panneau à bord dur).
- [x] 1. Micro-info discrète ajoutée en bas à gauche: "Hydra, Alger — Mercredi–Samedi, dès 19h." (`.hero-micro-info`), ancre le vide sous les CTA.
- [x] 2. Courbe SVG "Huile de sauge dorée" corrigée: ajout d'un paramètre de "bow" (déport perpendiculaire) dans `HeroDish`, appliqué uniquement à cette ligne (`DISH_ZOOM_BOW.oil = 46`) pour qu'elle contourne le bord cuivré au lieu de le traverser. Les 2 autres lignes gardent bow=0 (déjà correctes).
- [x] 3. Décalage vertical des callouts pâte/sauge réduit (`-78px` → `-48px` dans le calcul `--dish-w`), dégage clairement la nav même à la taille de plat maximale (630px).
- [x] 4. Bug d'accessibilité corrigé: `aria-hidden` retiré du conteneur englobant (`.hero-dish-wrap`), réappliqué individuellement sur les éléments purement décoratifs (photos macro, image du plat, SVG des lignes) — vérifié via DOM que les 3 légendes texte sont maintenant exposées à un lecteur d'écran alors que les visuels restent cachés.
- [x] 5. Sous-titre séparé en 3 blocs distincts: `h1.hero-eyebrow` ("Bienvenue chez Galatee."), `p.hero-lede` ("Ici, la pâte se roule à la main.", italique moyen), `p.hero-eyebrow-note` (phrase factuelle, plus discrète) — chacun avec sa propre animation d'entrée échelonnée.
- [x] 6. Fond recomposé avec les 2 couleurs principales à poids réel: deux `radial-gradient` superposés (champ olive ancré à 23% côté texte, champ terracotta désaturé ancré à 79% côté plat) par-dessus un dégradé de base sombre — se fondent naturellement au niveau du trait central, aucun bord dur, aucune texture.
- [x] Vérifié: build, `npm test` (42/42, 2 nouveaux tests détectés d'un autre chantier), aucune erreur console, 320/390/1440/1920px et mobile propres, accessibilité confirmée par inspection DOM.

## Flèches d'annotation sur mobile (2026-09-04)
> Retour avec capture de référence (post Instagram "THE STEAK & TOAST"): sur mobile, les 3 légendes ingrédients étaient affichées en simple rangée sous l'assiette, sans ligne de connexion — demande de reprendre le style "diagramme annoté" (lignes droites du label vers le point exact sur le plat), déjà utilisé sur desktop.
- [x] Réutilisé le système existant (`HeroDish`, lignes SVG mesurées via `getBoundingClientRect`) au lieu d'en recréer un: sur mobile, `.hero-dish-wrap` passe de `display:contents` (rangée à plat) à un vrai conteneur `position:relative` qui enveloppe l'assiette + les 3 callouts positionnés en absolu autour d'elle (pâte en haut-gauche, sauge en haut-droite, huile en bas-centre), avec le SVG de lignes réactivé (`display:none` retiré).
- [x] `DISH_ZOOM_BOW` (déport de la courbe "huile" autour du bord de l'assiette) converti d'un décalage fixe en pixels (`46`) en fraction de la distance de la ligne (`0.22`) — un décalage fixe était correct pour l'assiette desktop (~340-630px) mais disproportionné pour l'assiette mobile (~180-230px); la fraction s'adapte automatiquement à toute taille.
- [x] Vérifié: build, `npm test` (42/42), captures 320/390px portrait et 844×390 paysage court — 3 lignes bien connectées, aucun débordement, marges suffisantes pour les labels aux coins de l'écran.

## Rééquilibrage olive/terracotta + harmonie crème (2026-09-04)
> Retour: "le vert domine un peu trop". Évaluation demandée avant correction.
- [x] Diagnostic: alpha inégal (olive `.55` vs terracotta `.42`) ET champ terracotta centré sous l'assiette (opaque, quasi noire) qui masquait la majorité de sa surface visible — le peu qui restait ne suffisait pas à lire comme une vraie couleur de marque.
- [x] Rééquilibré: terracotta désormais au-dessus de l'olive en poids (`.6` vs `.42`), ancres écartées vers les bords (`15%` / `86%` au lieu de `23%` / `79%`) pour que chaque côté ait un territoire net et que le trait central soit la vraie couture.
- [x] Harmonie crème (idée proposée puis implémentée): un "wash" crème ambiant très discret (`rgba(228,222,192,.05)`) ajouté dans `.hero-vignette` (calque existant, pas de nouvel élément DOM) — pas une bande visible comme le beam retiré précédemment, juste une température de lumière commune qui unifie les deux champs de couleur sans nouveau bord. L'emblème "G" (point de croisement exact des deux ambiances) reçoit un anneau et une lueur crème (`box-shadow`), gardant sa lettre terracotta — matérialise "crème = matière connective, olive/terracotta = les deux contenus qu'elle relie".
- [x] Vérifié: build, `npm test` (42/42), captures 1440px et mobile 390px — terracotta clairement lisible aux bords droit/coins, aucune régression.

## Série burro e salvia sur céramique blanc os
- [x] Générer le plat principal carré en vue zénithale et les trois macros centrées.
- [x] Vérifier la cohérence lumière/céramique, les ingrédients séparés et les cadrages. Corriger la largeur et les extrémités du ruban; retirer les feuilles ajoutées dans l'huile; dégager les marges de la sauge.
- [x] Sauvegarder les quatre assets versionnés et leurs prompts; conserver les précédents, sans modifier le code du site. PNG 1254x1254, copies vérifiées par SHA256.

## Réordonnancement mobile (texte+CTA avant le plat) + vrai correctif des flèches (2026-09-04)
> Demande: sur mobile, le texte et les CTA doivent apparaître AVANT le plat (pas après), et corriger les flèches.
- [x] Inversé l'ordre flex: `.hero-content` passe de `order:2` à `order:1`, `.hero-dish-wrap` de `order:1` à `order:2` — texte+CTA en premier, plat+flèches ensuite.
- [x] Bug réel trouvé en vérifiant le format paysage court (844×390): le cercle "Tagliatelle" chevauchait le bouton "Voir le menu". Cause racine identifiée par inspection CDP (`CSS.getMatchedStylesForNode`), PAS une supposition: la section porte `className="hero hero-integrated"` (deux classes) — une règle historique et non liée `.hero { height: 100svh }` (ligne 35, pour l'ancien hero) regagnait la priorité sur `.hero-integrated { height: auto }` en mode paysage, car les deux sélecteurs ont la même spécificité (une classe) et celui du hero legacy était déclaré plus tard dans le fichier dans ce contexte précis. Résultat concret: `.hero-integrated` se retrouvait figé à 390px de haut, le flex forçait `.hero-content` (qui a `min-height:0`) à s'écraser à 0px de hauteur réelle tout en laissant son contenu déborder visuellement par-dessus le plat.
- [x] Corrigé à la racine (pas de contournement): sélecteur remonté en spécificité, `.hero-integrated { height:auto }` → `.hero.hero-integrated { height:auto }`, qui bat désormais `.hero { height:100svh }` dans tous les contextes, plus besoin de dépendre de l'ordre des règles dans le fichier.
- [x] Vérifié: build, `npm test` (42/42), captures 320px/390px portrait, 844×390 paysage court, et 1440px desktop (aucune régression) — plus aucun chevauchement, flèches bien connectées partout.
## Setup presentation Vercel + tunnel backend local (2026-09-04)
> Objectif: publier le build React et les mockups sur Vercel, tout en gardant SQLite et le serveur Node local exposes par un tunnel HTTPS.
- [x] Auditer et configurer le build Vercel avec SPA rewrites sans intercepter `public/mockups/*`.
- [x] Ajouter la priorite `VITE_API_BASE > window.GALATEE_API_BASE > /api` au public et au backoffice.
- [x] Ajouter CORS configurable et preflight OPTIONS au serveur Node sans toucher aux routes metier.
- [x] Ajouter le script de tunnel Windows et la documentation de presentation.
- [x] Verifier `npm run build`, `npm test` et les fichiers deployes principaux.
## Serie de 9 macros alimentaires Galatee (2026-09-05)
> Objectif: creer une serie coherente de macros carrees pour les callouts plats, avec marge circulaire et ceramique blanc os, sans modifier les assets existants.
- [x] Generer les neuf sujets avec le meme traitement editorial et les noms cibles exacts.
- [x] Inspecter les sorties et les copier dans `frontend-react/public/assets/`.
- [x] Reconstruire `dist/` et verifier que les neuf images sont servies.

## Fiche plat avec composition annotee (2026-09-05)
> Objectif: remplacer les zooms d'ingredients par une image unique du plat, avec des libelles et des fleches relies aux zones de composition comme la reference fournie.
- [x] Creer le composant d'annotation mesure et l'integrer a la route `/menu/:slug`.
- [x] Ajouter les compositions textuelles des trois plats et leurs styles responsive.
- [x] Verifier les routes, le build et l'affichage sur desktop et mobile.

## Statistiques de pilotage sans revenus (2026-09-05)
> Objectif: conserver les indicateurs utiles au restaurant sans afficher ni calculer de chiffre d'affaires dans le dashboard: visites du menu, demande de reservation, creneaux demandes et suivi des statuts.
- [x] Ajouter l'evenement anonyme de visite du menu et ses donnees de demonstration.
- [x] Exposer un payload de statistiques sans revenus, avec les creneaux les plus demandes.
- [x] Remplacer l'onglet Revenus par un espace Statistiques site et retirer les cartes revenue de l'interface.
- [x] Verifier les contrats reservation/menu, le build et la suite de tests.

## Comptes clients sans mot de passe (2026-09-05)
> Objectif: ajouter une authentification client par code email, sans rendre le compte obligatoire pour reserver, avec preremplissage et historique; le backend et SQLite restent locaux.
- [x] Ajouter le schema/migrations des comptes, codes OTP, sessions et lien reservation-compte.
- [x] Implementer l'envoi Brevo configurable, la verification OTP et les limites anti-abus.
- [x] Ajouter les routes publiques auth/profil/historique et rattacher les reservations authentifiees.
- [x] Retirer la dependance a un compte admin visible sans affaiblir la protection technique optionnelle.
- [x] Ajouter tests, documentation d'installation et verifier les contrats existants.

## Interface compte client (2026-09-05)
> Objectif: connecter le site public aux comptes sans mot de passe du backend, avec un parcours discret, editorial et mobile-first.
- [x] Auditer les surfaces publiques actuelles et definir le parcours compte/login.
- [x] Ajouter le contexte de session, les appels API et la persistance de session navigateur.
- [x] Integrer les actions de compte dans la navigation et la page de connexion par code.
- [x] Ajouter la page compte avec coordonnees et reservations en cours/passees.
- [x] Prefill les reservations connectees sans rendre le compte obligatoire.
- [x] Verifier acces clavier, etats d'erreur, responsive, build et tests.

## Diagnostic envoi OTP Brevo (2026-09-05)
> Objectif: rendre le refus Brevo actionnable sans exposer de secret.
- [x] Lire le statut et le message d'erreur Brevo dans le journal serveur.
- [x] Ajouter un test du refus fournisseur et verifier la suite complete.

## Validation date reservation (2026-09-05)
> Objectif: permettre la soumission d'une date affichee au format JJ/MM/AAAA.
- [x] Corriger le pattern HTML qui bloque la validation native du champ date.
- [x] Rebuild et verifier la soumission avec une date valide.

## Structure des pages publiques et espace compte (2026-09-05)
> Objectif: clarifier les parcours Menu, Reservation, Contact, Informations et Compte, avec une vraie composition desktop et une declinaison mobile pensee pour le pouce.
- [x] Auditer les composants et tokens existants sans toucher au hero, au backend ni a l'admin.
- [x] Recomposer les pages publiques en sequences editoriales lisibles et reutiliser les primitives React existantes.
- [x] Recomposer l'acces compte, la connexion et le carnet client avec des etats vides/erreur explicites.
- [x] Verifier les routes, le clavier, les CTA, le responsive et les contrats de reservation.

## Correction composition PC et mobile (2026-09-05)
> Objectif: rendre la hierarchie visiblement plus forte sur ordinateur et decliner chaque route pour une lecture mobile au pouce.
- [x] Mesurer les axes et hauteurs actuels sur reservation et les pages publiques.
- [x] Corriger la composition desktop partagee et les rythmes mobiles sans toucher au hero, backend ou admin.
- [x] Rejouer les parcours et les verifications de rendu sur les tailles cibles.

## Structure mobile inspirée des références (2026-09-05)
> Objectif: donner aux pages publiques mobiles une séquence centrée, compacte et orientée pouce, inspirée des références visuelles fournies.
- [x] Auditer les écarts de structure sur réservation, compte, menu, informations et contact.
- [x] Corriger uniquement les règles mobiles afin de préserver la composition PC.
- [x] Vérifier le rendu, les zones tactiles, les ancres et l'absence de débordement aux tailles cibles.

## Rééquilibrage mobile réservation et compte (2026-09-05)
> Objectif: remplacer l'empilement centré par une composition éditoriale avec rail latéral et groupes compacts.
- [x] Recomposer réservation avec texte à gauche, emblème latéral, étapes en colonnes et formulaire séparé.
- [x] Recomposer compte avec index à gauche et contenu d'accès ou profil à droite dans le flux mobile.
- [x] Vérifier 320, 390 et 430 px après build, sans débordement ni erreur navigateur.

## Découpage mobile par écrans (2026-09-05)
> Objectif: isoler l'introduction, le chemin éditorial et le formulaire ou profil dans des écrans successifs sur mobile portrait.
- [x] Transformer réservation en trois séquences verticales de hauteur d'écran sans modifier le desktop.
- [x] Appliquer la même progression à l'accès compte et au compte connecté.
- [x] Vérifier les tailles portrait, le paysage court, le clavier et l'absence de débordement.

## Remplissage visuel des écrans mobiles (2026-09-05)
> Objectif: occuper chaque écran par un rythme éditorial maîtrisé, sans ajouter de texte répétitif ni créer de débordement.
- [x] Regrouper titre et texte, ancrer le repère de progression en bas et équilibrer l'espace avec un index typographique discret.
- [x] Corriger la largeur du repère pour les petits mobiles et conserver le mode flux en paysage.
- [x] Vérifier les bornes, le rendu Chrome, le build et les tests.

## Répartition des repères sur le premier écran (2026-09-05)
> Objectif: utiliser l'espace bas de l'introduction avec des informations pratiques courtes avant le chemin ou l'accès.
- [x] Ajouter une bande de repères service au premier écran de réservation et compte.
- [x] Garder les écrans successifs jointifs et le desktop inchangé.
- [x] Rejouer les captures et les tests sans débordement ni texte coupé.

## Correction affichage email compte (2026-09-05)
> Objectif: restaurer une largeur de formulaire correcte pour la saisie email en login et signup mobile.
- [x] Corriger l'orientation du panneau d'accès afin que la barre d'étape et le formulaire ne soient plus côte à côte.
- [x] Vérifier login et signup sur 390 px, avec champ email visible et pleine largeur.
- [x] Rebuild et tests finaux.

## Panneau compte aligné sur la réservation (2026-09-05)
> Objectif: donner au compte une surface de saisie claire, respirante et cohérente avec le panneau de réservation.
- [x] Transformer le panneau mobile en une seule surface pleine largeur, avec contexte séparé puis formulaire.
- [x] Déplacer les repères pratiques vers le premier écran de réservation et supprimer la mention des couverts.
- [x] Vérifier les tailles portrait, le paysage, le champ email et les tests de non-régression.

## Séquence réservation et compte (2026-09-05)
> Objectif: traduire les références fournies en écrans mobiles successifs, lisibles et immédiatement reliés au formulaire ou au carnet.
- [x] Séparer le chemin vers la table et les informations de service en deux écrans mobiles avant le formulaire.
- [x] Conserver l'écran d'accès compte avant la création de compte et le carnet d'adresse avant l'historique.
- [x] Vérifier 320, 390, 430, paysage, les formulaires, les ancres et l'absence de débordement.

## Entrée mobile directe par contenu principal (2026-09-05)
> Objectif: supprimer les introductions intermédiaires et ouvrir chaque parcours sur le contenu montré dans les références utilisateur.
- [x] Commencer la réservation par un écran unique chemin + repères de service, puis afficher le formulaire.
- [x] Commencer l'accès compte par “Un accès discret”, puis afficher directement le panneau de connexion ou création.
- [x] Commencer le compte connecté par le carnet d'adresse, puis afficher directement les réservations.
- [x] Vérifier les tailles mobiles, la structure des écrans, le formulaire, l'email et l'absence de débordement.

## Fusion du contexte réservation et cartes du carnet (2026-09-05)
> Objectif: rapprocher la réservation des références fournies et rendre les réservations existantes immédiatement scannables.
- [x] Intégrer le `G`, le chemin, les étapes et les repères de service dans une seule page mobile.
- [x] Supprimer le titre intermédiaire “Le service en clair” et conserver uniquement les données utiles en bas du bloc.
- [x] Transformer chaque réservation du compte en carte bordée, lisible sur mobile et desktop.
- [x] Réorganiser le panneau de connexion avec un titre et une explication mieux hiérarchisés.

## Simplification finale réservation et accès compte (2026-09-05)
> Objectif: privilégier une composition mobile directe, avec peu d'éléments mais une hiérarchie nette.
- [x] Aligner le texte de réservation à gauche, le `G` à droite et les repères de service en bas.
- [x] Retirer les étapes numérotées de la composition mobile.
- [x] Simplifier le panneau connexion/création en colonne unique lisible.
- [x] Vérifier les tailles mobiles, l'email, les cartes du carnet et l'absence de débordement.

## Correction mobile reservation + connexion (2026-09-05)
- [x] Inspecter les vues live a 320/390 et comparer la cascade mobile aux intentions desktop.
- [x] Recomposer la premiere vue reservation pour reduire le vide et donner une hierarchie typographique stable.
- [x] Refaire la vue mobile du panneau de connexion dans la meme logique visuelle que le desktop, sans casser les champs/hooks.
- [x] Verifier build, syntaxe, tests et rendu mobile/overflow.

## Resserrement du passage reservation vers formulaire (2026-09-05)
- [x] Agrandir legerement la typographie du bloc editorial mobile.
- [x] Reduire la hauteur morte avant le formulaire.
- [x] Rejouer build et tests apres la correction.

## Harmonisation des titres et panneaux mobiles (2026-09-05)
- [x] Aligner le titre de reservation sur celui du formulaire.
- [x] Restaurer un vrai panneau compte inspire du desktop.
- [x] Rebuild et verifier les contrats existants.

## Recomposition de l'introduction compte mobile (2026-09-05)
- [x] Supprimer la grille laterale et la ligne extensible qui creent le vide.
- [x] Recomposer le contenu en colonne editoriale alignee a gauche.
- [x] Verifier la continuite vers le panneau de connexion.

## Couverture mobile compte et reservation ouverte (2026-09-05)
- [x] Remplacer l'introduction compte par la couverture editoriale “Une adresse, une table.”.
- [x] Retirer le G et le cadre de la premiere vue reservation.
- [x] Reespacer les titres et relancer les verifications.

## Nettoyage du repere compte mobile (2026-09-05)
- [x] Retirer le grand index decoratif qui recréait un vide visuel.
- [x] Ajouter un repere de transition utile avant le panneau compte.
- [x] Vérifier le bundle React et les tests.

## Flux naturel couverture compte mobile (2026-09-05)
- [x] Supprimer la hauteur minimale qui separait artificiellement le repere du panneau.
- [x] Garder les faits et le repere dans le flux normal.
- [x] Rebuild et verification Chrome du passage vers le formulaire.

## Ancrage editorial couverture compte (2026-09-05)
- [x] Garder le panneau sur l'ecran suivant.
- [x] Ancrer les faits et le repere en bas de la couverture.
- [x] Rebuild et mesure Chrome de la sequence.

## Densification douce couverture compte (2026-09-05)
- [x] Utiliser l'intertitre editorial existant pour structurer le milieu de page.
- [x] Conserver la couverture pleine hauteur et le panneau sur l'ecran suivant.
- [x] Rebuild et mesure finale.

## Audit Chrome compte mobile (2026-09-05)
- [x] Corriger la repartition verticale visible dans la couverture compte.
- [x] Conserver une premiere vue seule puis un panneau compte coherent.
- [x] Refaire l'audit DevTools mobile avant validation.

## Reprise visuelle complete compte mobile (2026-09-05)
- [x] Recomposer la couverture sur une hauteur mobile complete.
- [x] Harmoniser la matiere et le contraste avec #EFE9E9 / #5A2123 / #151816.
- [x] Valider le rendu final par inspection Chrome DevTools.

## Retrait de la palette non demandee (2026-09-05)
- [x] Restaurer les couleurs historiques de la route compte.
- [x] Conserver sans changement la structure mobile actuelle.
- [x] Reconstruire et controler Chrome sur une URL fraiche.

## Acces compte mobile direct (2026-09-05)
- [x] Retirer la couverture mobile devant les formulaires connexion et creation.
- [x] Unifier la surface du panneau et refermer visuellement sa bordure basse.
- [x] Verifier les deux modes dans Chrome mobile apres build.

## Matiere du panneau compte mobile (2026-09-05)
- [x] Reprendre la composition de surface du formulaire de reservation.
- [x] Supprimer le retrait sous le panneau avant la transition olive.
- [x] Mesurer la transition et les deux modes dans Chrome mobile.

## Audit interactions site public (2026-09-05)
> Objectif: corriger le menu mobile et vérifier les actions du site public sur mobile et desktop, sans toucher au back-office.
- [x] Reproduire le menu mobile par clic tactile et identifier les éléments qui interceptent le pointer.
- [x] Auditer les boutons, liens, filtres, dialogues, calendrier et parcours compte/réservation.
- [x] Corriger les interactions publiques défaillantes et vérifier les régressions.
- [x] Tester les routes publiques sur plusieurs tailles et documenter les résultats.

## Correctif menu mobile signale (2026-09-05)
> Objectif: garantir qu'une sélection dans le tiroir mobile ferme toujours le menu, y compris quand l'utilisateur sélectionne la route déjà active.
- [x] Fermer explicitement le tiroir après chaque lien mobile.
- [x] Vérifier le clic depuis l'accueil et depuis `/menu` à 390 px et 320 px.
- [x] Rejouer les tests de build et de régression publique.

## Correctif menu mobile sur HTTP local (2026-09-05)
> Objectif: empêcher le suivi de visite de casser la route `/menu` sur un téléphone connecté à l'adresse réseau du PC.
- [x] Rendre l'identifiant de session compatible avec les contextes HTTP sans `crypto.randomUUID`.
- [x] Protéger l'appel analytique contre les erreurs synchrones.
- [x] Reconstruire et vérifier le menu mobile.

## Devis Galatee PDF (2026-09-05)
- [x] Définir le stack final et retirer l'AISEO du périmètre.
- [x] Rédiger les fonctionnalités détaillées et les conditions commerciales.
- [x] Générer le devis noir et blanc avec le total placé en fin de document.
- [x] Rendre et inspecter visuellement les quatre pages du PDF.
- [x] Appliquer la direction fond noir, typographie claire et total final en bas à droite.
- [x] Mettre à jour les montants et supprimer la validité ainsi que les textes de couverture superflus.
- [x] Retirer toutes les mentions de taxes et renforcer la typographie avec des polices intégrées.
- [x] Corriger le nom d'un prestataire en « Meamr Mohamed ».
- [x] Détailler dans le devis la base de disponibilités et sa gestion administrative future.

## Mise à jour du devis SEO et anonymisation (2026-09-06)
- [x] Retirer les noms des prestataires du contenu et des métadonnées PDF.
- [x] Remplacer les conditions commerciales par la seule mention des frais externes.
- [x] Expliquer les principaux éléments SEO et leur utilité dans le devis.
- [x] Regénérer et inspecter visuellement les cinq pages du PDF.

## Gestion des disponibilités récurrentes (2026-09-06)
- [x] Ajouter la lecture et la mise à jour sécurisées des services récurrents.
- [x] Empêcher le seed de démarrage d'écraser les réglages enregistrés.
- [x] Ajouter le panneau d'édition dans le back-office en conservant le design Claude.
- [x] Corriger le raccord `timeSlots` de l'API vers la page Disponibilités.
- [x] Vérifier persistance, validations, build et tests.

## Planning global et événements spéciaux (2026-09-06)
- [x] Remplacer le planning par jour par une configuration globale persistante.
- [x] Ajouter les événements spéciaux par date ou période avec priorité sur le planning global.
- [x] Connecter le calcul de disponibilité au nombre de tables et à la capacité par table.
- [x] Empêcher le surbooking : une confirmation consomme une table et le créneau se bloque quand le quota est atteint.
- [x] Refaire le panneau Disponibilités dans le style du back-office existant.
- [x] Ajouter les tests de priorité, persistance et prévention du surbooking.
- [ ] Prévoir l'attribution nominative d'une table physique dans une prochaine version si le restaurant en a besoin.
- [x] Refuser les événements spéciaux qui se chevauchent.
- [x] Refuser une modification qui invalide une réservation confirmée future.
- [x] Conserver l'historique des anciennes configurations globales.

## Validation des créneaux et sélection des horaires (2026-09-06)
- [x] Remplacer les champs horaires libres par des options alignées sur l'intervalle.
- [x] Refuser côté backend les demandes sans table compatible ou sur un créneau bloqué/complet.
- [x] Afficher immédiatement l'état de disponibilité dans le formulaire public.
- [x] Ajouter les tests HTTP et système pour ces validations.
- [x] Recalculer les anciens blocages automatiques après un changement du nombre de tables.

## Mockup chic "Menu Manifeste" (2026-09-05)
> Objectif: reconstruire `chic-full.html` dans une direction éditoriale asymétrique, avec une composition mobile autonome et uniquement les trois images de plats validées.
- [x] Formaliser la grille, la hiérarchie et les motifs de la direction retenue sans logique carnet.
- [x] Recomposer les six sections desktop et la navigation du hero dans un mockup monopage.
- [x] Construire une structure mobile dédiée pour le hero, le menu, le plat, la réservation, les informations et le contact.
- [x] Vérifier les ancres, les interactions, le responsive, l'absence d'images non autorisées et le rendu visuel desktop/mobile.

## Recomposition chic autour du hero valide (2026-09-05)
> Objectif: intégrer exactement le hero `hero-chic.html`, conserver la disposition du menu à une échelle plus raffinée et limiter les sections éditoriales fortes à deux moments du parcours.
- [x] Transplanter le hero de référence avec sa navigation et sa composition mobile, sans réinterprétation visuelle.
- [x] Resserer le menu existant en réduisant textes et images tout en conservant son asymétrie.
- [x] Recomposer le geste en section éditoriale forte, puis simplifier réservation, informations et contact dans la même grammaire.
- [x] Vérifier desktop, mobile dédié, ancres, interactions et restriction des images aux trois plats validés.

## Rééquilibrage olive, terracotta et mobile (2026-09-05)
> Objectif: alléger le hero, renforcer la palette de marque et donner au menu ainsi qu'au manifeste une composition mobile réellement dédiée.
- [x] Retirer l'étiquette botanique du hero et supprimer tous les prix du menu.
- [x] Renforcer les surfaces olive et terracotta; traiter chaque fond crème avec la matière lumineuse du hero.
- [x] Améliorer le manifeste desktop et le condenser en une seule composition mobile.
- [x] Faire tenir les trois plats ensemble dans un menu mobile asymétrique, puis vérifier desktop et 320/390 px.

## Harmonisation après le menu (2026-09-06)
> Objectif: conserver le hero et le menu validés, puis unifier philosophie, réservation, informations et contact dans leur même système visuel.
- [x] Formaliser les rôles de surface communs: papier lumineux, panneau olive, accent terracotta et traits fins.
- [x] Harmoniser la philosophie et la réservation sans modifier leur contenu ni leurs interactions.
- [x] Simplifier informations et contact pour prolonger le même rythme éditorial.
- [x] Vérifier desktop, 390 px et 320 px, puis contrôler les images, interactions et débordements.

## Navigation mobile et lien Instagram (2026-09-06)
- [x] Garder la navigation visible uniquement en haut de page, puis masquée pendant le scroll.
- [x] Remplacer le lien Instagram générique par le compte officiel Galatee.
- [x] Vérifier le build et republier le frontend sur Vercel.

## Visibilité de la navigation au scroll (2026-09-06)
- [x] Masquer la navigation après le début du défilement, dans les deux directions.
- [x] Rejouer le build et vérifier le comportement desktop/mobile.

## Devis commandes en ligne et fidélité (2026-09-06)
- [x] Produire un devis technique provisoire couvrant les commandes, comptes clients, fidélité, notifications, statistiques, SEO + AISEO et déploiement.
- [x] Produire un devis fonctionnel client avec les mêmes titres et des explications simples, sans détail de stack.
- [x] Maintenir le plafond du projet principal à 220 000 DA et isoler le chatbot vocal en option à 60 000 DA.
- [x] Mentionner les hypothèses à valider : livraison à Alger, paiement à la livraison, communes et tarifs à définir ultérieurement.
- [x] Générer, extraire et rendre les deux PDF, puis inspecter visuellement toutes leurs pages.

## Refonte visuelle des devis selon le PDF de référence (2026-09-07)
- [x] Recomposer les deux documents avec une grille éditoriale, des cartes modulaires et une typographie plus grande.
- [x] Utiliser une palette noir profond, crème, olive et terracotta sans modifier le périmètre ni les montants.
- [x] Renforcer la couverture, les badges de prix, les repères de sections et le total final.
- [x] Générer et inspecter visuellement toutes les pages des deux nouveaux PDF.

## Précisions fonctionnelles du devis commandes (2026-09-07)
- [x] Retirer les indicateurs de paiement détaillé et de répartition livraison/retrait des statistiques.
- [x] Ajouter la commune au profil client et permettre les types produit plat, menu et offre avec gestion de rupture.
- [x] Mentionner le Pasta Lover Club comme page dédiée du backoffice, avec périmètre à préciser.
- [x] Regénérer et contrôler les deux PDF après mise à jour du contenu.

## Révision finale des devis commandes (2026-09-07)
- [x] Fixer le projet principal à 220 000 DA et l'option chatbot RAG vocal à 60 000 DA.
- [x] Détailler l'identité visuelle, les animations, les expériences desktop/mobile et l'interface du logiciel.
- [x] Regénérer et contrôler les deux PDF après validation du contenu et des montants.

## Intégration du chatbot et nouvelle direction visuelle des devis (2026-09-07)
- [x] Transformer le chatbot RAG vocal en module inclus dans le projet et porter le total à 280 000 DA.
- [x] Rapprocher les couleurs, le fond quadrillé, la typographie et les cartes modulaires du PDF StayFamily.
- [x] Regénérer et inspecter les deux PDF avec le module chatbot et le nouveau récapitulatif.

## Ajustements finaux des devis (2026-09-07)
- [x] Remplacer l'accent rouge du récapitulatif financier par un accent cyan plus neutre.
- [x] Reformuler le coût externe du chatbot entre 0,50 € et 5 € maximum selon le trafic, sans mention d'architecture.
- [x] Retirer les mentions de frais WhatsApp Business et de stockage des images du bloc des frais externes.
- [x] Regénérer et inspecter les deux PDF corrigés.

## Mise à jour tarif chatbot (2026-09-07)
- [x] Porter le chatbot RAG vocal à 50 000 DA et recalculer le total du projet à 270 000 DA.
- [x] Mettre à jour la fourchette de frais externes à 0,50 € - 3 € maximum.
- [x] Regénérer et vérifier les deux PDF.
- [x] Ajuster le bandeau du total pour conserver le montant sur une seule ligne.

## Simplification de la couverture (2026-09-07)
- [x] Remplacer le titre de couverture par une formulation simple et directe.
- [x] Regénérer et vérifier les deux PDF.

## Rééquilibrage des tarifs et du périmètre (2026-09-07)
- [x] Fixer le backend à 100 000 DA, la sécurité à 25 000 DA et le chatbot à 40 000 DA.
- [x] Porter le total du projet à 260 000 DA.
- [x] Détailler la recherche, la fiche commande, l'import d'images et les contrôles de sécurité dans le devis fonctionnel.
- [x] Regénérer et vérifier les deux PDF.
- [x] Compacter uniquement la carte backend fonctionnelle pour conserver une page par module.

## Clarification du statut fonctionnel (2026-09-07)
- [x] Remplacer les formulations de proposition par un périmètre de fonctionnalités convenues.
- [x] Présenter clairement le document comme un projet de site web + logiciel.
- [x] Regénérer et vérifier les deux PDF.

## Maintenance et nouvelle tarification (2026-09-09)
- [x] Rendre le chatbot offert et porter le backend à 90 000 DA.
- [x] Ajouter une section de maintenance offerte pendant les six premiers mois.
- [x] Retirer les prix des cartes intermédiaires et conserver le détail financier uniquement dans le récapitulatif final.
- [x] Indiquer les frais d'hébergement entre 8 € et 11 € par mois et recalculer le total à 210 000 DA.
- [x] Regénérer et inspecter les deux PDF.

## Série photo Pasta by Galatée (2026-09-13)
- [x] Générer le hero packaging en 16:9 à partir des références de marque.
- [x] Générer les trois scènes 35 mm de la section Notre histoire.
- [x] Générer les packshots cohérents Pomodoro, Carbonara et Tiramisu.
- [x] Ranger et vérifier les sept assets dans le projet frontend.

## Direction B sur le hero existant (2026-09-13)
- [x] Auditer le hero actuel sur desktop et mobile sans modifier son fond ni sa structure.
- [x] Renforcer le relief 3D de la box et simplifier l'orbite des ingrédients.
- [x] Construire une composition mobile dédiée avec les mêmes assets.
- [x] Vérifier le build, le lint, le rendu et l'absence de débordement.

## Système de commandes, étape 1 (2026-09-13)
- [x] Cartographier le schéma SQLite, les routes existantes et les surfaces back-office sans modifier le design.
- [x] Ajouter le modèle de commande avec livraison/retrait, paiement à la livraison, invité ou compte, lignes et capture des prix.
- [x] Ajouter la validation serveur des disponibilités et le calcul du tarif de livraison par commune.
- [x] Ajouter les transitions de statut et la visibilité d'une nouvelle commande dans le back-office.
- [x] Ajouter la gestion simple disponible/rupture des plats et la configuration des communes.
- [x] Garder les routes de réservation existantes compatibles pendant la transition, sauf conflit avéré.
- [x] Couvrir les nouveaux contrats par des tests puis vérifier `npm test` et `npm run build`.

## Fidélité et promotions, étape 2 (2026-09-14)
- [x] Définir la règle métier : commandes livrées/récupérées/terminées comptabilisées, commandes annulées exclues.
- [x] Ajouter les réglages de fidélité et les récompenses générées automatiquement après le seuil atteint.
- [x] Exposer la progression du client et les réglages sécurisés du back-office.
- [x] Ajouter l'affichage de progression dans l'espace client et la gestion dans le back-office.
- [x] Couvrir les cas de seuil, annulation, répétition et modification des réglages par des tests.
- [x] Vérifier `npm test` et `npm run build`.

## Dashboard statistique, étape 4 (2026-09-14)
- [x] Étendre les événements aux parcours du site et aux commandes sans casser les anciens événements.
- [x] Calculer le trafic, le tunnel de commande, les statuts et le chiffre d'affaires des commandes confirmées.
- [x] Calculer les produits les plus et les moins vendus avec les prix capturés des commandes.
- [x] Ajouter les visualisations et filtres de période dans le back-office.
- [x] Couvrir les agrégations par période et les cas sans données par des tests.
- [x] Vérifier `npm test` et `npm run build`.

## Frise line-art du hero (2026-09-13)
- [x] Générer la frise depuis les références réelles du packaging.
- [x] Recadrer et exporter le visuel au format exact 1800 x 300.
- [x] Nettoyer le fond en blanc pur et vérifier les marges du dessin.
- [x] Déposer l'asset final dans le dossier de marque du frontend.

## Maquettes hero pop (2026-09-13)
- [x] Générer la direction desktop asymétrique en 16:9 avec le packaging de référence.
- [x] Générer une composition mobile dédiée en 9:16.
- [x] Vérifier l'absence d'ingrédients photographiques flottants et de couvercle.
- [x] Exporter les maquettes dans les assets du frontend aux dimensions finales.

## Maquettes hero pop desktop et mobile (2026-09-13)
- [ ] Générer la direction desktop 16:9 avec le packaging réel en référence.
- [ ] Générer une composition mobile 9:16 réellement dédiée.
- [ ] Contrôler la fidélité de la box, l'absence d'ingrédients flottants et la hiérarchie générale.

## Frise line-art du hero (2026-09-13)
- [ ] Générer la frise 6:1 à partir des illustrations du packaging.
- [ ] Normaliser le fichier en 1800 x 300 et le déposer dans les assets de marque.
- [ ] Vérifier le fond blanc, les marges, la palette rouge/verte et l'absence de texte.

## Assets d'ambiance du hero (2026-09-13)
- [x] Générer l'ombre de palmier photographique en 4:3.
- [x] Générer le tampon horizontal « Solo al dente » depuis les références de marque.
- [x] Normaliser les deux fichiers aux dimensions finales et contrôler leurs fonds.
- [x] Déposer les assets vérifiés dans `frontend-react/public/assets/brand/`.

## Maquette mobile typographique v2 (2026-09-13)
- [x] Générer une nouvelle composition 9:16 avec headline Antonio condensé droit.
- [x] Contrôler la fidélité du packaging, la hiérarchie typographique et l'absence d'ingrédients flottants.
- [x] Exporter la maquette finale en 1080 x 1920 sans écraser la version précédente.

## Ajustement typographique mobile v3 (2026-09-13)
- [x] Reprendre l'échelle et le rythme typographique de la nouvelle référence mobile.
- [x] Conserver strictement la box, le fond, le tampon et les illustrations de la v2.
- [x] Exporter et vérifier la maquette améliorée en 1080 x 1920.

## Catalogue plats, menus et offres, étape 5 (2026-09-14)
- [x] Ajouter le type de catalogue `plat`, `menu` ou `offre` avec migration compatible des anciennes données.
- [x] Faire respecter le type publié lors de la création d'une commande et conserver ce type dans son historique.
- [x] Adapter le back-office et les payloads du site pour créer, modifier, publier et commander les trois types.
- [x] Ajouter les tests de commande multi-types et vérifier `npm test` ainsi que `npm run build`.

## Fonctionnalités finales 1 à 5 (2026-09-16)
- [x] Rendre les récompenses de fidélité utilisables sur une commande, avec calcul borné et consommation atomique.
- [x] Passer les comptes clients à un mot de passe sécurisé et ajouter la commune de résidence, sans casser les comptes existants.
- [x] Ajouter une notification opérationnelle des nouvelles commandes dans le back-office, avec rafraîchissement et signal visuel accessibles.
- [x] Retirer le parcours de réservation du produit commande-only tout en conservant une migration de données sans suppression destructive.
- [x] Ajouter le module Pasta Lover Club dans le back-office avec une page de gestion éditoriale minimale.
- [x] Ajouter les tests de régression et vérifier `npm test` ainsi que `npm run build`.
## Pack d'illustrations hero pour Claude (2026-09-13)
- [x] Créer l'ombre de palmier diffuse sur fond transparent.
- [x] Ajouter une vapeur naturelle à la box Pomodoro détourée.
- [x] Exporter les trois motifs line-art en PNG haute résolution transparent.
- [x] Préparer le tampon final transparent et vérifier les six fichiers.
- [x] Regrouper les assets et leur manifeste dans une archive transmissible.

## Correction des illustrations de reference (2026-09-13)
- [x] Redessiner le bouquet de basilic a trois feuilles en double contour.
- [x] Redessiner la tomate avec son contour organique et son feuillage fidele.
- [x] Refaire le tampon terracotta plein avec lettrage creme.
- [x] Recomposer la frise avec les memes motifs et le meme geste line-art.
- [x] Re-exporter les PNG transparents, mettre a jour l'archive et verifier la planche.

## Configuration de livraison (2026-09-16)
- [x] Ajouter une page back-office dédiée aux communes et tarifs de livraison
- [x] Ajouter la navigation et connecter la page aux routes API existantes
- [x] Vérifier les tests backend et le build frontend

## Audit mise en production (2026-09-27)
- [x] Cartographier les changements récents et l'architecture actuelle
- [x] Auditer les risques production: données, auth, API, uploads, rate limiting et observabilité
- [x] Définir la stack finale et la topologie cible sur deux VPS Hostinger
- [x] Produire une checklist de livraison et un ordre de migration

> Audit réalisé: le rapport de mise en production est fourni dans la réponse du 2026-09-27. Aucun code applicatif n'a été modifié pendant cet audit.
