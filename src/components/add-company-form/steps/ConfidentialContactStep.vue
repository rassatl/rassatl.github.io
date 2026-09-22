<script setup>
import { reactive, inject, onMounted } from 'vue'
import { usePendingCompanies } from '../../../composables/usePendingCompanies.js'

// Moyen de contact du formulaire confidentiel : au choix de l'étudiant qui
// dépose le point, pour qu'un autre étudiant intéressé puisse le joindre
// directement. Entièrement facultatif (y compris de ne rien remplir du
// tout) : rien n'est vérifié (ni format, ni identité) non plus.

const t = inject('t')
const props = defineProps({ pendingCompany: { type: Object, default: null } });
const { fetchConfidentialContact } = usePendingCompanies();

const contact = reactive({
  personalEmail: '',
  schoolEmail: '',
  whatsapp: '',
  linkedin: '',
});

// En mode révision, on récupère le moyen de contact déjà associé à cette
// proposition en attente plutôt que de partir d'un formulaire vide.
onMounted(async () => {
  if (!props.pendingCompany) return;
  const [existing] = await fetchConfidentialContact('pendingCompanies', props.pendingCompany.id);
  if (existing) {
    contact.personalEmail = existing.personalEmail ?? '';
    contact.schoolEmail = existing.schoolEmail ?? '';
    contact.whatsapp = existing.whatsapp ?? '';
    contact.linkedin = existing.linkedin ?? '';
  }
});

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

// Ni format ni identité vérifiés, et rien n'est obligatoire : validate() ne
// fait que garder les champs remplis, normalisés (un objet vide si aucun ne
// l'est), sans jamais bloquer la suite.
const validate = () => {
  const cleaned = {
    personalEmail: normalizeText(contact.personalEmail, 200),
    schoolEmail: normalizeText(contact.schoolEmail, 200),
    whatsapp: normalizeText(contact.whatsapp, 50),
    linkedin: normalizeText(contact.linkedin, 300),
  };
  return Object.fromEntries(Object.entries(cleaned).filter(([, value]) => value !== ''));
};

defineExpose({ validate });
</script>

<template>
  <p class="step-hint">{{ t('addCompanyForm.confidentialContactHint') }}</p>
  <div class="form-group">
    <label for="contact-personal-email">{{ t('addCompanyForm.confidentialContactPersonalEmail') }}</label>
    <input id="contact-personal-email" v-model="contact.personalEmail" type="text" maxlength="200" />
  </div>
  <div class="form-group">
    <label for="contact-school-email">{{ t('addCompanyForm.confidentialContactSchoolEmail') }}</label>
    <input id="contact-school-email" v-model="contact.schoolEmail" type="text" maxlength="200" placeholder="prenom.nom@groupe-esigelec.org" />
  </div>
  <div class="form-group">
    <label for="contact-whatsapp">{{ t('addCompanyForm.confidentialContactWhatsapp') }}</label>
    <input id="contact-whatsapp" v-model="contact.whatsapp" type="text" maxlength="50" />
  </div>
  <div class="form-group">
    <label for="contact-linkedin">{{ t('addCompanyForm.confidentialContactLinkedin') }}</label>
    <input id="contact-linkedin" v-model="contact.linkedin" type="text" maxlength="300" placeholder="https://www.linkedin.com/in/..." />
  </div>
</template>

<style scoped>
.step-hint {
  font-size: 0.85em;
  color: var(--gray-dark);
  margin: 0 0 12px 0;
}

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

.field-error {
  margin: 6px 0 0 0;
  font-size: 0.8em;
  color: var(--red-esigelec);
  font-weight: 600;
}
</style>
