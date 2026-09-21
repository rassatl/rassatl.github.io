<script setup>
import { ref, inject } from 'vue'
import { useAuth } from '../../../composables/useAuth.js'
import { useErrorLogs } from '../../../composables/useErrorLogs.js'
import { isStudentEmail } from '../../../utils/studentEmail.js'

const t = inject('t')
const { studentEmail, sendStudentLink, logout } = useAuth()
const { logError } = useErrorLogs()

// Choix de l'étudiant : afficher son email sur la fiche de l'entreprise.
// Privé par défaut, l'email ne sert alors qu'à savoir qui l'a ajoutée.
const visible = defineModel('visible', { default: false })

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
    await sendStudentLink(email.value)
    status.value = 'sent'
  } catch (e) {
    console.error("Erreur lors de l'envoi du lien de vérification : ", e)
    logError(e, 'addCompanyForm:studentLink')
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

// L'étape est valide dès que l'email étudiant est vérifié : la vérification
// elle-même se fait en dehors du formulaire, dans le lien reçu par email.
const validate = () => !!studentEmail.value

defineExpose({ validate })
</script>

<template>
  <p class="step-hint">{{ t('addCompanyForm.studentHint') }}</p>
  <p class="privacy-note">{{ t('addCompanyForm.studentPrivacyNote') }}</p>

  <label class="visibility-choice">
    <input v-model="visible" type="checkbox" class="visibility-checkbox" />
    <span>
      {{ t('addCompanyForm.studentShowEmailLabel') }}
      <small>{{ t('addCompanyForm.studentShowEmailHint') }}</small>
    </span>
  </label>

  <div v-if="studentEmail" class="verified">
    <p>✔ {{ t('addCompanyForm.studentVerified') }} <strong>{{ studentEmail }}</strong></p>
    <button type="button" class="link-button" @click="changeEmail">{{ t('addCompanyForm.studentChangeEmail') }}</button>
  </div>

  <template v-else>
    <div class="form-group">
      <label for="student-email">{{ t('addCompanyForm.studentEmailLabel') }}</label>
      <input
        id="student-email"
        v-model="email"
        type="email"
        maxlength="200"
        autocomplete="email"
        :placeholder="t('addCompanyForm.studentEmailPlaceholder')"
        @keydown.enter.prevent="sendLink"
      />
    </div>
    <p v-if="error" class="student-error">{{ error }}</p>
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
.step-hint {
  font-size: 0.85em;
  color: var(--gray-dark);
  margin: 0 0 8px 0;
}

.privacy-note {
  font-size: 0.85em;
  color: var(--gray-dark);
  font-style: italic;
  margin: 0 0 14px 0;
}

.form-group {
  margin-bottom: 15px;
}

.visibility-choice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
  font-weight: normal;
  font-size: 0.9em;
  cursor: pointer;
}

.visibility-choice small {
  display: block;
  font-size: 0.85em;
  font-style: italic;
}

.visibility-checkbox {
  width: auto;
  margin-top: 3px;
  flex-shrink: 0;
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
