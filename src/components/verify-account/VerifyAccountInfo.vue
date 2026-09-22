<script setup>
import { ref, onMounted, inject } from 'vue'
import { db } from '../../services/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useErrorLogs } from '../../composables/useErrorLogs.js'

const t = inject('t')
const { logError } = useErrorLogs()
const props = defineProps({
  uid: String,
  token: String,
})

// loading -> done | already-verified | invalid | error
const status = ref('loading')

const studentAccountRef = doc(db, 'studentAccounts', props.uid)
const verificationTokenRef = doc(db, 'emailVerificationTokens', props.uid)

// Pas besoin d'être connecté : la connaissance du jeton (reçu par email)
// suffit à prouver qu'on est le destinataire, comme pour hideToken (voir
// HideContactInfo.vue). Le jeton lui-même n'est jamais lisible (voir
// firestore.rules) : cette page ne fait que tenter les deux écritures qui le
// vérifient, dans cet ordre précis (studentAccounts se fie à
// emailVerificationTokens.verified, qui doit donc déjà être passé à true).
onMounted(async () => {
  try {
    const accountSnap = await getDoc(studentAccountRef)
    if (!accountSnap.exists()) {
      status.value = 'invalid'
      return
    }
    if (accountSnap.data().emailVerified) {
      status.value = 'already-verified'
      return
    }

    await updateDoc(verificationTokenRef, { verified: true, guess: props.token })
    await updateDoc(studentAccountRef, { emailVerified: true })
    status.value = 'done'
  } catch (e) {
    // Un jeton erroné (ou déjà utilisé entre l'instant du getDoc ci-dessus et
    // la tentative d'écriture) se traduit par un refus Firestore, attendu ici
    // et pas une anomalie technique : pas la peine de le journaliser.
    if (e.code === 'permission-denied') {
      status.value = 'invalid'
      return
    }
    console.error('Erreur lors de la vérification du compte :', e)
    logError(e, 'verifyAccountInfo:load')
    status.value = 'error'
  }
})
</script>

<template>
  <div class="verify-account-page">
    <div class="verify-account-card">
      <h1>{{ t('verifyAccount.title') }}</h1>

      <p v-if="status === 'loading'">{{ t('verifyAccount.loading') }}</p>
      <p v-else-if="status === 'done'">{{ t('verifyAccount.done') }}</p>
      <p v-else-if="status === 'already-verified'">{{ t('verifyAccount.alreadyVerified') }}</p>
      <p v-else-if="status === 'invalid'">{{ t('verifyAccount.invalid') }}</p>
      <p v-else-if="status === 'error'">{{ t('verifyAccount.error') }}</p>

      <a class="back-link" href="/">{{ t('verifyAccount.backToSite') }}</a>
    </div>
  </div>
</template>

<style scoped>
.verify-account-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}
.verify-account-card {
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
.back-link {
  display: inline-block;
  margin-top: 20px;
  color: var(--red-esigelec);
}
</style>
