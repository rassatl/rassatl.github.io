# Find My Company

Application web de cartographie et de découverte d'entreprises, construite avec Vue 3, Leaflet et Firebase.

L'objectif est simple: aider les étudiants et jeunes profils à identifier des entreprises selon leur spécialité, leur localisation et plusieurs critères métier.

## Sommaire

1. [Présentation](#presentation)
2. [Types d'utilisateurs](#types-dutilisateurs)
3. [Fonctionnalités principales](#fonctionnalites-principales)
4. [Stack technique](#stack-technique)
5. [Structure du projet](#structure-du-projet)
6. [Prérequis](#prerequis)
7. [Installation et lancement](#installation-et-lancement)
8. [Configuration Firebase et variables d'environnement](#configuration-firebase-et-variables-denvironnement)
9. [Scripts disponibles](#scripts-disponibles)
10. [Déploiement](#deploiement)
11. [Roadmap courte](#roadmap-courte)
12. [Contribution](#contribution)

## Presentation

Find My Company permet de:

- visualiser des entreprises sur une carte interactive,
- filtrer les résultats (spécialité, pays, secteur, note, etc.),
- consulter des fiches détaillées,
- proposer de nouvelles entreprises,
- modérer les propositions via un workflow d'approbation admin.

Le projet est bilingue (FR/EN) et pensé pour une utilisation desktop et mobile.

## Types d'utilisateurs

### 1. Visiteur (guest)

- consulte la carte et la liste des entreprises validées,
- utilise les filtres et la recherche,
- visualise les informations publiques.

### 2. Utilisateur connecté (user)

- possède toutes les capacités du visiteur,
- peut proposer une nouvelle entreprise via le formulaire,
- peut interagir avec les fonctionnalités liées au profil connecté.

### 3. Administrateur (admin)

- possède toutes les capacités précédentes,
- accède à la liste d'attente des propositions,
- peut afficher le dossier complet d'une proposition,
- peut éditer, valider ou refuser une entreprise,
- contrôle la publication effective des nouvelles entrées.

Les administrateurs sont définis via les variables d'environnement (`VITE_ADMIN_EMAIL` ou `VITE_ADMIN_EMAILS`).

## Fonctionnalites principales

### Carte et navigation

- affichage des entreprises avec Leaflet,
- plusieurs fonds de carte (plan, satellite, terrain, sombre),
- synchronisation de la liste avec la zone visible sur la carte.

### Recherche et filtres

- recherche texte (nom, description, ville, pays),
- bandeau de filtres repliable,
- filtres disponibles:
    - spécialité,
    - pays,
    - ville,
    - secteurs,
    - note moyenne (rating),
    - modifié récemment (30 derniers jours),
- réinitialisation globale des filtres,
- affichage du nombre de résultats et du nombre de filtres actifs.

### Gestion des entreprises

- formulaire d'ajout avec géolocalisation,
- stockage des données dans Firestore,
- gestion des champs détaillés (adresse, site, secteur, description, dates).

### Workflow de modération

- création d'entreprise en statut `pending`,
- validation admin (`approved`) ou refus (`rejected`),
- les entreprises non validées ne sont pas visibles publiquement.

### Authentification

- création de compte / connexion / déconnexion via Firebase Auth,
- gestion des erreurs usuelles (email invalide, mot de passe faible, etc.),
- mode dégradé quand la clé API Firebase est absente.

## Stack technique

- Vue 3 (Composition API)
- Vite
- Leaflet
- Firebase
    - Firestore (données entreprises)
    - Authentication (gestion des comptes)
- CSS scoped dans les composants Vue

## Structure du projet

```text
.
├── README.md
├── find-my-company/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── constants/
│   │   ├── firebase.js
│   │   ├── App.vue
│   │   └── main.js
│   ├── public/
│   ├── functions/
│   ├── package.json
│   └── vite.config.js
└── requirements.txt
```

## Prerequis

- Node.js 20+ recommandé
- npm
- un projet Firebase (Firestore + Auth)

## Installation et lancement

Depuis la racine du repository:

```bash
cd find-my-company
npm install
npm run dev
```

Application disponible ensuite sur l'URL locale affichée par Vite (généralement `http://localhost:5173`).

## Configuration Firebase et variables d'environnement

Créer le fichier `find-my-company/.env` et y définir au minimum:

```bash
VITE_FIREBASE_API_KEY=your_api_key
```

Pour les admins:

```bash
VITE_ADMIN_EMAIL=admin@domain.com
```

ou plusieurs admins:

```bash
VITE_ADMIN_EMAILS=admin1@domain.com,admin2@domain.com
```

Notes:

- si `VITE_FIREBASE_API_KEY` est absente, l'authentification est désactivée,
- Firestore peut rester fonctionnel selon la configuration du projet Firebase.

## Scripts disponibles

Dans le dossier `find-my-company`:

- `npm run dev` lance le serveur de développement,
- `npm run build` génère un build de production,
- `npm run preview` prévisualise le build localement,
- `npm run deploy` publie le dossier `dist` via `gh-pages`.

## Deploiement

Le déploiement actuel est prévu pour GitHub Pages via:

```bash
npm run build
npm run deploy
```

Vérifier avant déploiement:

- les variables d'environnement de build,
- la configuration d'accès Firebase,
- les rôles admin attendus.

## Roadmap courte

- tests unitaires et e2e sur les filtres,
- amélioration de la performance bundle (code splitting),
- tableau de bord admin plus complet (historique des validations),
- import/export des entreprises.

## Contribution

Les contributions sont bienvenues.

1. Crée une branche dédiée.
2. Implémente tes modifications.
3. Vérifie que l'application build correctement.
4. Ouvre une pull request claire avec le contexte et les captures si nécessaire.

