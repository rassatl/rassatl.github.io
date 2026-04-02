/**
 * Service pour la gestion des entreprises avec Firebase
 * Centralise tous les appels à la base de données Firestore
 * Permet une meilleure maintenabilité et testabilité du code
 */

import {
  db
} from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';

/**
 * Structure de données pour une entreprise
 * @typedef {Object} Company
 * @property {string} id - Identifiant unique (Firestore)
 * @property {string} name - Nom de l'entreprise
 * @property {string} speciality - Spécialité (ex: "Développement Logiciel")
 * @property {string} address - Adresse complète
 * @property {string} city - Ville
 * @property {string} country - Pays
 * @property {string} pc - Code postal
 * @property {number} x - Latitude (pour la carte)
 * @property {number} y - Longitude (pour la carte)
 * @property {string} description - Description de l'entreprise
 * @property {string[]} sectors - Secteurs d'activité
 * @property {Date} lastHiringDate - Date de la dernière embauche
 * @property {Object[]} studentRatings - Avis des étudiants
 * @property {number} studentRatings[].rating - Note (1-5)
 * @property {string} studentRatings[].comment - Commentaire
 * @property {Date} createdAt - Date de création
 * @property {Date} updatedAt - Date de modification
 * @property {string} website - Site web (optionnel)
 * @property {string} logo_url - URL du logo (optionnel)
 */

/**
 * Récupère toutes les entreprises de la base de données
 * @returns {Promise<Company[]>} Liste des entreprises
 * @throws {Error} Erreur lors de la récupération
 */
export const getAllCompanies = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'companies'));
    const companies = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      companies.push({
        id: doc.id,
        ...data,
        // Convertir les timestamps Firestore en dates JavaScript
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        lastHiringDate: data.lastHiringDate?.toDate?.() || data.lastHiringDate || null,
      });
    });
    
    return companies;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des entreprises:', error);
    throw new Error(`Impossible de récupérer les entreprises: ${error.message}`);
  }
};

/**
 * Récupère une entreprise spécifique par son ID
 * @param {string} companyId - ID de l'entreprise
 * @returns {Promise<Company|null>} L'entreprise ou null
 * @throws {Error} Erreur lors de la récupération
 */
export const getCompanyById = async (companyId) => {
  try {
    const docRef = doc(db, 'companies', companyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        lastHiringDate: data.lastHiringDate?.toDate?.() || data.lastHiringDate || null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de l\'entreprise:', error);
    throw new Error(`Impossible de récupérer l'entreprise: ${error.message}`);
  }
};

/**
 * Crée une nouvelle entreprise
 * @param {Omit<Company, 'id'|'createdAt'|'updatedAt'>} companyData - Données de l'entreprise
 * @returns {Promise<{id: string, ...companyData}>} Entreprise créée avec son ID
 * @throws {Error} Erreur lors de la création
 */
export const createCompany = async (companyData) => {
  try {
    // Validation des données obligatoires
    const requiredFields = ['name', 'speciality', 'address', 'city', 'country', 'pc'];
    const missingFields = requiredFields.filter((field) => !companyData[field]);

    if (companyData.x === undefined || companyData.x === null || Number.isNaN(companyData.x)) {
      missingFields.push('x');
    }
    if (companyData.y === undefined || companyData.y === null || Number.isNaN(companyData.y)) {
      missingFields.push('y');
    }
    
    if (missingFields.length > 0) {
      throw new Error(`Champs manquants: ${missingFields.join(', ')}`);
    }
    
    // Ajouter les métadonnées
    const dataToAdd = {
      ...companyData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastHiringDate: companyData.lastHiringDate
        ? Timestamp.fromDate(new Date(companyData.lastHiringDate))
        : null,
      // Initialiser les champs optionnels
      sectors: companyData.sectors || [],
      studentRatings: companyData.studentRatings || [],
      description: companyData.description || '',
      website: companyData.website || '',
      logo_url: companyData.logo_url || '',
    };
    
    const docRef = await addDoc(collection(db, 'companies'), dataToAdd);
    
    console.log('✅ Entreprise créée avec succès:', docRef.id);
    
    return {
      id: docRef.id,
      ...companyData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'entreprise:', error);
    throw new Error(`Impossible de créer l'entreprise: ${error.message}`);
  }
};

/**
 * Met à jour une entreprise existante
 * @param {string} companyId - ID de l'entreprise
 * @param {Partial<Company>} companyData - Données à mettre à jour
 * @returns {Promise<Company>} Entreprise mise à jour
 * @throws {Error} Erreur lors de la mise à jour
 */
export const updateCompany = async (companyId, companyData) => {
  try {
    const docRef = doc(db, 'companies', companyId);
    
    // Ajouter le timestamp de modification
    const dataToUpdate = {
      ...companyData,
      lastHiringDate: companyData.lastHiringDate
        ? Timestamp.fromDate(new Date(companyData.lastHiringDate))
        : companyData.lastHiringDate ?? null,
      updatedAt: Timestamp.now(),
    };
    
    await updateDoc(docRef, dataToUpdate);
    
    console.log('✅ Entreprise mise à jour avec succès:', companyId);
    
    // Récupérer et retourner l'entreprise mise à jour
    return await getCompanyById(companyId);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de l\'entreprise:', error);
    throw new Error(`Impossible de mettre à jour l'entreprise: ${error.message}`);
  }
};

/**
 * Supprime une entreprise
 * @param {string} companyId - ID de l'entreprise
 * @returns {Promise<void>}
 * @throws {Error} Erreur lors de la suppression
 */
export const deleteCompany = async (companyId) => {
  try {
    const docRef = doc(db, 'companies', companyId);
    await deleteDoc(docRef);
    
    console.log('✅ Entreprise supprimée avec succès:', companyId);
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de l\'entreprise:', error);
    throw new Error(`Impossible de supprimer l'entreprise: ${error.message}`);
  }
};

/**
 * Recherche des entreprises par terme de recherche
 * Cherche dans le nom et la description
 * @param {string} searchTerm - Terme de recherche
 * @param {Company[]} companies - Liste des entreprises (données locales)
 * @returns {Company[]} Entreprises correspondant à la recherche
 */
export const searchCompanies = (searchTerm, companies) => {
  if (!searchTerm.trim()) {
    return companies;
  }
  
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  return companies.filter(company => 
    company.name.toLowerCase().includes(lowerSearchTerm) ||
    company.description?.toLowerCase().includes(lowerSearchTerm) ||
    company.city.toLowerCase().includes(lowerSearchTerm) ||
    company.country.toLowerCase().includes(lowerSearchTerm)
  );
};

/**
 * Filtre les entreprises par spécialité
 * @param {string} speciality - Spécialité à filtrer (ou '' pour toutes)
 * @param {Company[]} companies - Liste des entreprises
 * @returns {Company[]} Entreprises filtrées
 */
export const filterCompaniesBySpeciality = (speciality, companies) => {
  if (!speciality || speciality === 'Toutes') {
    return companies;
  }
  
  return companies.filter(company => 
    company.speciality === speciality
  );
};

/**
 * Ajoute un avis d'étudiant à une entreprise
 * @param {string} companyId - ID de l'entreprise
 * @param {number} rating - Note (1-5)
 * @param {string} comment - Commentaire
 * @returns {Promise<Company>} Entreprise mise à jour
 */
export const addStudentRating = async (companyId, rating, comment) => {
  try {
    if (rating < 1 || rating > 5) {
      throw new Error('La note doit être entre 1 et 5');
    }
    
    const company = await getCompanyById(companyId);
    const studentRatings = company.studentRatings || [];
    
    // Ajouter le nouvel avis
    studentRatings.push({
      rating,
      comment,
      date: Timestamp.now(),
    });
    
    return await updateCompany(companyId, { studentRatings });
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout de l\'avis:', error);
    throw new Error(`Impossible d'ajouter l'avis: ${error.message}`);
  }
};

/**
 * Calcule la note moyenne d'une entreprise
 * @param {Company} company - Entreprise
 * @returns {number} Note moyenne (arrondie à 2 décimales)
 */
export const calculateAverageRating = (company) => {
  if (!company.studentRatings || company.studentRatings.length === 0) {
    return 0;
  }
  
  const sum = company.studentRatings.reduce((acc, rating) => acc + rating.rating, 0);
  return Number((sum / company.studentRatings.length).toFixed(2));
};
