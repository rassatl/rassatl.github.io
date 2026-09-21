# Tests

Le projet a deux suites de tests, complémentaires :
- des **tests unitaires** avec [Vitest](https://vitest.dev/) et [@vue/test-utils](https://test-utils.vuejs.org/) ;
- des **tests end-to-end** avec [Playwright](https://playwright.dev/), contre de vrais émulateurs Firebase.

## Lancer les tests

```bash
npm test          # tests unitaires (Vitest)
npm run test:e2e  # tests end-to-end (Playwright)
```

Autres variantes utiles :

```bash
npm run test:e2e:ui # ouvre l'interface graphique de Playwright 
npx playwright test e2e/admin.spec.js #lance un seul fichier de tests
npx playwright show-report # rouvre le rapport HTML du dernier run
```

Les tests unitaires tournent aussi automatiquement :
- sur chaque push et pull request (workflow `.github/workflows/ci.yml`) ;
- avant chaque déploiement (workflow `.github/workflows/deploy.yml`), pour bloquer un déploiement si un test casse.

Les tests end-to-end tournent sur chaque push et pull request (job `e2e` du même workflow `.github/workflows/ci.yml`), mais pas avant le déploiement (ils sont plus lents et redondants avec le job `test` qui bloque déjà le déploiement).

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
| `src/composables/useErrorLogs.js` | `useErrorLogs.test.js` | Payload journalisé (message/stack/code/URL/user-agent), repli sur un message générique pour une valeur qui n'est pas une `Error`, silence si l'écriture Firestore elle-même échoue |
| `src/components/common/StarRating.vue` | `StarRating.test.js` | Rendu du nombre d'étoiles, émission de la note cliquée, désélection en recliquant la même étoile, aucune émission en `readonly` |
| `src/components/add-company-form/steps/CompanyStep.vue` | `CompanyStep.test.js` | Champs obligatoires, bornes de coordonnées GPS, format du code postal, normalisation d'URL (ajout de `https://`), parsing de l'adresse complète collée en un seul champ (`"12 rue de Paris, 75001 Paris, France"`) |
| `src/utils/studentEmail.js` | `studentEmail.test.js` | Seul le domaine `@groupe-esigelec.org` est reconnu comme étudiant (insensible à la casse, refus des sous-domaines et des domaines qui y ressemblent) |
| `src/components/add-company-form/steps/StudentStep.vue` | `StudentStep.test.js` | Étape invalide tant que l'email étudiant n'est pas vérifié, refus d'une adresse hors domaine sans envoi, envoi du lien et confirmation, erreur d'envoi, changement d'adresse, case « afficher mon email » décochée par défaut et choix remonté au formulaire |
| `src/components/add-company-form/steps/ContactsStep.vue` | `ContactsStep.test.js` | Champs obligatoires par contact, format d'email, normalisation des espaces, validation indépendante de chaque contact quand il y en a plusieurs |

## Pourquoi mocker Firebase et EmailJS

`useTickets`, `useEmailNotifications`, `useErrorLogs` et (indirectement, via `ContactsStep`) `usePendingCompanies` dépendent de Firebase ou d'EmailJS. Dans leurs tests, ces dépendances sont remplacées par des mocks (`vi.mock`) :

- aucun appel réseau réel n'est fait, donc les tests sont rapides et déterministes ;
- aucun secret (clé Firebase, clé EmailJS) n'est nécessaire pour lancer les tests, y compris en CI.

Ce qui est vérifié, ce n'est pas que Firebase/EmailJS fonctionnent (ce n'est pas notre code), mais que **nos** composables les appellent avec les bons arguments (ex. `updateDoc` appelé uniquement avec `{ status }`, `addDoc` appelé avec un payload dont `pageUrl`/`userAgent` sont bien tronqués).

## Ce qui n'est volontairement pas testé (en unitaire)

- Le rendu détaillé des composants complexes (`MapView`, `AddCompanyForm`, `TicketsList`, …) et les interactions avec Leaflet/Firebase en conditions réelles : c'est le rôle des tests end-to-end (voir ci-dessous).
- Les traductions elles-mêmes (`src/data/lang.js`) : c'est du contenu statique, pas de la logique.

## Ajouter un test unitaire

Pour une nouvelle fonction/composable pure, un test simple suffit (voir `mapIcons.test.js` ou `useLang.test.js`).

Pour un composant Vue :
- fournir `t` via `global.provide` (une fonction identité `(key) => key` suffit, sauf si le test vérifie un texte traduit) ;
- si le composant importe un composable branché sur Firebase, le mocker avec `vi.mock` plutôt que d'initialiser Firebase pour de vrai (voir `ContactsStep.test.js`) ;
- pour tester une fonction de validation interne exposée par un composant (`defineExpose`), remplir le formulaire via les inputs rendus (`wrapper.find(...).setValue(...)`) puis appeler `wrapper.vm.validate()` / `validateFields()` (voir `CompanyStep.test.js`, `ContactsStep.test.js`).

## Tests end-to-end (Playwright)

Contrairement aux tests unitaires (qui mockent Firebase), les tests E2E font tourner l'app buildée par Vite contre de **vrais émulateurs Firebase** (Firestore + Auth), avec les vraies `firestore.rules` appliquées. C'est le seul endroit où ces règles sont vérifiées.

### Prérequis

- **Java** (11+) : requis par les émulateurs Firebase. `npm run test:e2e` télécharge et lance tout le reste automatiquement.
- **Node 22+** : `firebase-admin` (utilisé pour peupler l'émulateur, voir `e2e/fixtures/`) entraîne `@google-cloud/firestore`, dont l'engine exige Node ≥22. C'est une dépendance optionnelle : sur une version plus ancienne, `npm install`/`npm ci` l'ignore silencieusement au lieu d'échouer, et l'erreur (`Cannot find module '@google-cloud/firestore'`) n'apparaît qu'au lancement des tests.

### Comment ça tourne

`playwright.config.js` démarre automatiquement, avant les tests :
1. les émulateurs Firestore + Auth (`firebase emulators:start`, config dans `firebase.json` / `.firebaserc`, projet de démonstration `demo-find-my-company`) ;
2. le serveur de dev Vite en mode `e2e` (`.env.e2e`), qui redirige le SDK client vers ces émulateurs (voir `connectFirestoreEmulator`/`connectAuthEmulator` dans `src/services/firebase.js`).

Un `globalSetup` (`e2e/global-setup.js`) vide l'émulateur Firestore et crée un compte admin de test (avec son document `admins/{uid}`, qui donne les droits admin) une seule fois avant toute la suite. Les tests tournent ensuite **en série** (un seul worker) : ils partagent le même émulateur, donc chaque test seed ses propres données avec des noms uniques plutôt que de compter sur un état global figé.

Le lien de vérification d'un email étudiant est envoyé par Firebase Auth, pas par EmailJS : dans l'émulateur aucun email ne part, le test lit le lien directement dans l'API de l'émulateur (`latestSignInLink` dans `e2e/fixtures/emulator.js`).

EmailJS n'est volontairement pas configuré en mode `e2e` : `useEmailNotifications.js` détecte les variables `VITE_EMAILJS_*` absentes et n'envoie rien, silencieusement — aucun vrai email n'est donc envoyé pendant les tests.

### Organisation

| Fichier | Ce qui est vérifié |
|---|---|
| `e2e/company-directory.spec.js` | Une entreprise publiée apparaît dans la liste et sur ses détails (spécialité, mission, avis, contact, auteur si l'étudiant a choisi d'être visible, aucun auteur sinon) ; le filtre par spécialité |
| `e2e/add-company-form.spec.js` | Un étudiant peut soumettre une proposition via l'assistant en 5 étapes (vérification de l'email étudiant par lien, puis entreprise, contact facultatif, mission, avis), jusqu'à l'écriture réelle dans `pendingCompanies` (vérifiée via `firebase-admin`), avec son email dans `submittedBy` et son choix de visibilité dans `submitterVisible` (privé par défaut) |
| `e2e/student-verification.spec.js` | La vérification est la première étape, elle bloque la suite tant que l'email n'est pas vérifié, refuse une adresse hors domaine sans envoyer de lien, et n'apparaît pas pour un admin |
| `e2e/firestore-rules.spec.js` | `firestore.rules` imposent la vérification côté serveur, en contournant l'interface : un anonyme, un email non vérifié ou hors domaine ne peuvent pas proposer d'entreprise ; l'auteur ne peut pas se faire passer pour un autre, ni s'attribuer un `addedBy` public ; le choix de visibilité est obligatoire ; un étudiant vérifié n'a aucun droit admin (propositions, tickets, publication, documents `admins` et `companyAuthors`) |
| `e2e/report-issue.spec.js` | Un visiteur peut signaler un problème, jusqu'à l'écriture réelle dans `tickets` |
| `e2e/admin.spec.js` | Connexion/déconnexion admin ; refus et validation d'une proposition en attente (dont la publication dans `companies` : l'email de l'étudiant y figure seulement s'il a choisi d'être visible, et l'auteur est toujours consigné dans la collection privée `companyAuthors`) ; un admin voit l'auteur privé sur la fiche, un visiteur non |
| `e2e/fixtures/` | Utilitaires partagés : connexion à l'émulateur (`emulator.js`), seed de données via `firebase-admin` (`seed.js`), connexion admin UI (`login.js`), vérification d'un email étudiant via le lien lu dans l'émulateur Auth (`student.js`), appels REST Firestore avec de vrais jetons pour tester les règles (`firestore-rest.js`), mock de l'API Nominatim (`nominatim.js`) |

### Pourquoi mocker Nominatim mais pas Firebase

`AddCompanyForm`/`MiniMap` appellent l'API publique `nominatim.openstreetmap.org` (géocodage d'adresse, puis vérification du pays à la soumission). Contrairement à Firebase, ce n'est pas notre backend : la mocker (voir `e2e/fixtures/nominatim.js`) évite de dépendre d'un service tiers, de risquer sa politique d'usage, et rend le point placé sur la carte déterministe.

### Ajouter un test E2E

- Utiliser `e2e/fixtures/seed.js` pour préparer l'état Firestore nécessaire plutôt que de tout construire depuis l'UI quand ce n'est pas ce qui est testé.
- Donner aux données seedées un nom incluant un identifiant unique (voir `crypto.randomUUID()` en tête des specs existants) et cibler les assertions sur ce nom précis (`{ hasText: name }`), plutôt que de compter des éléments globaux : les tests partagent le même émulateur.
- Après une action qui déclenche une écriture Firestore observée ensuite via `firebase-admin` (pas via l'UI), utiliser `expect.poll(...)` plutôt qu'une seule lecture : la liste affichée dans l'UI (`onSnapshot`) reflète l'écriture locale avant que le serveur ne l'ait confirmée, une lecture immédiate côté `firebase-admin` peut donc encore voir l'ancien état.
