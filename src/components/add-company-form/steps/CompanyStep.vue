<script setup>
import { inject, ref, watch, computed } from 'vue'

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

const stripAccents = (value) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Saisie de l'adresse en deux modes au choix : un champ unique "adresse
// complète" (plus rapide à coller depuis Google Maps par ex.) ou les champs
// détaillés séparés. Les deux alimentent les mêmes address/city/pc/country.
// En mode révision (proposition déjà pré-remplie), on démarre sur les champs
// détaillés pour ne pas masquer les données déjà présentes.
const addressMode = ref(address.value ? 'fields' : 'full');
const fullAddress = ref('');

// La ville et le code postal peuvent être dans le même segment, dans les
// deux ordres ("Casablanca 20250" ou "20250 Casablanca") : on repère le
// code postal comme le token contenant un chiffre, le reste forme la ville.
const parseCityAndPc = (segment) => {
  const tokens = segment.split(/\s+/).filter(Boolean);
  const pcIndex = tokens.findIndex(token => /\d/.test(token));
  if (pcIndex === -1) return { city: segment, pc: '' };
  return {
    city: tokens.filter((_, i) => i !== pcIndex).join(' '),
    pc: tokens[pcIndex],
  };
};

// Retrouve le pays officiel correspondant dans la liste (comparaison sans
// accents/casse, avec repli sur une correspondance partielle pour accepter
// un nom court comme "Maroc" face à un nom officiel plus long).
const matchCountry = (rawCountry) => {
  const normalized = stripAccents(rawCountry);
  if (!normalized) return '';
  const exact = props.countryList.find(([, name]) => stripAccents(name) === normalized);
  if (exact) return exact[1];
  const partial = props.countryList.find(([, name]) => {
    const normalizedName = stripAccents(name);
    return normalizedName.includes(normalized) || normalized.includes(normalizedName);
  });
  return partial ? partial[1] : rawCountry;
};

// Découpe "adresse, ville cp, pays" (ou "adresse, cp ville, pays") et
// répercute le résultat sur les champs détaillés existants.
watch(fullAddress, (value) => {
  const parts = value.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return;

  if (parts.length >= 3) {
    country.value = matchCountry(parts[parts.length - 1]);
    const { city: parsedCity, pc: parsedPc } = parseCityAndPc(parts[parts.length - 2]);
    city.value = parsedCity;
    pc.value = parsedPc;
    address.value = parts.slice(0, parts.length - 2).join(', ');
  } else if (parts.length === 2) {
    const { city: parsedCity, pc: parsedPc } = parseCityAndPc(parts[1]);
    city.value = parsedCity;
    pc.value = parsedPc;
    address.value = parts[0];
  } else {
    address.value = parts[0];
  }
});

// Bascule entre les deux modes de saisie. Ne reconstitue pas l'un depuis
// l'autre : chaque champ garde son propre contenu tel quel entre deux
// bascules, sans pré-remplissage automatique.
const switchAddressMode = (mode) => {
  addressMode.value = mode;
};

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

// Passe à true dès qu'une tentative de validation a échoué, pour afficher
// les champs en erreur en rouge (voir computed ci-dessous) au lieu de
// laisser l'utilisateur deviner lesquels sont incomplets.
const attempted = ref(false);

const pcPattern = /^[0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ\s-]{1,19}$/;

const specialityInvalid = computed(() => attempted.value && !allowedSpecialities.has(speciality.value));
const nameInvalid = computed(() => attempted.value && !normalizeText(name.value, 120));
const countryInvalid = computed(() => attempted.value && !normalizeText(country.value, 100));
const addressInvalid = computed(() => attempted.value && !normalizeText(address.value, 200));
const cityInvalid = computed(() => attempted.value && !normalizeText(city.value, 100));
// Le code postal est facultatif : beaucoup d'entreprises hors de France
// n'en ont pas d'équivalent fiable, ou une adresse collée telle quelle ne
// l'inclut simplement pas (voir parseCityAndPc ci-dessus). On ne le
// signale donc en erreur que s'il est rempli avec un format invalide.
const pcInvalid = computed(() => {
  if (!attempted.value) return false;
  const value = normalizeText(pc.value, 20);
  return value !== '' && !pcPattern.test(value);
});
// En mode "adresse complète", on ne montre pas les champs détaillés : le
// champ unique est marqué en erreur si l'un des champs qu'il alimente
// est encore incomplet.
const fullAddressInvalid = computed(() => attempted.value && (addressInvalid.value || cityInvalid.value || pcInvalid.value));
const websiteInvalid = computed(() => attempted.value && !validateWebsite());

// Valide les champs de l'entreprise (hors vérification réseau des
// coordonnées, faite par le parent uniquement à la soumission finale).
// Retourne { data, error } : error vaut 'company' ou 'website' en cas
// d'échec, sinon null.
const validateFields = () => {
  attempted.value = true;
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

  // pc est volontairement exclu : facultatif (voir pcInvalid ci-dessus).
  const requiredValues = [fields.name, fields.address, fields.city, fields.country];
  if (!allowedSpecialities.has(fields.speciality) || requiredValues.some(value => !value)) {
    return { data: null, error: 'company' };
  }
  if (fields.pc && !pcPattern.test(fields.pc)) {
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
    <select id="speciality" v-model="speciality" :class="{ invalid: specialityInvalid }">
      <option disabled value="">{{ t('addCompanyForm.selectSpeciality') }}</option>
      <option value="Développement Logiciel, Tests et Qualité">{{ t('addCompanyForm.dltq') }}</option>
      <option value="IA & Big Data">{{ t('addCompanyForm.iabd') }}</option>
    </select>
  </div>
  <div class="form-group">
    <label for="name">{{ t('addCompanyForm.companyName') }}</label>
    <input id="name" v-model="name" maxlength="120" :class="{ invalid: nameInvalid }" />
  </div>
  <div class="form-group">
    <label for="website">{{ t('addCompanyForm.companyWebsite') }}</label>
    <input id="website" v-model="website" type="text" maxlength="300" placeholder="https://..." :class="{ invalid: websiteInvalid }" />
    <p v-if="websiteInvalid" class="field-error">{{ t('addCompanyForm.stepErrorWebsite') }}</p>
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
  <div class="address-mode-tabs" role="tablist">
    <button
      type="button"
      role="tab"
      :aria-selected="addressMode === 'full'"
      :class="{ active: addressMode === 'full' }"
      @click="switchAddressMode('full')"
    >{{ t('addCompanyForm.addressModeFull') }}</button>
    <button
      type="button"
      role="tab"
      :aria-selected="addressMode === 'fields'"
      :class="{ active: addressMode === 'fields' }"
      @click="switchAddressMode('fields')"
    >{{ t('addCompanyForm.addressModeFields') }}</button>
  </div>

  <div v-if="addressMode === 'full'" class="form-group">
    <label for="fullAddress">{{ t('addCompanyForm.fullAddress') }}</label>
    <input id="fullAddress" v-model="fullAddress" maxlength="300" :placeholder="t('addCompanyForm.fullAddressPlaceholder')" :class="{ invalid: fullAddressInvalid }" />
  </div>

  <template v-else>
    <div class="form-group">
      <label for="address">{{ t('addCompanyForm.companyAddress') }}</label>
      <input id="address" v-model="address" maxlength="200" :class="{ invalid: addressInvalid }" />
    </div>
    <div class="form-group">
      <label for="city">{{ t('addCompanyForm.companyCity') }}</label>
      <input id="city" v-model="city" maxlength="100" :class="{ invalid: cityInvalid }" />
    </div>
    <div class="form-group">
      <label for="pc">{{ t('addCompanyForm.companyPC') }} ({{ t('addCompanyForm.optional') }})</label>
      <input id="pc" v-model="pc" maxlength="20" :class="{ invalid: pcInvalid }" />
    </div>
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

.address-mode-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  background-color: var(--gray-white-light);
  border-radius: 6px;
  padding: 3px;
}

.address-mode-tabs button {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 10px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-dark);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.address-mode-tabs button.active {
  background-color: var(--red-esigelec);
  color: var(--white);
}

.field-hint {
  margin: 6px 0 0 0;
  font-size: 0.8em;
  color: var(--gray-dark);
}

input.invalid,
select.invalid {
  border-color: var(--red-esigelec);
  background-color: #fdeeee;
}

.field-error {
  margin: 6px 0 0 0;
  font-size: 0.8em;
  color: var(--red-esigelec);
  font-weight: 600;
}
</style>
