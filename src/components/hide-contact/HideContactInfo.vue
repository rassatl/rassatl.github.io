<script setup>
import { ref, onMounted, inject } from 'vue'
import { db } from '../../services/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useErrorLogs } from '../../composables/useErrorLogs.js'

const t = inject('t')
const { logError } = useErrorLogs()
const props = defineProps({
  companyId: String,
  contactId: String,
  token: String,
})

// loading -> ready | already-hidden | invalid | error ; ready -> done | error
const status = ref('loading')
const contact = ref(null)
const isSubmitting = ref(false)

const contactRef = doc(db, 'companies', props.companyId, 'contacts', props.contactId)

onMounted(async () => {
  try {
    const snap = await getDoc(contactRef)
    if (!snap.exists() || snap.data().hideToken !== props.token) {
      status.value = 'invalid'
      return
    }
    if (snap.data().hidden) {
      status.value = 'already-hidden'
      return
    }
    contact.value = snap.data()
    status.value = 'ready'
  } catch (e) {
    console.error('Erreur lors de la vérification du lien :', e)
    logError(e, 'hideContactInfo:load')
    status.value = 'error'
  }
})

const confirmHide = async () => {
  if (isSubmitting.value || !contact.value) return
  isSubmitting.value = true
  try {
    await updateDoc(contactRef, {
      firstName: '',
      lastName: '',
      role: '',
      email: '',
      phone: '',
      hidden: true,
      hideToken: contact.value.hideToken,
    })
    status.value = 'done'
  } catch (e) {
    console.error('Erreur lors du masquage des informations :', e)
    logError(e, 'hideContactInfo:confirmHide')
    status.value = 'error'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="hide-contact-page">
    <div class="hide-contact-card">
      <h1>{{ t('hideContact.title') }}</h1>

      <p v-if="status === 'loading'">{{ t('hideContact.loading') }}</p>

      <template v-else-if="status === 'ready'">
        <p>{{ t('hideContact.intro') }} <strong>{{ contact.firstName }} {{ contact.lastName }}</strong>.</p>
        <ul class="info-list">
          <li>{{ contact.role }}</li>
          <li>{{ contact.email }}</li>
          <li v-if="contact.phone">{{ contact.phone }}</li>
        </ul>
        <p>{{ t('hideContact.warning') }}</p>
        <button type="button" class="hide-button" :disabled="isSubmitting" @click="confirmHide">
          {{ t('hideContact.confirmButton') }}
        </button>
      </template>

      <p v-else-if="status === 'already-hidden'">{{ t('hideContact.alreadyHidden') }}</p>
      <p v-else-if="status === 'done'">{{ t('hideContact.done') }}</p>
      <p v-else-if="status === 'invalid'">{{ t('hideContact.invalid') }}</p>
      <p v-else-if="status === 'error'">{{ t('hideContact.error') }}</p>

      <a class="back-link" href="/">{{ t('hideContact.backToSite') }}</a>
    </div>
  </div>
</template>

<style scoped>
.hide-contact-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}
.hide-contact-card {
  background: var(--white);
  color: var(--black);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 32px;
  max-width: 480px;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}
h1 {
  color: var(--red-esigelec);
  font-size: 1.5rem;
  margin-bottom: 1rem;
}
.info-list {
  list-style: none;
  padding: 0;
  margin: 12px 0;
  color: var(--gray-dark);
}
.hide-button {
  background-color: var(--red-esigelec);
  color: var(--white);
  border: none;
  border-radius: 6px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 12px;
}
.hide-button:hover {
  background-color: var(--red-btn-hover);
}
.back-link {
  display: inline-block;
  margin-top: 20px;
  color: var(--red-esigelec);
}
</style>
