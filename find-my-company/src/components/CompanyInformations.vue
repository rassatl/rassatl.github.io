<script setup>
/**
 * Composant CompanyInformations
 * Affiche les détails complets d'une entreprise
 * Permet d'ajouter des avis d'étudiants et d'accéder aux fonctions CRUD
 */

import { ref, computed } from 'vue';
import { deleteCompany, addStudentRating, calculateAverageRating } from '../services/companyService';
import { getI18n, getSectorLabel, getSpecialityLabel } from '../constants/i18n';

const props = defineProps({
  company: {
    type: Object,
    required: true
  },
  language: {
    type: String,
    default: 'fr'
  },
  currentUser: {
    type: Object,
    default: null,
  },
  currentUserProfile: {
    type: Object,
    default: null,
  }
});

const emit = defineEmits(['refresh', 'edit', 'delete']);

const showRatingForm = ref(false);
const studentRating = ref(5);
const studentComment = ref('');
const isSubmittingRating = ref(false);
const ratingMessage = ref('');
const ui = computed(() => getI18n(props.language));

const formatDate = (date) => {
  if (!date) return ui.value.companyInfo.notSpecified;
  const normalizedDate = date?.toDate?.() || date;
  const d = new Date(normalizedDate);
  if (Number.isNaN(d.getTime())) {
    return ui.value.companyInfo.notSpecified;
  }
  return d.toLocaleDateString(props.language === 'en' ? 'en-GB' : 'fr-FR', {
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

const averageRating = computed(() => {
  return calculateAverageRating(props.company);
});

const ratingsCount = computed(() => {
  return props.company?.studentRatings?.length || 0;
});

const specialityLabel = computed(() => {
  return getSpecialityLabel(props.company?.speciality, props.language, 'fullLabels');
});

const contactSections = computed(() => {
  return [
    {
      key: 'tutor',
      label: ui.value.companyInfo.tutor,
      name: props.company?.tutorName,
      email: props.company?.tutorEmail,
      phone: props.company?.tutorPhone,
    },
    {
      key: 'hr',
      label: ui.value.companyInfo.hr,
      name: props.company?.hrName,
      email: props.company?.hrEmail,
      phone: props.company?.hrPhone,
    },
  ];
});

const getEmailHref = (email) => {
  if (!email?.trim()) return '';
  return `mailto:${email.trim()}`;
};

const getPhoneHref = (phone) => {
  if (!phone?.trim()) return '';
  return `tel:${phone.trim().replace(/\s+/g, '')}`;
};

const getReviewerLabel = (rating) => {
  if (rating.reviewerName?.trim()) return rating.reviewerName;
  if (rating.reviewerFirstName || rating.reviewerLastName) {
    return `${rating.reviewerFirstName || ''} ${rating.reviewerLastName || ''}`.trim();
  }
  return ui.value.companyInfo.reviewerUnknown;
};

const submitRating = async () => {
  if (!studentComment.value.trim()) {
    ratingMessage.value = ui.value.companyInfo.commentRequired;
    return;
  }

  try {
    isSubmittingRating.value = true;
    ratingMessage.value = '';

    const profileFirstName = props.currentUserProfile?.firstName?.trim() || '';
    const profileLastName = props.currentUserProfile?.lastName?.trim() || '';
    const profileDisplayName = props.currentUserProfile?.displayName?.trim() || '';
    const fallbackDisplayName = props.currentUser?.displayName?.trim() || '';

    const reviewerFirstName = profileFirstName;
    const reviewerLastName = profileLastName;
    const reviewerName = `${profileFirstName} ${profileLastName}`.trim() || profileDisplayName || fallbackDisplayName;

    await addStudentRating(
      props.company.id,
      studentRating.value,
      studentComment.value,
      {
        uid: props.currentUser?.uid || null,
        reviewerName,
        reviewerFirstName,
        reviewerLastName,
      }
    );
    studentComment.value = '';
    studentRating.value = 5;
    showRatingForm.value = false;
    emit('refresh');
    ratingMessage.value = ui.value.companyInfo.ratingSuccess;
    setTimeout(() => {
      ratingMessage.value = '';
    }, 3000);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'avis:', error);
    ratingMessage.value = ui.value.companyInfo.ratingError;
  } finally {
    isSubmittingRating.value = false;
  }
};

const deleteCompanyHandler = async () => {
  if (!confirm(`${ui.value.companyInfo.confirmDelete} ${props.company.name}?`)) {
    return;
  }

  try {
    await deleteCompany(props.company.id);
    emit('delete');
    alert(ui.value.companyInfo.deleteSuccess);
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    alert(ui.value.companyInfo.deleteError);
  }
};

const editCompanyHandler = () => {
  emit('edit', props.company);
};
</script>

<template>
  <div v-if="company" class="company-details">
    <div class="header">
      <h2>{{ company.name }}</h2>
    </div>

    <section class="info-section">
      <h3>{{ ui.companyInfo.location }}</h3>
      <p><strong>{{ ui.companyInfo.address }}:</strong> {{ company.address }}</p>
      <p><strong>{{ ui.companyInfo.city }} :</strong> {{ company.city }}</p>
      <p><strong>{{ ui.companyInfo.postalCode }}:</strong> {{ company.pc }}</p>
      <p><strong>{{ ui.companyInfo.country }} :</strong> {{ company.country }}</p>
      <p v-if="company.website" class="website-link">
        <strong>{{ ui.companyInfo.website }} : </strong><a :href="websiteHref" target="_blank" rel="noopener noreferrer">{{ company.website }}</a>
      </p>
    </section>

    <section class="info-section">
      <h3>{{ ui.companyInfo.domains }}</h3>
      <p><strong>{{ ui.companyInfo.speciality }}:</strong> {{ specialityLabel }}</p>
      <div v-if="company.sectors && company.sectors.length > 0" class="sectors">
        <strong>{{ ui.companyInfo.sectors }}:</strong>
        <div class="sector-tags">
          <span v-for="sector in company.sectors" :key="sector" class="tag">
            {{ getSectorLabel(sector, props.language) }}
          </span>
        </div>
      </div>
    </section>

    <section v-if="contactSections.some((section) => section.name || section.email || section.phone)" class="info-section">
      <h3>{{ ui.companyInfo.internshipContacts }}</h3>
      <div v-for="section in contactSections" :key="section.key" class="contact-card">
        <h4>{{ section.label }}</h4>
        <p v-if="section.name"><strong>{{ ui.companyInfo.contactName }}:</strong> {{ section.name }}</p>
        <p v-if="section.email">
          <strong>{{ ui.companyInfo.contactEmail }}:</strong>
          <a :href="getEmailHref(section.email)">{{ section.email }}</a>
        </p>
        <p v-if="section.phone">
          <strong>{{ ui.companyInfo.contactPhone }}:</strong>
          <a :href="getPhoneHref(section.phone)">{{ section.phone }}</a>
        </p>
      </div>
    </section>

    <section v-if="company.description" class="info-section">
      <h3>{{ ui.companyInfo.description }}</h3>
      <p>{{ company.description }}</p>
    </section>

    <section class="info-section">
      <h3>{{ ui.companyInfo.dates }}</h3>
      <p v-if="company.lastHiringDate">
        <strong>{{ ui.companyInfo.lastHiringDate }}:</strong> {{ formatDate(company.lastHiringDate) }}
      </p>
      <p v-else><strong>{{ ui.companyInfo.lastHiringDate }}:</strong> {{ ui.companyInfo.notSpecified }}</p>
      <p><strong>{{ ui.companyInfo.profileCreated }}:</strong> {{ formatDate(company.createdAt) }}</p>
      <p><strong>{{ ui.companyInfo.lastUpdate }}:</strong> {{ formatDate(company.updatedAt) }}</p>
    </section>

    <section class="info-section ratings-section">
      <h3>{{ ui.companyInfo.ratings }}</h3>

      <div v-if="ratingsCount > 0" class="ratings-summary">
        <div class="average-rating">
          <span class="stars">{{ '⭐'.repeat(Math.round(averageRating)) }}</span>
          <span class="score">{{ averageRating }}/5</span>
          <span class="count">({{ ratingsCount }} {{ ui.companyInfo.ratingCount }})</span>
        </div>
      </div>
      <div v-else class="no-ratings">
        <p>{{ ui.companyInfo.noRatings }}</p>
      </div>

      <div v-if="company.studentRatings && company.studentRatings.length > 0" class="ratings-list">
        <div v-for="(rating, index) in company.studentRatings" :key="index" class="rating-item">
          <div class="rating-header">
            <span class="stars">{{ '⭐'.repeat(rating.rating) }}</span>
            <span class="date">{{ formatDate(rating.date) }}</span>
          </div>
          <p class="reviewer">
            <strong>{{ ui.companyInfo.reviewer }}:</strong> {{ getReviewerLabel(rating) }}
          </p>
          <p class="comment">{{ rating.comment }}</p>
        </div>
      </div>

      <div v-if="!showRatingForm" class="add-rating-button">
        <button @click="showRatingForm = true" class="btn-primary">
          {{ ui.companyInfo.addRating }}
        </button>
      </div>

      <div v-else class="rating-form">
        <div class="form-group">
          <label for="rating">{{ ui.companyInfo.score }}</label>
          <select id="rating" v-model.number="studentRating">
            <option value="1">1 - {{ ui.companyInfo.scoreLabels[0] }}</option>
            <option value="2">2 - {{ ui.companyInfo.scoreLabels[1] }}</option>
            <option value="3">3 - {{ ui.companyInfo.scoreLabels[2] }}</option>
            <option value="4">4 - {{ ui.companyInfo.scoreLabels[3] }}</option>
            <option value="5">5 - {{ ui.companyInfo.scoreLabels[4] }}</option>
          </select>
        </div>

        <div class="form-group">
          <label for="comment">{{ ui.companyInfo.comment }}</label>
          <textarea
            id="comment"
            v-model="studentComment"
            :placeholder="ui.companyInfo.commentPlaceholder"
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
            {{ isSubmittingRating ? ui.companyInfo.sending : ui.companyInfo.send }}
          </button>
          <button
            @click="showRatingForm = false"
            class="btn-cancel"
          >
            {{ ui.companyInfo.cancel }}
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
  width: 100%;
  min-width: 0;
  max-height: none;
  overflow: visible;
  padding: 10px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid var(--red-esigelec);
  padding-bottom: 15px;
  gap: 12px;
  flex-wrap: wrap;
}

.header h2 {
  color: var(--red-esigelec);
  margin: 0;
  flex: 1;
  min-width: 0;
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
  word-break: break-word;
}

.website-link a {
  color: #0066cc;
  text-decoration: none;
  word-break: break-all;
}

.website-link a:hover {
  text-decoration: underline;
}

.contact-card {
  border: 1px solid rgba(220, 53, 69, 0.12);
  border-radius: 10px;
  padding: 14px 16px;
  background: rgba(220, 53, 69, 0.03);
}

.contact-card + .contact-card {
  margin-top: 12px;
}

.contact-card h4 {
  margin: 0 0 10px;
  color: var(--red-esigelec);
}

.contact-card p {
  margin: 6px 0;
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

.rating-item .reviewer {
  margin: 0 0 6px;
  color: #555;
  font-size: 13px;
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
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.rating-form .form-group {
  margin-bottom: 15px;
  min-width: 0;
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
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  max-width: 100%;
  box-sizing: border-box;
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
  flex-wrap: wrap;
}

.form-actions button {
  flex: 1 1 160px;
  max-width: 100%;
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
