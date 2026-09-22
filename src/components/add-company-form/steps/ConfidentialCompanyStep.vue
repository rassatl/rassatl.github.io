<script setup>
import { inject, computed, ref } from 'vue'

// Étape 1 du formulaire confidentiel (visiteurs non connectés uniquement) :
// spécialité, pays et ville — volontairement les seules informations
// demandées, sans nom ni adresse détaillée. La position exacte (x/y) est
// pilotée par le parent et posée sur la carte (voir ConfidentialMiniMap.vue),
// pas saisie ici.

const speciality = defineModel('speciality', { type: String, default: '' })
const country = defineModel('country', { type: String, default: '' })
const city = defineModel('city', { type: String, default: '' })

const props = defineProps({
  x: { type: [Number, String], default: '' },
  y: { type: [Number, String], default: '' },
  countryList: { type: Array, required: true },
})

const t = inject('t')

const allowedSpecialities = new Set([
  'Développement Logiciel, Tests et Qualité',
  'IA & Big Data'
]);

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

// Passe à true dès qu'une tentative de validation a échoué, pour afficher
// les champs en erreur en rouge (voir computed ci-dessous) au lieu de
// laisser l'utilisateur deviner lesquels sont incomplets.
const attempted = ref(false);

const specialityInvalid = computed(() => attempted.value && !allowedSpecialities.has(speciality.value));
const countryInvalid = computed(() => attempted.value && !normalizeText(country.value, 100));
const cityInvalid = computed(() => attempted.value && !normalizeText(city.value, 100));

// Valide les champs de l'entreprise (hors vérification réseau des
// coordonnées, faite par le parent uniquement à la soumission finale).
// Retourne { data, error } : error vaut 'company' en cas d'échec, sinon null.
const validateFields = () => {
  attempted.value = true;
  const fields = {
    speciality: speciality.value,
    city: normalizeText(city.value, 100),
    country: normalizeText(country.value, 100),
  };
  const latitude = Number(props.x);
  const longitude = Number(props.y);

  if (!allowedSpecialities.has(fields.speciality) || !fields.city || !fields.country) {
    return { data: null, error: 'company' };
  }
  // props.x/y valent '' tant qu'aucun point n'a été placé sur la carte :
  // Number('') vaut 0, une coordonnée valide (Null Island) qui passerait
  // sinon la validation sans qu'un point ait réellement été posé.
  if (props.x === '' || props.y === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { data: null, error: 'company' };
  }

  return { data: { ...fields, x: latitude, y: longitude }, error: null };
};

defineExpose({ validateFields });
</script>

<template>
  <div class="form-group">
    <label for="speciality">{{ t('addCompanyForm.schoolSpeciality') }}</label>
    <select id="speciality" v-model="speciality" :class="{ invalid: specialityInvalid }">
      <option disabled value="">{{ t('addCompanyForm.selectSpeciality') }}</option>
      <option value="Développement Logiciel, Tests et Qualité">{{ t('addCompanyForm.dltq') }}</option>
      <option value="IA & Big Data">{{ t('addCompanyForm.iabd') }}</option>
    </select>
  </div>
  <div class="form-group">
    <label for="country">{{ t('addCompanyForm.companyState') }}</label>
    <select id="country" v-model="country" :class="{ invalid: countryInvalid }">
      <option disabled value="">{{ t('addCompanyForm.selectCompanyState') }}</option>
      <option v-for="[code, countryName] in countryList" :key="code" :value="countryName">
        {{ countryName }}
      </option>
    </select>
  </div>
  <div class="form-group">
    <label for="city">{{ t('addCompanyForm.companyCity') }}</label>
    <input id="city" v-model="city" maxlength="100" :placeholder="t('addCompanyForm.companyCityPlaceholder')" :class="{ invalid: cityInvalid }" />
  </div>
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

select {
  width: 90%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 2px solid var(--gray-white-light);
  border-radius: 6px;
  font-size: 14px;
  background-color: var(--white);
  transition: border 0.2s;
}

input.invalid,
select.invalid {
  border-color: var(--red-esigelec);
  background-color: #fdeeee;
}
</style>
