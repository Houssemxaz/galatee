# Pipeline directions artistiques Galatee

Source unique de vérité pour la mission DA/Figma. La pipeline est séquentielle: chaque étape lit le fichier validé précédent, produit un livrable éditable, puis attend une validation humaine.

## Règles de mission
- Ne pas modifier le frontend React, l'admin ou le backend.
- Ne pas lancer de serveur sans validation explicite.
- Ne pas produire de concept, prompt visuel ou maquette avant la gate correspondante.
- Garder Olive Green / Olivenite `#313118` et Terracotta `#83482B` comme couleurs principales dans les trois univers.
- Corriger le contexte de localisation: la mission actuelle positionne Galatee à Hydra, Alger, même si le site existant contient encore des textes Paris 10e.

## Étapes

| Étape | Fichier | Skills principaux | Livrable | Gate |
|---|---|---|---|---|
| 0 | `00-cadrage.md` | `icm-architect`, `impeccable init` | Brief créatif court | Validation du brief |
| 1 | `01-references-vocabulaire.md` | `design-styles-prompting`, `design-dna` | Matrice références et vocabulaire | Validation familles visuelles |
| 2 | `02-theses-univers.md` | `genjutsu:paint`, `impeccable shape` | Trois thèses comparables | Choix concept principal |
| 3 | `03-systeme-visuel.md` | `design-dna`, `brandkit`, `frontend-design` | Fiches systèmes visuels | Validation avant maquettes |
| 4 | `04-structure-figma.md` | `impeccable shape`, `frontend-design` | Sitemap et wireframes décrits | Validation structure |
| 5 | `05-visuels-backgrounds.md` | `ai-visual-direction`, `imagegen-frontend-web`, `genjutsu:paint` | Prompts et usages | Validation visuels |
| 6 | `06-maquettes-figma.md` | `brandkit`, `impeccable new-work` | Maquettes ou spécification Figma | Revue écrans |
| 7 | `07-motion.md` | `impeccable`, `design-taste-frontend` | Motion spec concise | Validation motion |
| 8 | `08-critique.md` | `impeccable critique`, `web-quality-audit` | Comparatif, risques, recommandation | Validation finale |
| 9 | `09-handoff.md` | `brandkit`, `design-dna`, `frontend-design` | Handoff frontend exploitable | Transmission |

## Statut
- Étape actuelle: 1 - références et vocabulaire.
- Dernier livrable validé: `00-cadrage.md`.
- Clarifications validées: localisation Hydra, aucune photo disponible à ce stade, sortie initiale en images générées classiques, passage à Figma après décision sur les trois thèmes.
- Prochaine action humaine: fournir des références visuelles ou autoriser une exploration sans références.
