<script setup>
import { inject } from 'vue'

// Étape 1 de l'assistant : identité et adresse de l'entreprise. Ne gère pas
// la carte (voir MiniMap.vue) mais lit x/y pour la validation finale, la
// position étant pilotée par le parent et partagée avec MiniMap.vue.

const speciality = defineModel('speciality', { default: '' })
const name = defineModel('name', { default: '' })
const website = defineModel('website', { default: '' })
const country = defineModel('country', { default: '' })
const address = defineModel('address', { default: '' })
const city = defineModel('city', { default: '' })
const pc = defineModel('pc', { default: '' })

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

// Le site web est facultatif ; s'il est renseigné, on le normalise (ajoute
// https:// si absent) et on vérifie qu'il s'agit d'une URL valide. new URL()
// seul ne suffit pas : certains moteurs (Chromium) acceptent des hôtes
// contenant des espaces sans lever d'erreur, d'où la vérification du nom
// d'hôte en plus.
const hostnamePattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const validateWebsite = () => {
  const raw = website.value.trim();
  if (!raw) return { value: '' };
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(normalized);
    if (!hostnamePattern.test(url.hostname)) return null;
    return { value: normalized };
  } catch {
    return null;
  }
};

// Valide les champs de l'entreprise (hors vérification réseau des
// coordonnées, faite par le parent uniquement à la soumission finale).
// Retourne { data, error } : error vaut 'company' ou 'website' en cas
// d'échec, sinon null.
const validateFields = () => {
  const fields = {
    speciality: speciality.value,
    name: normalizeText(name.value, 120),
    address: normalizeText(address.value, 200),
    city: normalizeText(city.value, 100),
    country: normalizeText(country.value, 100),
    pc: normalizeText(pc.value, 20)
  };
  const latitude = Number(props.x);
  const longitude = Number(props.y);

  if (!allowedSpecialities.has(fields.speciality) || Object.values(fields).some(value => !value)) {
    return { data: null, error: 'company' };
  }
  if (!/^[0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ\s-]{1,19}$/.test(fields.pc)) {
    return { data: null, error: 'company' };
  }
  // props.x/y valent '' tant qu'aucun point n'a été placé sur la carte :
  // Number('') vaut 0, une coordonnée valide (Null Island) qui passerait
  // sinon la validation sans qu'un point ait réellement été posé.
  if (props.x === '' || props.y === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { data: null, error: 'company' };
  }

  const validWebsite = validateWebsite();
  if (!validWebsite) {
    return { data: null, error: 'website' };
  }

  const company = { ...fields, x: latitude, y: longitude };
  if (validWebsite.value) {
    company.website = validWebsite.value;
  }
  return { data: company, error: null };
};

defineExpose({ validateFields });
</script>

<template>
  <div class="form-group">
    <label for="speciality">{{ t('addCompanyForm.schoolSpeciality') }}</label>
    <select id="speciality" v-model="speciality">
      <option disabled value="">{{ t('addCompanyForm.selectSpeciality') }}</option>
      <option value="Développement Logiciel, Tests et Qualité">{{ t('addCompanyForm.dltq') }}</option>
      <option value="IA & Big Data">{{ t('addCompanyForm.iabd') }}</option>
    </select>
  </div>
  <div class="form-group">
    <label for="name">{{ t('addCompanyForm.companyName') }}</label>
    <input id="name" v-model="name" maxlength="120" />
  </div>
  <div class="form-group">
    <label for="website">{{ t('addCompanyForm.companyWebsite') }}</label>
    <input id="website" v-model="website" type="text" maxlength="300" placeholder="https://..." />
  </div>
  <div class="form-group">
    <label for="country">{{ t('addCompanyForm.companyState') }}</label>
    <select id="country" v-model="country">
      <option disabled value="">{{ t('addCompanyForm.selectCompanyState') }}</option>
      <option v-for="[code, countryName] in countryList" :key="code" :value="countryName">
        {{ countryName }}
      </option>
    </select>
  </div>
  <div class="form-group">
    <label for="address">{{ t('addCompanyForm.companyAddress') }}</label>
    <input id="address" v-model="address" maxlength="200" />
  </div>
  <div class="form-group">
    <label for="city">{{ t('addCompanyForm.companyCity') }}</label>
    <input id="city" v-model="city" maxlength="100" />
  </div>
  <div class="form-group">
    <label for="pc">{{ t('addCompanyForm.companyPC') }}</label>
    <input id="pc" v-model="pc" maxlength="20" />
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
</style>
