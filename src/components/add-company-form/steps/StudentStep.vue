<script setup>
import { inject } from 'vue'
import { useAuth } from '../../../composables/useAuth.js'
import StudentAccessNotice from '../../student/StudentAccessNotice.vue'

const t = inject('t')
const { studentEmail } = useAuth()

// Choix de l'étudiant : afficher son email sur la fiche de l'entreprise.
// Privé par défaut si non renseigné, mais justement pas de défaut implicite
// ici : null tant qu'aucune des deux options n'a été cochée, pour forcer un
// choix explicite (voir validate() ci-dessous) plutôt que de laisser passer
// silencieusement l'option "Non" sans que l'étudiant l'ait vue. Sans objet
// si personne n'est connecté : l'ajout est alors totalement anonyme.
const visible = defineModel('visible', { default: null })

// Bloque le passage à l'étape suivante tant qu'aucun choix n'a été fait :
// certifie que l'étudiant a bien vu cette option (avantageuse pour lui,
// voir studentShowEmailHint), pas seulement qu'elle est restée à son défaut.
const validate = () => studentEmail.value ? visible.value === true || visible.value === false : true

defineExpose({ validate })
</script>

<template>
  <p class="step-hint">{{ t('addCompanyForm.studentHint') }}</p>

  <template v-if="studentEmail">
    <p class="privacy-note">{{ t('addCompanyForm.studentPrivacyNote') }}</p>

    <fieldset class="visibility-choice">
      <legend>
        {{ t('addCompanyForm.studentShowEmailLabel') }}
        <small>{{ t('addCompanyForm.studentShowEmailHint') }}</small>
      </legend>
      <label class="visibility-option">
        <input v-model="visible" type="radio" :value="true" name="student-visible" />
        {{ t('addCompanyForm.yes') }}
      </label>
      <label class="visibility-option">
        <input v-model="visible" type="radio" :value="false" name="student-visible" />
        {{ t('addCompanyForm.no') }}
      </label>
    </fieldset>

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
  border: 1px solid var(--gray-white-light);
  border-radius: 6px;
  padding: 10px 12px 14px 12px;
  margin: 0 0 14px 0;
}

.visibility-choice legend {
  font-size: 0.9em;
  color: var(--gray-dark);
  padding: 0 4px;
}

.visibility-choice small {
  display: block;
  font-size: 0.85em;
  font-style: italic;
}

.visibility-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  margin-right: 20px;
  font-size: 0.9em;
  color: var(--gray-dark);
  cursor: pointer;
}

.verified {
  color: var(--gray-dark);
}
</style>
