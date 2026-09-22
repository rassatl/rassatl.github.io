<script setup>
import { ref, watch, inject } from 'vue'
import { db } from '../../services/firebase'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import StarRating from '../common/StarRating.vue'
import StudentAccessNotice from '../student/StudentAccessNotice.vue'
import { useErrorLogs } from '../../composables/useErrorLogs.js'
import { useAuth } from '../../composables/useAuth.js'

const t = inject('t')
const props = defineProps({
  company: {
    type: Object,
    required: true
  }
})

// Une entreprise ajoutée de façon confidentielle n'a pas de nom : c'est ce
// qui distingue les deux formats d'affichage (voir AddCompanyForm.vue pour
// la même logique côté formulaire).
const isFullFormat = 'name' in props.company

const { logError } = useErrorLogs()
const { isAdmin, canViewContacts } = useAuth()
const contacts = ref([])
// Moyen de contact du formulaire confidentiel (email perso, email étudiant,
// WhatsApp, LinkedIn) : un seul document, jamais de sous-collection à
// parcourir comme pour les contacts du format complet.
const confidentialContact = ref(null)
// Email de l'étudiant qui a ajouté l'entreprise, lu dans la collection privée
// companyAuthors : seuls les admins y ont accès, les autres n'y touchent pas.
const privateAuthor = ref('')
const isLoadingContacts = ref(true)

// Les contacts ne sont lus que par un étudiant vérifié ou un admin : pour les
// autres cas, firestore.rules refuserait la requête (et chaque visiteur
// journaliserait une erreur pour rien), on ne la tente donc pas. Le format
// complet a une sous-collection contacts, le confidentiel une sous-collection
// confidentialContact (un seul document) : jamais les deux à la fois.
const fetchContacts = async (companyId, allowed) => {
  if (!companyId || !allowed) {
    contacts.value = []
    confidentialContact.value = null
    isLoadingContacts.value = false
    return
  }
  isLoadingContacts.value = true
  try {
    if (isFullFormat) {
      const snapshot = await getDocs(collection(db, 'companies', companyId, 'contacts'))
      contacts.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    } else {
      const snapshot = await getDocs(collection(db, 'companies', companyId, 'confidentialContact'))
      confidentialContact.value = snapshot.docs[0]?.data() ?? null
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des contacts :', error)
    logError(error, 'companyInformations:fetchContacts')
    contacts.value = []
    confidentialContact.value = null
  } finally {
    isLoadingContacts.value = false
  }
}

const fetchPrivateAuthor = async (companyId, admin) => {
  privateAuthor.value = ''
  if (!companyId || !admin) return
  try {
    const authorDoc = await getDoc(doc(db, 'companyAuthors', companyId))
    if (authorDoc.exists() && props.company?.id === companyId) privateAuthor.value = authorDoc.data().submittedBy
  } catch (error) {
    console.error("Erreur lors de la récupération de l'auteur de l'entreprise :", error)
    logError(error, 'companyInformations:fetchPrivateAuthor')
  }
}

watch(
  [() => props.company?.id, canViewContacts],
  ([companyId, allowed]) => fetchContacts(companyId, allowed),
  { immediate: true }
)
watch([() => props.company?.id, isAdmin], ([companyId, admin]) => fetchPrivateAuthor(companyId, admin), { immediate: true })
</script>

<template>
  <div class="details">
    <template v-if="isFullFormat">
      <h2>{{ company.name }}</h2>
      <p><strong>{{ t('companyInformations.specialityLabel') }} :</strong> {{ company.speciality }}</p>
      <p><strong>{{ t('companyInformations.addressLabel') }} :</strong> {{ company.address }}</p>
      <p><strong>{{ t('companyInformations.cityLabel') }} :</strong> {{ company.city }}</p>
      <p><strong>{{ t('companyInformations.countryLabel') }} :</strong> {{ company.country }}</p>
      <p v-if="company.pc"><strong>{{ t('companyInformations.pcLabel') }} :</strong> {{ company.pc }}</p>
      <p v-if="company.website">
        <strong>{{ t('companyInformations.websiteLabel') }} : </strong>
        <a :href="company.website" target="_blank" rel="noopener noreferrer">{{ company.website }}</a>
      </p>
    </template>
    <template v-else>
      <h2>{{ company.speciality }}</h2>
      <p><strong>{{ t('companyInformations.cityLabel') }} :</strong> {{ company.city }}</p>
      <p><strong>{{ t('companyInformations.countryLabel') }} :</strong> {{ company.country }}</p>
    </template>

    <p v-if="company.addedBy" class="added-by">
      <strong>{{ t('companyInformations.addedByLabel') }} :</strong> {{ company.addedBy }}
    </p>
    <p v-else-if="privateAuthor" class="added-by">
      <strong>{{ t('companyInformations.addedByPrivateLabel') }} :</strong> {{ privateAuthor }}
    </p>

    <section v-if="isFullFormat && company.mission" class="info-section">
      <h3>{{ t('companyInformations.missionTitle') }}</h3>
      <p class="mission-text">{{ company.mission }}</p>
    </section>

    <section v-if="isFullFormat && company.review?.rating" class="info-section">
      <h3>{{ t('companyInformations.reviewTitle') }}</h3>
      <StarRating :model-value="company.review.rating" readonly />
      <p v-if="company.review.comment" class="review-comment">{{ company.review.comment }}</p>
    </section>

    <section v-else-if="!isFullFormat && company.review" class="info-section">
      <h3>{{ t('companyInformations.reviewTitleConfidential') }}</h3>
      <StarRating v-if="company.review.rating" :model-value="company.review.rating" readonly />
      <p v-if="company.review.missionFeeling" class="review-text">
        <strong>{{ t('companyInformations.reviewMissionLabel') }} :</strong> {{ company.review.missionFeeling }}
      </p>
      <p v-if="company.review.countryFeeling" class="review-text">
        <strong>{{ t('companyInformations.reviewCountryLabel') }} :</strong> {{ company.review.countryFeeling }}
      </p>
      <p v-if="company.review.housingFeeling" class="review-text">
        <strong>{{ t('companyInformations.reviewHousingLabel') }} :</strong> {{ company.review.housingFeeling }}
      </p>
    </section>

    <section v-if="isFullFormat" class="info-section">
      <h3>{{ t('companyInformations.contactsTitle') }}</h3>
      <div v-if="!canViewContacts" class="contacts-locked">
        <p>{{ t('companyInformations.contactsLocked') }}</p>
        <StudentAccessNotice />
      </div>
      <p v-else-if="isLoadingContacts" class="loading">{{ t('companyInformations.loadingContacts') }}</p>
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

    <!-- Moyen de contact du formulaire confidentiel : au choix de l'étudiant
         qui a déposé le point, jamais vérifié, réservé aux mêmes conditions
         que les contacts du format complet. -->
    <section v-else class="info-section">
      <h3>{{ t('companyInformations.contactsTitle') }}</h3>
      <div v-if="!canViewContacts" class="contacts-locked">
        <p>{{ t('companyInformations.contactsLocked') }}</p>
        <StudentAccessNotice />
      </div>
      <p v-else-if="isLoadingContacts" class="loading">{{ t('companyInformations.loadingContacts') }}</p>
      <p v-else-if="!confidentialContact" class="empty">{{ t('companyInformations.noConfidentialContact') }}</p>
      <ul v-else class="contacts-list">
        <li class="contact-card">
          <p v-if="confidentialContact.personalEmail" class="contact-detail">
            <strong>{{ t('companyInformations.confidentialContactPersonalEmail') }} :</strong>
            <a :href="`mailto:${confidentialContact.personalEmail}`">{{ confidentialContact.personalEmail }}</a>
          </p>
          <p v-if="confidentialContact.schoolEmail" class="contact-detail">
            <strong>{{ t('companyInformations.confidentialContactSchoolEmail') }} :</strong>
            <a :href="`mailto:${confidentialContact.schoolEmail}`">{{ confidentialContact.schoolEmail }}</a>
          </p>
          <p v-if="confidentialContact.whatsapp" class="contact-detail">
            <strong>{{ t('companyInformations.confidentialContactWhatsapp') }} :</strong>
            <a :href="`https://wa.me/${confidentialContact.whatsapp.replace(/[^0-9]/g, '')}`" target="_blank" rel="noopener noreferrer">{{ confidentialContact.whatsapp }}</a>
          </p>
          <p v-if="confidentialContact.linkedin" class="contact-detail">
            <strong>{{ t('companyInformations.confidentialContactLinkedin') }} :</strong>
            <a :href="/^https?:\/\//i.test(confidentialContact.linkedin) ? confidentialContact.linkedin : `https://${confidentialContact.linkedin}`" target="_blank" rel="noopener noreferrer">{{ confidentialContact.linkedin }}</a>
          </p>
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

.added-by {
  font-size: 0.85em;
  color: var(--gray-dark);
}

.contacts-locked p {
  margin-bottom: 10px;
  font-size: 0.9em;
  color: var(--gray-dark);
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

.review-text {
  white-space: pre-wrap;
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
