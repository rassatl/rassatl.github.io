<script setup>
import { inject } from 'vue'
import { useAuth } from '../../../composables/useAuth.js'
import StudentAccessNotice from '../../student/StudentAccessNotice.vue'

const t = inject('t')
const { studentEmail } = useAuth()

// Choix de l'étudiant : afficher son email sur la fiche de l'entreprise.
// Privé par défaut, l'email ne sert alors qu'à savoir qui l'a ajoutée. Sans
// objet si personne n'est connecté : l'ajout est alors totalement anonyme.
const visible = defineModel('visible', { type: Boolean, default: false })
</script>

<template>
  <p class="step-hint">{{ t('addCompanyForm.studentHint') }}</p>

  <template v-if="studentEmail">
    <p class="privacy-note">{{ t('addCompanyForm.studentPrivacyNote') }}</p>

    <label class="visibility-choice">
      <input v-model="visible" type="checkbox" class="visibility-checkbox" />
      <span>
        {{ t('addCompanyForm.studentShowEmailLabel') }}
        <small>{{ t('addCompanyForm.studentShowEmailHint') }}</small>
      </span>
    </label>

    <p class="verified">✔ {{ t('addCompanyForm.studentVerified') }} <strong>{{ studentEmail }}</strong></p>
  </template>
  <StudentAccessNotice v-else />
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

.verified {
  color: var(--gray-dark);
}
</style>
