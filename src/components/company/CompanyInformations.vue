<script setup>
import { ref, watch, inject } from 'vue'
import { db } from '../../services/firebase'
import { collection, getDocs } from 'firebase/firestore'
import StarRating from '../common/StarRating.vue'

const t = inject('t')
const props = defineProps({
  company: {
    type: Object,
    required: true
  }
})

const contacts = ref([])
const isLoadingContacts = ref(true)

const fetchContacts = async (companyId) => {
  if (!companyId) {
    contacts.value = []
    isLoadingContacts.value = false
    return
  }
  isLoadingContacts.value = true
  try {
    const snapshot = await getDocs(collection(db, 'companies', companyId, 'contacts'))
    contacts.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error('Erreur lors de la récupération des contacts :', error)
    contacts.value = []
  } finally {
    isLoadingContacts.value = false
  }
}

watch(() => props.company?.id, (companyId) => fetchContacts(companyId), { immediate: true })
</script>

<template>
  <div class="details">
    <h2>{{ company.name }}</h2>
    <p><strong>Spécialité :</strong> {{ company.speciality }}</p>
    <p><strong>Ville :</strong> {{ company.city }}</p>
    <p><strong>Pays :</strong> {{ company.country }}</p>
    <p><strong>Code Postal :</strong> {{ company.pc }}</p>
    <p v-if="company.website">
      <strong>Site :</strong>
      <a :href="company.website" target="_blank" rel="noopener noreferrer">{{ company.website }}</a>
    </p>

    <section v-if="company.mission" class="info-section">
      <h3>{{ t('companyInformations.missionTitle') }}</h3>
      <p class="mission-text">{{ company.mission }}</p>
    </section>

    <section v-if="company.review?.rating" class="info-section">
      <h3>{{ t('companyInformations.reviewTitle') }}</h3>
      <StarRating :model-value="company.review.rating" readonly />
      <p v-if="company.review.comment" class="review-comment">{{ company.review.comment }}</p>
    </section>

    <section class="info-section">
      <h3>{{ t('companyInformations.contactsTitle') }}</h3>
      <p v-if="isLoadingContacts" class="loading">{{ t('companyInformations.loadingContacts') }}</p>
      <p v-else-if="contacts.length === 0" class="empty">{{ t('companyInformations.noContacts') }}</p>
      <ul v-else class="contacts-list">
        <li v-for="contact in contacts" :key="contact.id" class="contact-card">
          <p v-if="contact.hidden" class="contact-hidden">{{ t('companyInformations.contactHidden') }}</p>
          <template v-else>
            <p class="contact-name"><strong>{{ contact.firstName }} {{ contact.lastName }}</strong> — {{ contact.role }}</p>
            <p class="contact-detail"><a :href="`mailto:${contact.email}`">{{ contact.email }}</a></p>
            <p v-if="contact.phone" class="contact-detail"><a :href="`tel:${contact.phone}`">{{ contact.phone }}</a></p>
          </template>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.details {
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: var(--black);
}
.details p {
  margin: 0;
}
h2 {
  color: var(--red-esigelec);
  margin-bottom: 0.5rem;
}

.info-section {
  border-top: 1px solid var(--gray-white-light);
  padding-top: 10px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-section h3 {
  margin: 0;
  color: var(--red-esigelec);
  font-size: 1em;
}

.mission-text {
  white-space: pre-wrap;
}

.review-comment {
  font-style: italic;
  color: var(--gray-dark);
}

.loading, .empty {
  color: var(--gray-dark);
  font-size: 0.9em;
}

.contacts-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.contact-card {
  background: var(--gray-light);
  border-radius: 8px;
  padding: 10px 12px;
}

.contact-name {
  margin-bottom: 4px;
}

.contact-detail a {
  color: var(--blue-esigelec);
}

.contact-hidden {
  font-style: italic;
  color: var(--gray-dark);
  margin: 0;
}
</style>
