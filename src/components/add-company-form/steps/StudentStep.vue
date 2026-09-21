<script setup>
import { inject } from 'vue'
import { useAuth } from '../../../composables/useAuth.js'
import StudentEmailVerifier from '../../student/StudentEmailVerifier.vue'

const t = inject('t')
const { studentEmail } = useAuth()

// Choix de l'étudiant : afficher son email sur la fiche de l'entreprise.
// Privé par défaut, l'email ne sert alors qu'à savoir qui l'a ajoutée.
const visible = defineModel('visible', { default: false })

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

  <StudentEmailVerifier />
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

.visibility-choice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 0.9em;
  color: var(--gray-dark);
  cursor: pointer;
}

.visibility-choice small {
  display: block;
  font-size: 0.85em;
  font-style: italic;
}

.visibility-checkbox {
  margin-top: 3px;
  flex-shrink: 0;
}
</style>
