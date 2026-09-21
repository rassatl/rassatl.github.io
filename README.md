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

## 🔐 Authentification et droits

Deux types de comptes Firebase Auth coexistent, et **être connecté ne suffit pas à être admin** :

- **Les étudiants** ajoutent des entreprises. La première étape du formulaire leur demande leur email étudiant (`@groupe-esigelec.org`) et leur envoie un lien de connexion ; cliquer dessus prouve qu'ils possèdent la boîte mail. Cette vérification est imposée par `firestore.rules` (`isStudent()`), pas seulement par l'interface.
  - **Qui a ajouté quoi** : l'email vérifié est conservé sur la proposition (`submittedBy`), puis, à la validation, dans la collection **privée** `companyAuthors` (un document par entreprise, lisible et écrivable des seuls admins), qui survit à la suppression de la proposition. Une proposition refusée n'est pas conservée.
  - **Contacts réservés aux étudiants** : les contacts d'une entreprise (nom, rôle, email, téléphone) ne s'affichent que pour un étudiant dont l'email est vérifié (ou un admin). Un visiteur voit un message et peut vérifier son email directement depuis la fiche ; le lien le ramène ensuite sur cette fiche. Comme pour le reste, c'est `firestore.rules` qui l'impose : la *liste* des contacts est refusée aux autres. La lecture d'un contact *précis* (par son identifiant) reste ouverte, pour que le lien « masquer mes informations » envoyé au contact fonctionne sans connexion.
  - **Visibilité, au choix de l'étudiant** : une case (décochée par défaut) permet d'afficher son email sur la fiche de l'entreprise (`addedBy`, lisible par tous). Sans elle, l'email n'apparaît jamais sur l'entreprise publique ; seuls les admins le voient.
- **Les administrateurs** valident les propositions, lisent les tickets et journaux d'erreurs, et peuvent ajouter directement une entreprise. Ils se connectent par email + mot de passe.

À faire une fois dans la console Firebase, **avant de déployer les règles Firestore** (le workflow déploie les règles à chaque push sur `main`) :

1. **Authentication → Sign-in method → Email/Password** : cocher **« Lien de connexion par e-mail (connexion sans mot de passe) »**.
2. **Authentication → Paramètres → Domaines autorisés** : vérifier que le domaine du site (ex. `rassatl.github.io`) est bien listé.
3. **Firestore → collection `admins`** : pour chaque administrateur, créer un document dont l'**ID est l'UID** du compte (visible dans Authentication → Utilisateurs), avec un champ quelconque (ex. `role: "admin"`). Sans ce document, un compte perd ses droits d'admin.

Le domaine étudiant est défini à deux endroits à garder synchronisés : `src/utils/studentEmail.js` et `isStudent()` dans `firestore.rules`.

## 🖥️ Usage

1. **Exploring Companies**: Use the interactive map to explore company locations. Zoom and pan to reveal nearby businesses.
2. **Filtering Companies**: Select from different specialties to filter the companies that match your interest.
3. **Adding Companies**: Click the "Add Company" button to add a new company to the map. Verify your student email, fill in the relevant details and confirm.
4. **Editing**: Modify company information easily via the interface.

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
