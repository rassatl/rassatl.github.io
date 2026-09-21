<script setup>
import { ref, inject } from 'vue'
import { useAuth } from '../../composables/useAuth.js'
import { useErrorLogs } from '../../composables/useErrorLogs.js'
import { isStudentEmail } from '../../utils/studentEmail.js'

const t = inject('t')
const props = defineProps({
  // Identifiant du champ email : deux vérificateurs peuvent coexister dans la
  // page (formulaire d'ajout, fiche d'entreprise), et un id doit rester unique.
  inputId: { type: String, default: 'student-email' },
  // Fiche à rouvrir une fois l'email vérifié ({ companyId }) ; sans elle, le
  // lien ramène au formulaire d'ajout d'entreprise.
  returnTo: { type: Object, default: null },
})
const { studentEmail, sendStudentLink, logout } = useAuth()
const { logError } = useErrorLogs()

const email = ref('')
const status = ref('idle') // 'idle' | 'sending' | 'sent'
const error = ref('')

const sendLink = async () => {
  if (status.value === 'sending') return
  error.value = ''
  if (!isStudentEmail(email.value)) {
    error.value = t('addCompanyForm.studentEmailInvalid')
    return
  }
  status.value = 'sending'
  try {
    await sendStudentLink(email.value, props.returnTo)
    status.value = 'sent'
  } catch (e) {
    console.error("Erreur lors de l'envoi du lien de vérification : ", e)
    logError(e, 'studentEmailVerifier:sendLink')
    error.value = t('addCompanyForm.studentLinkError')
    status.value = 'idle'
  }
}

const changeEmail = async () => {
  await logout()
  status.value = 'idle'
  email.value = ''
  error.value = ''
}
</script>

<template>
  <div v-if="studentEmail" class="verified">
    <p>✔ {{ t('addCompanyForm.studentVerified') }} <strong>{{ studentEmail }}</strong></p>
    <button type="button" class="link-button" @click="changeEmail">{{ t('addCompanyForm.studentChangeEmail') }}</button>
  </div>

  <template v-else>
    <div class="form-group">
      <label :for="inputId">{{ t('addCompanyForm.studentEmailLabel') }}</label>
      <input
        :id="inputId"
        v-model="email"
        type="email"
        maxlength="200"
        autocomplete="email"
        :placeholder="t('addCompanyForm.studentEmailPlaceholder')"
        @keydown.enter.prevent="sendLink"
      />
    </div>
    <p v-if="error" class="student-error">{{ error }}</p>
    <!-- Le mail part de l'adresse générique de Firebase : les messageries
         d'école le classent presque toujours en indésirable, voire en
         quarantaine. On prévient avant l'envoi comme après, pour que l'étudiant
         sache où le chercher au lieu de croire qu'il n'est jamais parti. -->
    <p class="spam-warning" role="note">⚠ {{ t('addCompanyForm.studentSpamWarning') }}</p>
    <p v-if="status === 'sent'" class="link-sent">
      {{ t('addCompanyForm.studentLinkSentTo') }} <strong>{{ email.trim() }}</strong>.
      {{ t('addCompanyForm.studentLinkSentHint') }}
    </p>
    <button type="button" class="send-button" :disabled="status === 'sending'" @click="sendLink">
      {{ status === 'sent' ? t('addCompanyForm.studentResendLink') : t('addCompanyForm.studentSendLink') }}
    </button>
  </template>
</template>

<style scoped>
.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: var(--gray-dark);
}

input {
  width: 90%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 2px solid var(--gray-white-light);
  border-radius: 6px;
  font-size: 14px;
  transition: border 0.2s;
  background-color: var(--white);
  color: var(--gray-dark);
  font-family: inherit;
}

input:focus {
  border-color: var(--red-esigelec);
  outline: none;
}

.student-error {
  color: var(--red-esigelec);
  font-size: 0.85em;
  margin: 0 0 10px 0;
}

.spam-warning {
  font-size: 0.85em;
  color: var(--gray-dark);
  background: var(--gray-white-light);
  border-left: 4px solid var(--red-esigelec);
  border-radius: 4px;
  padding: 8px 10px;
  margin: 0 0 10px 0;
}

.link-sent {
  font-size: 0.85em;
  color: var(--gray-dark);
  margin: 0 0 10px 0;
}

.send-button {
  background: transparent;
  color: var(--red-esigelec);
  border: 2px solid var(--red-esigelec);
  border-radius: 6px;
  padding: 8px;
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  margin-bottom: 10px;
}

.send-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.verified {
  color: var(--gray-dark);
}

.verified p {
  margin: 0 0 6px 0;
}

.link-button {
  background: none;
  border: none;
  color: var(--red-esigelec);
  font-size: 0.8em;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
</style>
