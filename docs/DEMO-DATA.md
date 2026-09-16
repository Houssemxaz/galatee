# Donnees de demonstration

Le seed est volontairement une commande explicite. Le serveur ne cree jamais de donnees de presentation au demarrage.

## Remplir la base

```bash
npm run seed:demo
```

La commande remplace uniquement les anciennes lignes marquees `demo-` et conserve les donnees reelles. Les dates sont calculees autour de la prochaine periode de service au moment du lancement.

Le jeu contient:

- cinq reservations avec les statuts en attente, confirme, annule et termine;
- des blocages manuels et des blocages automatiques issus des reservations confirmees;
- six entrees de revenus journaliers en DZD;
- des evenements anonymes du tunnel de reservation pour alimenter les graphiques.

## Reinitialiser

```bash
npm run seed:demo -- --reset
```

Cette commande supprime uniquement les donnees de demonstration. Elle ne supprime ni les reservations reelles, ni les plats, ni les services.

Le seed est reserve a la demo et ne doit pas etre execute sur la base de production sans validation prealable.
