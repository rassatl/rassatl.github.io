<script setup>
import { ref, onMounted, inject } from 'vue'
import { usePendingCompanies } from '../../../composables/usePendingCompanies.js'

const t = inject('t')
const props = defineProps({ pendingCompany: { type: Object, default: null } });
const { fetchContacts } = usePendingCompanies();

const emptyContact = () => ({ firstName: '', lastName: '', role: '', email: '', phone: '' });
const contacts = ref([emptyContact()]);

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Le contact est facultatif : un bloc entièrement vide est ignoré (le
// formulaire en affiche toujours un par défaut), seul un bloc entamé doit
// être complet. Renvoie null si un bloc est invalide, sinon la liste des
// contacts renseignés (éventuellement vide).
const validate = () => {
  const cleaned = [];
  for (const contact of contacts.value) {
    const firstName = normalizeText(contact.firstName, 100);
    const lastName = normalizeText(contact.lastName, 100);
    const role = normalizeText(contact.role, 150);
    const email = contact.email.trim();
    const phone = normalizeText(contact.phone ?? '', 30);
    if (!firstName && !lastName && !role && !email && !phone) continue;
    if (!firstName || !lastName || !role || !emailPattern.test(email)) {
      return null;
    }
    cleaned.push({ firstName, lastName, role, email, phone });
  }
  return cleaned;
};

const addContact = () => {
  contacts.value.push(emptyContact());
};
const removeContact = (index) => {
  if (contacts.value.length <= 1) return;
  contacts.value.splice(index, 1);
};

// En mode révision, on récupère les contacts déjà associés à cette
// proposition en attente plutôt que de partir d'un formulaire vide.
onMounted(async () => {
  if (!props.pendingCompany) return;
  const existingContacts = await fetchContacts('pendingCompanies', props.pendingCompany.id);
  if (existingContacts.length > 0) {
    contacts.value = existingContacts.map(({ firstName, lastName, role, email, phone }) => ({
      firstName, lastName, role, email, phone: phone ?? ''
    }));
  }
});

defineExpose({ validate });
</script>

<template>
  <p class="step-hint">{{ t('addCompanyForm.contactsHint') }}</p>
  <div v-for="(contact, index) in contacts" :key="index" class="contact-block">
    <div class="contact-block-header">
      <h3>{{ t('addCompanyForm.contactN') }} {{ index + 1 }}</h3>
      <button
        v-if="contacts.length > 1"
        type="button"
        class="remove-contact-button"
        @click="removeContact(index)"
      >{{ t('addCompanyForm.removeContact') }}</button>
    </div>
    <div class="form-group">
      <label :for="`contact-firstName-${index}`">{{ t('addCompanyForm.contactFirstName') }}</label>
      <input :id="`contact-firstName-${index}`" v-model="contact.firstName" maxlength="100" />
    </div>
    <div class="form-group">
      <label :for="`contact-lastName-${index}`">{{ t('addCompanyForm.contactLastName') }}</label>
      <input :id="`contact-lastName-${index}`" v-model="contact.lastName" maxlength="100" />
    </div>
    <div class="form-group">
      <label :for="`contact-role-${index}`">{{ t('addCompanyForm.contactRole') }}</label>
      <input :id="`contact-role-${index}`" v-model="contact.role" maxlength="150" />
    </div>
    <div class="form-group">
      <label :for="`contact-email-${index}`">{{ t('addCompanyForm.contactEmail') }}</label>
      <input :id="`contact-email-${index}`" v-model="contact.email" type="email" maxlength="200" />
    </div>
    <div class="form-group">
      <label :for="`contact-phone-${index}`">{{ t('addCompanyForm.contactPhone') }}</label>
      <input :id="`contact-phone-${index}`" v-model="contact.phone" type="tel" maxlength="30" />
    </div>
  </div>
  <button type="button" class="add-contact-button" @click="addContact">
    {{ t('addCompanyForm.addContact') }}
  </button>
  <p class="privacy-note">{{ t('addCompanyForm.contactsPrivacyNote') }}</p>
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

.contact-block {
  border: 1px solid var(--gray-white-light);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 14px;
}

.contact-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.contact-block-header h3 {
  margin: 0;
  font-size: 1em;
  color: var(--red-esigelec);
}

.remove-contact-button {
  background: none;
  border: none;
  color: var(--red-esigelec);
  font-size: 0.8em;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.add-contact-button {
  background: transparent;
  color: var(--red-esigelec);
  border: 2px dashed var(--red-esigelec);
  border-radius: 6px;
  padding: 8px;
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  margin-bottom: 10px;
}

.privacy-note {
  font-size: 0.75em;
  color: var(--gray-dark);
  font-style: italic;
  margin: 0;
}
</style>
