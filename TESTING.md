# Tests

Le projet utilise [Vitest](https://vitest.dev/) et [@vue/test-utils](https://test-utils.vuejs.org/) pour les tests unitaires.

## Lancer les tests

```bash
npm test
```

Les tests tournent aussi automatiquement :
- sur chaque push et pull request (workflow `.github/workflows/ci.yml`) ;
- avant chaque déploiement (workflow `.github/workflows/deploy.yml`), pour bloquer un déploiement si un test casse.

## Organisation

Chaque fichier de test est placé à côté du fichier qu'il teste (`Foo.js` → `Foo.test.js`). La config se trouve dans `vitest.config.js` (environnement `jsdom`, plugin Vue).

## Ce qui est testé

Les tests ciblent la logique métier plutôt que le rendu visuel : validation de formulaires, calculs, construction des payloads envoyés à Firebase/EmailJS.

| Fichier testé | Fichier de test | Ce qui est vérifié |
|---|---|---|
| `src/utils/mapIcons.js` | `mapIcons.test.js` | Choix de l'icône (rouge/bleue) selon la spécialité de l'entreprise |
| `src/composables/useLang.js` | `useLang.test.js` | Résolution des clés de traduction imbriquées, fallback sur la clé si absente, changement de langue + persistance `localStorage` |
| `src/composables/useEmailNotifications.js` | `useEmailNotifications.test.js` | Contenu de l'email envoyé (destinataire, lien "masquer mes infos"), envoi silencieusement ignoré si EmailJS n'est pas configuré, un échec d'envoi ne fait pas planter les autres |
| `src/composables/useTickets.js` | `useTickets.test.js` | Comptage des tickets non fermés, payload de signalement (URL/user-agent tronqués), mise à jour du statut, suppression |
| `src/components/common/StarRating.vue` | `StarRating.test.js` | Rendu du nombre d'étoiles, émission de la note cliquée, désélection en recliquant la même étoile, aucune émission en `readonly` |
| `src/components/add-company-form/steps/CompanyStep.vue` | `CompanyStep.test.js` | Champs obligatoires, bornes de coordonnées GPS, format du code postal, normalisation d'URL (ajout de `https://`), parsing de l'adresse complète collée en un seul champ (`"12 rue de Paris, 75001 Paris, France"`) |
| `src/components/add-company-form/steps/ContactsStep.vue` | `ContactsStep.test.js` | Champs obligatoires par contact, format d'email, normalisation des espaces, validation indépendante de chaque contact quand il y en a plusieurs |

## Pourquoi mocker Firebase et EmailJS

`useTickets`, `useEmailNotifications` et (indirectement, via `ContactsStep`) `usePendingCompanies` dépendent de Firebase ou d'EmailJS. Dans leurs tests, ces dépendances sont remplacées par des mocks (`vi.mock`) :

- aucun appel réseau réel n'est fait, donc les tests sont rapides et déterministes ;
- aucun secret (clé Firebase, clé EmailJS) n'est nécessaire pour lancer les tests, y compris en CI.

Ce qui est vérifié, ce n'est pas que Firebase/EmailJS fonctionnent (ce n'est pas notre code), mais que **nos** composables les appellent avec les bons arguments (ex. `updateDoc` appelé uniquement avec `{ status }`, `addDoc` appelé avec un payload dont `pageUrl`/`userAgent` sont bien tronqués).

## Ce qui n'est volontairement pas testé

- Le rendu détaillé des composants complexes (`MapView`, `AddCompanyForm`, `TicketsList`, …) et les interactions avec Leaflet/Firebase en conditions réelles : cela demanderait des tests d'intégration/E2E (ex. Playwright), non mis en place ici.
- Les traductions elles-mêmes (`src/data/lang.js`) : c'est du contenu statique, pas de la logique.
- Les règles Firestore (`firestore.rules`) : à tester séparément avec l'émulateur Firebase si besoin.

## Ajouter un test

Pour une nouvelle fonction/composable pure, un test simple suffit (voir `mapIcons.test.js` ou `useLang.test.js`).

Pour un composant Vue :
- fournir `t` via `global.provide` (une fonction identité `(key) => key` suffit, sauf si le test vérifie un texte traduit) ;
- si le composant importe un composable branché sur Firebase, le mocker avec `vi.mock` plutôt que d'initialiser Firebase pour de vrai (voir `ContactsStep.test.js`) ;
- pour tester une fonction de validation interne exposée par un composant (`defineExpose`), remplir le formulaire via les inputs rendus (`wrapper.find(...).setValue(...)`) puis appeler `wrapper.vm.validate()` / `validateFields()` (voir `CompanyStep.test.js`, `ContactsStep.test.js`).
