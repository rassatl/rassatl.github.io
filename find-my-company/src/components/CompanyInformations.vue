<script setup>
/**
 * Composant CompanyInformations
 * Affiche les détails complets d'une entreprise
 * Permet d'ajouter des avis d'étudiants et d'accéder aux fonctions CRUD
 */

import { ref, computed } from 'vue';
import { deleteCompany, addStudentRating, calculateAverageRating } from '../services/companyService';

const props = defineProps({
  company: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['refresh', 'edit', 'delete']);

// États pour l'ajout d'avis d'étudiants
const showRatingForm = ref(false);
const studentRating = ref(5);
const studentComment = ref('');
const isSubmittingRating = ref(false);
const ratingMessage = ref('');

/**
 * Formate une date au format lisible français
 * @param {Date} date - Date à formater
 * @returns {string} Date formatée
 */
const formatDate = (date) => {
  if (!date) return 'Non spécifiée';
  const normalizedDate = date?.toDate?.() || date;
  const d = new Date(normalizedDate);
  if (Number.isNaN(d.getTime())) {
    return 'Non spécifiée';
  }
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const websiteHref = computed(() => {
  const raw = props.company?.website;
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  return `https://${raw}`;
});

/**
 * Calcule la note moyenne et le nombre d'avis
 */
const averageRating = computed(() => {
  return calculateAverageRating(props.company);
});

const ratingsCount = computed(() => {
  return props.company?.studentRatings?.length || 0;
});

/**
 * Soumet un nouvel avis d'étudiant
 */
const submitRating = async () => {
  if (!studentComment.value.trim()) {
    ratingMessage.value = 'Veuillez entrer un commentaire';
    return;
  }

  try {
    isSubmittingRating.value = true;
    ratingMessage.value = '';

    // Ajouter l'avis via le service
    await addStudentRating(props.company.id, studentRating.value, studentComment.value);

    // Réinitialiser le formulaire
    studentComment.value = '';
    studentRating.value = 5;
    showRatingForm.value = false;

    // Émettre l'événement de rafraîchissement
    emit('refresh');
    ratingMessage.value = '✅ Avis ajouté avec succès!';
    setTimeout(() => {
      ratingMessage.value = '';
    }, 3000);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'avis:', error);
    ratingMessage.value = '❌ Erreur lors de l\'ajout de l\'avis';
  } finally {
    isSubmittingRating.value = false;
  }
};

/**
 * Supprime l'entreprise avec confirmation
 */
const deleteCompanyHandler = async () => {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer ${props.company.name}?`)) {
    return;
  }

  try {
    await deleteCompany(props.company.id);
    emit('delete');
    alert('Entreprise supprimée avec succès!');
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    alert('Erreur lors de la suppression de l\'entreprise');
  }
};

/**
 * Émet l'événement d'édition
 */
const editCompanyHandler = () => {
  emit('edit', props.company);
};

</script>

<template>
  <div v-if="company" class="company-details">
    <!-- En-tête avec titre et actions -->
    <div class="header">
      <h2>{{ company.name }}</h2>
      <div class="actions">
        <button class="btn-edit" @click="editCompanyHandler" title="Éditer">✏️</button>
        <button class="btn-delete" @click="deleteCompanyHandler" title="Supprimer">🗑️</button>
      </div>
    </div>

    <!-- Informations principales -->
    <section class="info-section">
      <h3>📍 Localisation</h3>
      <p><strong>Adresse:</strong> {{ company.address }}</p>
      <p><strong>Ville:</strong> {{ company.city }}</p>
      <p><strong>Code Postal:</strong> {{ company.pc }}</p>
      <p><strong>Pays:</strong> {{ company.country }}</p>
      <p v-if="company.website" class="website-link">
        <strong>Site web:</strong>
        <a :href="websiteHref" target="_blank" rel="noopener noreferrer">
          {{ company.website }}
        </a>
      </p>
    </section>

    <!-- Spécialité et secteurs -->
    <section class="info-section">
      <h3>💼 Domaines d'activité</h3>
      <p><strong>Spécialité:</strong> {{ company.speciality }}</p>
      <div v-if="company.sectors && company.sectors.length > 0" class="sectors">
        <strong>Secteurs:</strong>
        <div class="sector-tags">
          <span v-for="sector in company.sectors" :key="sector" class="tag">
            {{ sector }}
          </span>
        </div>
      </div>
    </section>

    <!-- Description -->
    <section v-if="company.description" class="info-section">
      <h3>📝 Description</h3>
      <p>{{ company.description }}</p>
    </section>

    <!-- Informations temporelles -->
    <section class="info-section">
      <h3>📅 Dates</h3>
      <p v-if="company.lastHiringDate">
        <strong>Dernière embauche:</strong> {{ formatDate(company.lastHiringDate) }}
      </p>
      <p v-else><strong>Dernière embauche:</strong> Non spécifiée</p>
      <p><strong>Profil créé:</strong> {{ formatDate(company.createdAt) }}</p>
      <p><strong>Dernière modification:</strong> {{ formatDate(company.updatedAt) }}</p>
    </section>

    <!-- Avis des étudiants -->
    <section class="info-section ratings-section">
      <h3>⭐ Avis des étudiants</h3>
      
      <!-- Résumé des avis -->
      <div v-if="ratingsCount > 0" class="ratings-summary">
        <div class="average-rating">
          <span class="stars">{{ '⭐'.repeat(Math.round(averageRating)) }}</span>
          <span class="score">{{ averageRating }}/5</span>
          <span class="count">({{ ratingsCount }} avis)</span>
        </div>
      </div>
      <div v-else class="no-ratings">
        <p>Aucun avis pour le moment. Soyez le premier à donner votre avis!</p>
      </div>

      <!-- Liste des avis -->
      <div v-if="company.studentRatings && company.studentRatings.length > 0" class="ratings-list">
        <div v-for="(rating, index) in company.studentRatings" :key="index" class="rating-item">
          <div class="rating-header">
            <span class="stars">{{ '⭐'.repeat(rating.rating) }}</span>
            <span class="date">{{ formatDate(rating.date) }}</span>
          </div>
          <p class="comment">{{ rating.comment }}</p>
        </div>
      </div>

      <!-- Formulaire d'ajout d'avis -->
      <div v-if="!showRatingForm" class="add-rating-button">
        <button @click="showRatingForm = true" class="btn-primary">
          ➕ Ajouter un avis
        </button>
      </div>

      <div v-else class="rating-form">
        <div class="form-group">
          <label for="rating">Note (1-5):</label>
          <select id="rating" v-model.number="studentRating">
            <option value="1">1 - Mauvais</option>
            <option value="2">2 - Insuffisant</option>
            <option value="3">3 - Moyen</option>
            <option value="4">4 - Bon</option>
            <option value="5">5 - Excellent</option>
          </select>
        </div>

        <div class="form-group">
          <label for="comment">Commentaire:</label>
          <textarea
            id="comment"
            v-model="studentComment"
            placeholder="Partagez votre expérience avec cette entreprise..."
            rows="4"
          ></textarea>
        </div>

        <div v-if="ratingMessage" class="alert" :class="{ 'alert-success': ratingMessage.includes('✅') }">
          {{ ratingMessage }}
        </div>

        <div class="form-actions">
          <button
            @click="submitRating"
            class="btn-submit"
            :disabled="isSubmittingRating"
          >
            {{ isSubmittingRating ? 'Envoi...' : 'Envoyer l\'avis' }}
          </button>
          <button
            @click="showRatingForm = false"
            class="btn-cancel"
          >
            Annuler
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.company-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: var(--black);
  max-height: 85vh;
  overflow-y: auto;
  padding: 10px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid var(--red-esigelec);
  padding-bottom: 15px;
}

.header h2 {
  color: var(--red-esigelec);
  margin: 0;
  flex: 1;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s, background-color 0.2s;
}

.btn-edit {
  background-color: #e7f3ff;
  color: #0066cc;
}

.btn-edit:hover {
  background-color: #cce7ff;
  transform: scale(1.1);
}

.btn-delete {
  background-color: #ffe7e7;
  color: #cc0000;
}

.btn-delete:hover {
  background-color: #ffcccc;
  transform: scale(1.1);
}

.info-section {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid var(--red-esigelec);
}

.info-section h3 {
  color: var(--red-esigelec);
  margin-top: 0;
  margin-bottom: 15px;
}

.info-section p {
  margin: 8px 0;
  line-height: 1.6;
}

.website-link a {
  color: #0066cc;
  text-decoration: none;
  word-break: break-all;
}

.website-link a:hover {
  text-decoration: underline;
}

.sectors {
  margin-top: 10px;
}

.sector-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.tag {
  background-color: var(--red-esigelec);
  color: white;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

/* Section des avis d'étudiants */
.ratings-section {
  border-color: #ffa500;
}

.ratings-section h3 {
  color: #ff8c00;
}

.ratings-summary {
  background-color: white;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.average-rating {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
}

.average-rating .stars {
  font-size: 20px;
}

.average-rating .score {
  font-weight: bold;
  font-size: 18px;
}

.average-rating .count {
  color: #666;
  font-size: 14px;
}

.no-ratings {
  text-align: center;
  padding: 20px;
  color: #999;
  font-style: italic;
}

.ratings-list {
  background-color: white;
  border-radius: 6px;
  margin-bottom: 15px;
  max-height: 300px;
  overflow-y: auto;
}

.rating-item {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}

.rating-item:last-child {
  border-bottom: none;
}

.rating-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rating-header .stars {
  font-size: 16px;
}

.rating-header .date {
  font-size: 12px;
  color: #999;
}

.rating-item .comment {
  margin: 0;
  color: #333;
  line-height: 1.5;
}

.add-rating-button {
  text-align: center;
}

.btn-primary {
  background-color: var(--red-esigelec);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-primary:hover {
  background-color: #b8293f;
}

.rating-form {
  background-color: white;
  padding: 15px;
  border-radius: 6px;
  border: 2px dashed var(--red-esigelec);
}

.rating-form .form-group {
  margin-bottom: 15px;
}

.rating-form label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--black);
}

.rating-form select,
.rating-form textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
}

.rating-form textarea {
  resize: vertical;
}

.rating-form textarea:focus,
.rating-form select:focus {
  outline: none;
  border-color: var(--red-esigelec);
  box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.1);
}

.alert {
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  background-color: #ffe7e7;
  color: #cc0000;
  border: 1px solid #ffcccc;
  font-size: 14px;
}

.alert-success {
  background-color: #e7ffe7;
  color: #00cc00;
  border-color: #ccffcc;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-submit,
.btn-cancel {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-submit {
  background-color: var(--red-esigelec);
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background-color: #b8293f;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel {
  background-color: #e0e0e0;
  color: var(--black);
}

.btn-cancel:hover {
  background-color: #d0d0d0;
}
</style>
