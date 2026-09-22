# 🚀 Find my company

**Find my company** is a powerful and flexible web application built with **Vue.js** and **Leaflet**, designed to showcase and manage company locations on an interactive map. Users can filter companies by specialties, view company details, and interact with the map for enhanced experience.

## 📝 Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## 💡 About

This project is designed to allow users to explore companies based on their locations and specialties. By integrating **Leaflet** for map visualization and **Firebase** for backend services, we provide a seamless experience for users to interact with company data in real-time.

Whether you're a developer or an entrepreneur, this application provides a powerful tool for discovering, managing, and viewing company locations.

## 🚀 Features

- **Interactive Map**: Visualize company locations using **Leaflet.js**.
- **Company Filters**: Filter companies based on specialties and easily find relevant businesses.
- **Dynamic Updates**: Real-time updates for map markers based on visible regions and zoom levels.
- **Add/Edit Companies**: Easily add or edit companies using an intuitive interface.
- **Mobile Responsive**: Optimized for both desktop and mobile users.

## 🛠️ Tech Stack

This project uses the following technologies:

- **Vue.js**: JavaScript framework for building user interfaces.
- **Leaflet.js**: JavaScript library for interactive maps.
- **Firebase**: Cloud Firestore for backend data management.
- **CSS/SCSS**: For custom styling and responsiveness.
- **Node.js**: For running development server and dependencies.

## 📦 Installation

To get started with this project locally, follow these steps:

1. **Clone the repository**:

    ```bash
    git clone https://github.com/rassatl/find-my-company.git
    ```

2. **Navigate to the project folder**:

    ```bash
    cd find-my-company
    ```

3. **Install dependencies**:

    ```bash
    npm install
    ```

4. **Set up Firebase**:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
   - Obtain your Firebase config and place it in the appropriate file (e.g., `.env` or `firebaseConfig.js`).

5. **Configurer l'authentification** (voir la section [Authentification et droits](#-authentification-et-droits) ci-dessous).

6. **Run the development server**:

    ```bash
    npm run serve
    ```

7. Open your browser and go to `http://localhost:8080` to see the application in action.

## 🔐 Deux formulaires d'ajout, et droits d'administration

Le formulaire d'ajout ("+") n'est pas le même selon qui l'ouvre :

- **Non connecté → formulaire confidentiel.** Un visiteur qui n'est pas connecté n'a accès qu'à un formulaire minimal : spécialité, pays, ville, un point cliqué sur la carte (placé automatiquement au centre de la ville dès qu'elle est renseignée, ajustable ensuite), un moyen de le recontacter, et en option un avis personnel (ressenti sur la mission, le pays, le logement...). Ni nom, ni adresse, ni site web, ni mission. L'ajout lui-même est **totalement anonyme** : rien n'indique qui l'a envoyé, ni sur la proposition ni après publication.
  - **Moyen de contact, obligatoire mais libre** : email personnel, email étudiant, WhatsApp ou LinkedIn — au choix, un seul suffit, et rien n'est vérifié (ni le format, ni que la personne en est bien propriétaire). Le but est qu'un autre étudiant intéressé par ce point puisse joindre directement la personne qui l'a ajouté. Comme les contacts du format complet, ce moyen de contact n'est visible que des étudiants vérifiés et des admins (`firestore.rules`), jamais des visiteurs non connectés ; contrairement à eux, il n'a pas de lien « masquer mes informations » (pas de lecture par identifiant précis).
- **Admin ou étudiant connecté → formulaire complet.** Nom, adresse, site web, contact(s) à qui écrire, mission effectuée, avis (note + commentaire). Réservé à un admin ou à un étudiant dont l'email est vérifié (voir ci-dessous) : un visiteur non connecté n'y a pas accès.

Dans les deux cas, la proposition part en attente de validation par un administrateur (`pendingCompanies`), sauf pour un admin qui ajoute directement (publié immédiatement, sans modération). Le format d'une proposition (confidentiel ou complet) est fixé à la soumission et ne peut pas être mélangé : `firestore.rules` refuse par exemple un document confidentiel qui porterait un champ `name`.

- **Les étudiants** créent eux-mêmes leur compte (email `@groupe-esigelec.org` + mot de passe) depuis le panneau de connexion (icône en haut de la sidebar → « Pas encore de compte ? Créez-en un maintenant »), puis doivent cliquer sur le lien reçu par email (vérification standard de Firebase, `sendEmailVerification`) avant de pouvoir se connecter : tant que ce n'est pas fait, se connecter affiche un message « email non vérifié » plutôt que de laisser passer. Une fois connectés, ils utilisent le formulaire complet, où une étape d'attribution (jamais bloquante, puisqu'ils sont déjà connectés) leur permet de :
  - **Être identifiés comme auteur** : l'email vérifié est conservé sur la proposition (`submittedBy`), puis, à la validation, dans la collection **privée** `companyAuthors` (un document par entreprise, lisible et écrivable des seuls admins), qui survit à la suppression de la proposition. Une proposition refusée n'est pas conservée.
  - **Choisir la visibilité de cet email** : une case (décochée par défaut) permet de l'afficher sur la fiche de l'entreprise (`addedBy`, lisible par tous). Sans elle, l'email n'apparaît jamais sur l'entreprise publique ; seuls les admins le voient.
  - Cette attribution (`submittedBy` = son propre email, choix de visibilité booléen) est imposée par `firestore.rules`, pas seulement par l'interface : personne ne peut s'attribuer une proposition à la place de quelqu'un d'autre.
  - **Contacts réservés aux étudiants** : les contacts d'une entreprise du format complet (nom, rôle, email, téléphone) ne s'affichent que pour un étudiant vérifié (ou un admin). Un visiteur voit un message et peut ouvrir le même panneau de connexion directement depuis la fiche. C'est `firestore.rules` qui l'impose : la *liste* des contacts est refusée aux autres ; la lecture d'un contact *précis* (par son identifiant) reste ouverte, pour que le lien « masquer mes informations » envoyé au contact fonctionne sans connexion.
- **Les administrateurs** valident ou refusent les propositions (des deux formats), lisent les tickets et journaux d'erreurs, et peuvent ajouter directement une entreprise via le formulaire complet. Leur compte est créé à la main (voir ci-dessous), pas par le formulaire d'inscription ; ils se connectent par le même panneau, avec leur email + mot de passe.

### Tableau des droits

Ce que chaque type d'utilisateur peut faire, tel qu'imposé par `firestore.rules` (pas seulement par l'interface) :

| Action | Déconnecté (anonyme) | Connecté (étudiant vérifié) | Admin |
|---|:---:|:---:|:---:|
| Voir la carte et les fiches des entreprises publiées | ✅ | ✅ | ✅ |
| Ajouter un point via le formulaire confidentiel (anonyme) | ✅ | ❌ *(réservé aux non-connectés)* | ❌ |
| Ajouter une entreprise via le formulaire complet | ❌ | ✅ (en attente de modération) | ✅ (publiée directement) |
| Attribuer sa proposition à son compte (`submittedBy`) | — | ✅ | — *(n'a pas besoin d'attribution : il publie directement)* |
| Choisir d'afficher son email sur la fiche publiée (`addedBy`) | — | ✅ | — |
| Voir les contacts d'une entreprise (format complet ou confidentiel) | ❌ | ✅ | ✅ |
| Signaler un problème (ticket) | ✅ | ✅ | ✅ |
| Créer un compte étudiant (email `@groupe-esigelec.org`) | ✅ | — *(déjà fait)* | — |
| Voir la liste des propositions en attente (`pendingCompanies`) | ❌ | ❌ | ✅ |
| Valider ou refuser une proposition en attente | ❌ | ❌ | ✅ |
| Voir l'auteur privé d'une entreprise (`companyAuthors`) | ❌ | ❌ | ✅ |
| Voir les tickets signalés | ❌ | ❌ | ✅ |
| Voir les journaux d'erreurs techniques (`errorLogs`) | ❌ | ❌ | ✅ |
| Se donner soi-même les droits admin | ❌ | ❌ | — *(impossible pour tout le monde : le document `admins/{uid}` ne peut être créé que depuis la console Firebase)* |

Un compte connecté n'est « étudiant vérifié » que s'il a un email `@groupe-esigelec.org` et a cliqué le lien de vérification (`email_verified`) ; sinon, il n'a aucun droit de plus qu'un visiteur déconnecté (formulaire confidentiel uniquement, pas de contacts). Être connecté n'est jamais synonyme d'être admin : un compte n'a les droits admin que s'il possède le document `admins/{uid}` créé à la main dans la console Firebase (voir ci-dessous).

À faire une fois dans la console Firebase, **avant de déployer les règles Firestore** (le workflow déploie les règles à chaque push sur `main`) :

1. **Authentication → Sign-in method** : vérifier que **Email/Password** est activé (nécessaire aussi bien pour les admins que pour l'inscription des étudiants).
2. **Authentication → Paramètres → Domaines autorisés** : vérifier que le domaine du site (ex. `rassatl.github.io`) est bien listé — sinon le lien de vérification d'email échoue.
3. **Firestore → collection `admins`** : pour chaque administrateur, créer un document dont l'**ID est l'UID** du compte (visible dans Authentication → Utilisateurs), avec un champ quelconque (ex. `role: "admin"`). Sans ce document, un compte perd ses droits d'admin. Un compte admin est créé comme n'importe quel autre (Authentication → Utilisateurs → Ajouter un utilisateur), pas via le formulaire d'inscription du site.

**Le mail de vérification arrive en indésirables ou en quarantaine.** Firebase l'envoie depuis `noreply@<projet>.firebaseapp.com`, une adresse générique que les messageries d'école filtrent presque toujours. L'interface prévient l'étudiant, à l'inscription comme à une tentative de connexion avant vérification, de regarder ces dossiers (avec un bouton pour renvoyer l'email, et un autre pour actualiser son statut une fois le lien cliqué). Pour améliorer la situation à la source : personnaliser le modèle de mail (Authentication → Templates → « Vérification de l'adresse e-mail ») et surtout envoyer depuis un domaine à soi (« Personnaliser le domaine », qui demande des enregistrements DNS).

Le domaine étudiant est défini à deux endroits à garder synchronisés : `src/utils/studentEmail.js` et `isStudent()` dans `firestore.rules`.

Les contacts d'une entreprise (format complet) reçoivent un email (EmailJS, variables `VITE_EMAILJS_*`) les prévenant que leurs coordonnées sont visibles, avec un lien pour les masquer sans avoir à se connecter ; sans ces variables, l'envoi est silencieusement ignoré (utile pour les tests, voir `.env.e2e`).

## 🖥️ Usage

1. **Exploring companies**: use the interactive map to explore company locations, or points by speciality/country/city for confidential entries.
2. **Filtering companies**: select from different specialties to filter the entries that match your interest.
3. **Adding an entry**: click the "+" button. Not signed in, you get the confidential form (speciality, country, city, a point on the map, optional personal review) — fully anonymous, no account needed. Signed in with a verified student account, or as an admin, you get the full form (name, address, website, contact(s), mission, review).
4. **Editing**: modify company information easily via the interface.

## 🛠️ Contributing

Contributions are welcome! If you have any ideas, bugs, or improvements, feel free to open an issue or submit a pull request. Here's how you can contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add some feature'`).
5. Push to the branch (`git push origin feature-branch`).
6. Open a pull request.

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

Enjoy exploring **Find my company**! Feel free to contact me if you need assistance or have any questions. Let's build something great together! 😄
