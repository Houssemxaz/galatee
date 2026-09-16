# Étape 4 - Structure Figma et décision de production

One job: définir ce qui part en Figma et ce qui part directement en implémentation.

## Décision validée

| Direction | Destination | Rôle |
| --- | --- | --- |
| La Table Claire | Figma | Explorer une version minimaliste, classe, très épurée. |
| Atelier Vivant | Figma | Explorer une version plus créative, proche de l'énergie actuelle mais plus mature. |
| Soirée à Hydra | Site réel | Implémenter directement comme direction de production, sans passer par Figma complet. |

## Fichier Figma créé

[Galatee - Directions Figma](https://www.figma.com/design/z6BCxB8cj1mEln9fkCw7i9)

Frames créés:
- `00 - Overview / Decision Board`
- `01 - La Table Claire / Desktop`
- `01 - La Table Claire / Mobile`
- `02 - Atelier Vivant / Desktop`
- `02 - Atelier Vivant / Mobile`
- `03 - Soiree a Hydra / Direct Site Brief`

## Règle commune
- Palette principale: Olive Green / Olivenite `#313118` et Terracotta `#83482B`.
- Couleurs support: Bancha `#6D6844`, Hillside `#CCC6A9`, Farine `#E4E0D0`, Céramique `#F1EBDD`.
- Pas d'images de chefs, salle, façade, cuisine, clients ou équipe.
- Les images restent limitées au menu, aux plats isolés, aux matières, aux illustrations abstraites et à la lumière.
- Hydra remplace Paris dans les décisions de contenu et de direction.

## Structure Figma - La Table Claire

Objectif: proposer une version calme, premium et presque typographique pour mesurer jusqu'où Galatee peut aller dans l'épure.

### Écrans à produire
- Desktop homepage.
- Mobile homepage.
- État menu / fiche plat.
- Bloc réservation.

### Wireframe desktop
```text
[Header discret: logo | menu | reservation]

[Hero typographique]
GALATEE
Maison de pâtes fraîches à Hydra
CTA Réserver / Voir la carte
filet de pâte très fin

[Menu de la semaine]
liste éditoriale + 1 image plat isolée

[Réservation]
formulaire calme, en une étape

[Informations]
adresse Hydra / horaires / contact
```

### Priorités
- La typo porte la direction.
- La réservation doit être évidente mais élégante.
- Les images de plats restent secondaires.
- Mobile très lisible, peu d'ornements.

## Structure Figma - Atelier Vivant

Objectif: proposer une version plus créative, structurée et identifiable, sans tomber dans un moodboard chargé.

### Écrans à produire
- Desktop homepage.
- Mobile homepage.
- Menu détaillé avec cartes plats.
- Bloc réservation intégré dans la composition.

### Wireframe desktop
```text
[Header + rail graphique]

[Hero modulaire]
logo / titre / illustration abstraite de pâte / CTA
module plat ou matière

[Menu de la semaine]
cartes plats + filtres + détails dessinés

[Expérience Galatee]
gestes, rythme du service, pâte comme langage graphique

[Réservation]
module clair, CTA visible, champs très propres

[Informations / Contact]
Hydra, horaires, téléphone, email
```

### Priorités
- Garder une logique créative globale, pas forcément une logique carnet.
- Les illustrations de pâte doivent être adultes et graphiques.
- Terracotta doit apparaître comme couleur principale avec Olive Green, pas comme simple détail perdu.
- La structure doit rester codable.

## Implémentation directe - Soirée à Hydra

Objectif: transformer le site actuel vers une version cinématique équilibrée, en gardant la lisibilité et les contrats existants.

### Sections du site à traiter
- Header/navigation.
- Hero.
- Menu de la semaine et menu détaillé.
- Réservation.
- Services.
- Informations.
- Contact/footer.

### Intentions d'implémentation
- Remplacer la logique trop carnet/affiche par une mise en scène plus cinématique et équilibrée.
- Garder Olive Green et Terracotta comme duo principal.
- Introduire lumière de table, ombres douces, matière papier/céramique et détails abstraits.
- Supprimer ou renommer tout contenu qui évoque Paris; ancrer le site à Hydra.
- Ne pas ajouter d'images de chefs ou de restaurant.
- Garder les images de plats existantes comme base menu tant qu'aucun shooting réel n'est disponible.
- Préserver la réservation, les champs, les IDs et les contrats API.

### Wireframe de production
```text
[Header discret sur surface olive]
Logo / Menu / Reservation / Contact

[Hero cinématique équilibré]
grand titre GALATEE
phrase courte: pâtes fraîches à Hydra
CTA Réserver
CTA Voir la carte
visuel: assiette/menu + lumière/matière, pas de salle

[Menu lumineux]
plats comme objets, cartes moins nombreuses mais plus fortes

[Rythme du soir]
service, horaires, formats, demandes particulières

[Réservation]
formulaire lisible, surface calme, point chaud terracotta

[Infos Hydra + Contact]
adresse, accès, téléphone, email
```

### Risques à contrôler
- Ne pas devenir trop sombre.
- Ne pas ressembler à une photo IA de restaurant.
- Ne pas perdre la clarté mobile.
- Ne pas casser le formulaire existant.

## Human check
Prochaine décision: créer les maquettes Figma pour La Table Claire et Atelier Vivant, ou démarrer l'implémentation directe de Soirée à Hydra.
