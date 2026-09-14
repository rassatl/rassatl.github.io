<script setup>
import { ref, reactive, watch, onMounted, inject, computed } from 'vue';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder';

import { getCountryList } from '../countries.js'
import { iconForSpeciality } from '../mapIcons';
import { useAuth } from '../useAuth.js'
import { usePendingCompanies } from '../usePendingCompanies.js'
import StarRating from './StarRating.vue'

const t = inject('t')
const countryList = ref([]);
const { isAdmin } = useAuth();
const { submitPending, approve, addCompanyDirectly, reject: rejectPending, fetchContacts } = usePendingCompanies();

// Quand une proposition en attente est fournie, le formulaire passe en mode
// "révision" : il est pré-rempli et permet de la modifier avant de valider
// ou de la refuser, au lieu de créer une nouvelle soumission.
const props = defineProps({ pendingCompany: { type: Object, default: null } });

const emit = defineEmits(['refresh', 'close']);

// --- Étape 1 : entreprise + emplacement ---------------------------------
const speciality = ref(props.pendingCompany?.speciality ?? '');
const name = ref(props.pendingCompany?.name ?? '');
const address = ref(props.pendingCompany?.address ?? '');
const city = ref(props.pendingCompany?.city ?? '');
const pc = ref(props.pendingCompany?.pc ?? '');
const country = ref(props.pendingCompany?.country ?? '');
const x = ref(props.pendingCompany?.x ?? '');
const y = ref(props.pendingCompany?.y ?? '');

// --- Étape 2 : contact(s) -------------------------------------------------
const emptyContact = () => ({ firstName: '', lastName: '', role: '', email: '', phone: '' });
const contacts = ref([emptyContact()]);

// --- Étape 3 : mission ----------------------------------------------------
const mission = ref(props.pendingCompany?.mission ?? '');

// --- Étape 4 : avis ---------------------------------------------------
const review = reactive({
  rating: props.pendingCompany?.review?.rating ?? 0,
  comment: props.pendingCompany?.review?.comment ?? '',
});

const isLoading = ref(false);
const submissionDone = ref(false);
const currentStep = ref(1);
const totalSteps = 4;
const stepError = ref('');

const stepLabels = computed(() => [
  t('addCompanyForm.step1Label'),
  t('addCompanyForm.step2Label'),
  t('addCompanyForm.step3Label'),
  t('addCompanyForm.step4Label'),
]);

const allowedSpecialities = new Set([
  'Développement Logiciel, Tests et Qualité',
  'IA & Big Data'
]);

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateCompany = () => {
  const fields = {
    speciality: speciality.value,
    name: normalizeText(name.value, 120),
    address: normalizeText(address.value, 200),
    city: normalizeText(city.value, 100),
    country: normalizeText(country.value, 100),
    pc: normalizeText(pc.value, 20)
  };
  const latitude = Number(x.value);
  const longitude = Number(y.value);

  if (!allowedSpecialities.has(fields.speciality) || Object.values(fields).some(value => !value)) {
    return null;
  }
  if (!/^[0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ\s-]{1,19}$/.test(fields.pc)) {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { ...fields, x: latitude, y: longitude };
};

const validateContacts = () => {
  if (contacts.value.length === 0) return null;
  const cleaned = [];
  for (const contact of contacts.value) {
    const firstName = normalizeText(contact.firstName, 100);
    const lastName = normalizeText(contact.lastName, 100);
    const role = normalizeText(contact.role, 150);
    const email = contact.email.trim();
    const phone = normalizeText(contact.phone ?? '', 30);
    if (!firstName || !lastName || !role || !emailPattern.test(email)) {
      return null;
    }
    cleaned.push({ firstName, lastName, role, email, phone });
  }
  return cleaned;
};

const validateMission = () => {
  const cleaned = normalizeText(mission.value, 1000);
  return cleaned ? cleaned : null;
};

// L'avis est facultatif : sans note ni commentaire, l'étape est simplement
// ignorée. Un commentaire sans note n'a pas de sens et est donc refusé.
const validateReview = () => {
  const comment = normalizeText(review.comment, 500);
  if (!review.rating && !comment) return { skipped: true };
  if (!review.rating) return null;
  return { skipped: false, rating: review.rating, comment };
};

let map = null;
let marker = null;
const mapContainer = ref(null);
const isPinPlaced = ref(false);
let addressDebounceTimeout = null;

// Pose ou déplace le repère sur la carte d'aperçu et synchronise les
// coordonnées du formulaire. Utilisé aussi bien par le géocodage
// automatique que par un ajustement manuel (glisser ou clic sur la carte).
const placeMarker = (latlng, { recenter = false } = {}) => {
  if (!marker) {
    marker = L.marker(latlng, { icon: iconForSpeciality(speciality.value), draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      x.value = pos.lat;
      y.value = pos.lng;
    });
  } else {
    marker.setLatLng(latlng);
  }

  isPinPlaced.value = true;
  x.value = latlng.lat;
  y.value = latlng.lng;

  if (recenter) {
    map.setView(latlng, 15);
  }
};

// Garde la couleur du repère cohérente avec la spécialité choisie.
watch(speciality, (newSpeciality) => {
  if (marker) {
    marker.setIcon(iconForSpeciality(newSpeciality));
  }
});

// La mini-carte est cachée (v-show) sur les étapes 2 à 4 : Leaflet calcule
// mal ses tuiles pendant qu'un conteneur est en display:none, il faut donc
// recalculer sa taille à chaque retour sur l'étape 1.
watch(currentStep, (step) => {
  if (step === 1 && map) {
    setTimeout(() => map.invalidateSize(), 0);
  }
});

onMounted(async () => {
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419],
    zoom: 5,
    minZoom: 3,
    maxBounds: [[-90, -180], [90, 180]],
    worldCopyJump: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Permet à l'utilisateur d'ajuster ou de placer le point manuellement
  // en cliquant directement sur la carte d'aperçu.
  map.on('click', (e) => placeMarker(e.latlng));

  // En mode révision, on affiche directement la position déjà soumise
  // plutôt que de relancer une recherche d'adresse, et on récupère les
  // contacts déjà associés à cette proposition.
  if (props.pendingCompany) {
    placeMarker(L.latLng(props.pendingCompany.x, props.pendingCompany.y), { recenter: true });
    const existingContacts = await fetchContacts('pendingCompanies', props.pendingCompany.id);
    if (existingContacts.length > 0) {
      contacts.value = existingContacts.map(({ firstName, lastName, role, email, phone }) => ({
        firstName, lastName, role, email, phone: phone ?? ''
      }));
    }
  }

  // Récupération de la liste des pays depuis le fichier countries.js
  const lang = localStorage.getItem('lang') || 'fr';
  countryList.value = Object.entries(getCountryList(lang));
});

// Une fois l'adresse complète connue (rue + ville + code postal + pays),
// on géocode précisément pour placer le point sur la carte d'aperçu.
watch([address, city, pc, country], ([newAddress, newCity, newPc, newCountry]) => {
  clearTimeout(addressDebounceTimeout);
  addressDebounceTimeout = setTimeout(async () => {
    if (![newAddress, newCity, newPc, newCountry].every(field => field.trim() !== '')) {
      return;
    }

    isLoading.value = true;
    try {
      const params = new URLSearchParams({
        street: newAddress,
        city: newCity,
        postalcode: newPc,
        country: newCountry,
        format: 'json'
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FindMyCompany/1.0 (lou.rassat2003@gmail.com)'
        }
      });

      const results = await response.json();

      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        placeMarker(L.latLng(lat, lon), { recenter: true });
      } else {
        console.warn("Aucun résultat pour cette adresse.");
      }
    } catch (error) {
      console.error("Erreur lors de l'appel à Nominatim:", error);
    } finally {
      isLoading.value = false;
    }
  }, 500);
});

const addContact = () => {
  contacts.value.push(emptyContact());
};
const removeContact = (index) => {
  if (contacts.value.length <= 1) return;
  contacts.value.splice(index, 1);
};

const resetForm = () => {
  speciality.value = '';
  name.value = '';
  address.value = '';
  city.value = '';
  country.value = '';
  pc.value = '';
  x.value = '';
  y.value = '';
  contacts.value = [emptyContact()];
  mission.value = '';
  review.rating = 0;
  review.comment = '';
  currentStep.value = 1;
  if (marker) {
    marker.remove();
    marker = null;
  }
  isPinPlaced.value = false;
};

// Avance à l'étape suivante si l'étape courante est valide, ou soumet le
// formulaire depuis la dernière étape.
const goNext = () => {
  stepError.value = '';
  if (currentStep.value === 1 && !validateCompany()) {
    stepError.value = t('addCompanyForm.stepErrorCompany');
    return;
  }
  if (currentStep.value === 2 && !validateContacts()) {
    stepError.value = t('addCompanyForm.stepErrorContacts');
    return;
  }
  if (currentStep.value === 3 && !validateMission()) {
    stepError.value = t('addCompanyForm.stepErrorMission');
    return;
  }

  if (currentStep.value < totalSteps) {
    currentStep.value += 1;
  } else {
    submitForm();
  }
};

const goPrev = () => {
  stepError.value = '';
  if (currentStep.value > 1) {
    currentStep.value -= 1;
  }
};

// Fonction pour soumettre le formulaire : ajoute directement l'entreprise si
// on est admin, valide une proposition en attente en mode révision, ou
// envoie la proposition en attente de validation pour un visiteur non connecté.
const submitForm = async () => {
  if (isLoading.value) return;

  const company = validateCompany();
  const validContacts = validateContacts();
  const validMission = validateMission();
  const validReview = validateReview();

  if (!company || !validContacts || !validMission || !validReview) {
    stepError.value = t('addCompanyForm.stepErrorGeneric');
    return;
  }

  company.mission = validMission;
  if (!validReview.skipped) {
    company.review = { rating: validReview.rating, comment: validReview.comment };
  }

  isLoading.value = true;
  try {
    // Vérification des coordonnées GPS
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${x.value}&lon=${y.value}&zoom=3&addressdetails=1`;
    const response = await fetch(reverseUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FindMyCompany/1.0 (lou.rassat2003@gmail.com)'
      }
    });
    const reverseData = await response.json();
    const countryFromCoordinates = reverseData.address?.country;
    // Check
    if (!countryFromCoordinates || !country.value.toLowerCase().includes(countryFromCoordinates.toLowerCase())) {
      alert(t('addCompanyForm.errorCompanyStateNotCoherent') + countryFromCoordinates);
      return;
    }

    if (props.pendingCompany) {
      await approve(props.pendingCompany.id, company, validContacts);
      resetForm();
      emit('refresh');
      emit('close');
    } else if (isAdmin.value) {
      await addCompanyDirectly(company, validContacts);
      resetForm();
      emit('refresh');
      emit('close');
    } else {
      await submitPending(company, validContacts);
      submissionDone.value = true;
    }
  } catch (e) {
    console.error("Erreur lors de l'ajout de l'entreprise : ", e);
  } finally {
    isLoading.value = false;
  }
};

// Refuse la proposition en attente actuellement affichée en mode révision.
const handleReject = async () => {
  if (!props.pendingCompany || isLoading.value) return;
  isLoading.value = true;
  try {
    await rejectPending(props.pendingCompany.id);
    emit('close');
  } catch (e) {
    console.error("Erreur lors du refus de la proposition :", e);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="form-map-wrapper">
    <div v-if="submissionDone" class="form-container pending-confirmation">
      <h2>{{ t('addCompanyForm.pendingSubmittedTitle') }}</h2>
      <p>{{ t('addCompanyForm.pendingSubmittedText') }}</p>
      <button type="button" class="submit-button" @click="emit('close')">{{ t('addCompanyForm.closeButton') }}</button>
    </div>
    <form v-else class="form-container" @submit.prevent="goNext">
      <h2>{{ pendingCompany ? t('addCompanyForm.reviewTitle') : t('addCompanyForm.addCompany') }}</h2>

      <ol class="step-indicator">
        <li
          v-for="(label, index) in stepLabels"
          :key="label"
          :class="{ active: currentStep === index + 1, done: currentStep > index + 1 }"
        >
          <span class="step-number">{{ index + 1 }}</span>
          <span class="step-label">{{ label }}</span>
        </li>
      </ol>

      <!-- Étape 1 : entreprise -->
      <div v-show="currentStep === 1">
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
          <label for="country">{{ t('addCompanyForm.companyState') }}</label>
          <select id="country" v-model="country">
            <option disabled value="">{{ t('addCompanyForm.selectCompanyState') }}</option>
            <option v-for="[code, name] in countryList" :key="code" :value="name">
              {{ name }}
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
      </div>

      <!-- Étape 2 : contact(s) -->
      <div v-show="currentStep === 2">
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
      </div>

      <!-- Étape 3 : mission -->
      <div v-show="currentStep === 3">
        <div class="form-group">
          <label for="mission">{{ t('addCompanyForm.missionLabel') }}</label>
          <p class="step-hint">{{ t('addCompanyForm.missionHint') }}</p>
          <textarea id="mission" v-model="mission" maxlength="1000" rows="8"></textarea>
        </div>
      </div>

      <!-- Étape 4 : avis -->
      <div v-show="currentStep === 4">
        <p class="step-hint">{{ t('addCompanyForm.reviewHint') }}</p>
        <div class="form-group">
          <label>{{ t('addCompanyForm.reviewRatingLabel') }}</label>
          <StarRating v-model="review.rating" />
        </div>
        <div class="form-group">
          <label for="review-comment">{{ t('addCompanyForm.reviewCommentLabel') }}</label>
          <textarea id="review-comment" v-model="review.comment" maxlength="500" rows="5"></textarea>
        </div>
      </div>

      <p v-if="stepError" class="step-error">{{ stepError }}</p>

      <div class="wizard-actions">
        <button v-if="currentStep > 1" type="button" class="prev-button" @click="goPrev">
          {{ t('addCompanyForm.previousButton') }}
        </button>
        <button type="submit" class="submit-button">
          {{ currentStep < totalSteps
            ? t('addCompanyForm.nextButton')
            : (pendingCompany ? t('addCompanyForm.validateButton') : t('addCompanyForm.addCompanyButton')) }}
        </button>
      </div>
      <button v-if="pendingCompany" type="button" class="reject-button" @click="handleReject">
        {{ t('addCompanyForm.rejectButton') }}
      </button>
    </form>

    <div class="mini-map-wrapper" v-show="currentStep === 1">
      <div class="mini-map" ref="mapContainer"></div>
      <p class="map-hint">
        {{ isPinPlaced ? t('addCompanyForm.mapAdjustHint') : t('addCompanyForm.mapPlaceHint') }}
      </p>
    </div>
  </div>
</template>


<style scoped>

.form-map-wrapper {
  display: flex;
  justify-content: space-between;
  gap: 50px;
}

select {
  width: 100%;
  padding: 8px 12px;
  border: 2px solid var(--gray-white-light);
  border-radius: 6px;
  font-size: 14px;
  background-color: var(--white);
  transition: border 0.2s;
}

.form-container {
  background: var(--white);
  padding: 25px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  margin: 0 auto;
  font-family: 'Segoe UI', sans-serif;
}

h2 {
  color: var(--red-esigelec);
  text-align: center;
  margin-bottom: 20px;
}

.step-indicator {
  display: flex;
  justify-content: space-between;
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
  gap: 4px;
}

.step-indicator li {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  opacity: 0.5;
}

.step-indicator li.active,
.step-indicator li.done {
  opacity: 1;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--gray-white-light);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.step-indicator li.active .step-number,
.step-indicator li.done .step-number {
  background: var(--red-esigelec);
}

.step-label {
  font-size: 0.7em;
  color: var(--gray-dark);
  font-weight: 600;
}

.step-hint {
  font-size: 0.85em;
  color: var(--gray-dark);
  margin: 0 0 12px 0;
}

.step-error {
  color: var(--red-esigelec);
  font-size: 0.85em;
  text-align: center;
  margin: 10px 0 0 0;
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

input, textarea {
  width: 90%;
  padding: 8px 12px;
  border: 2px solid var(--gray-white-light);
  border-radius: 6px;
  font-size: 14px;
  transition: border 0.2s;
  background-color: var(--white);
  color: var(--gray-dark);
  font-family: inherit;
  resize: vertical;
}

input:focus, textarea:focus {
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

.wizard-actions {
  display: flex;
  gap: 10px;
}

.prev-button {
  background-color: transparent;
  color: var(--red-esigelec);
  border: 2px solid var(--red-esigelec);
  border-radius: 6px;
  padding: 10px;
  flex: 1;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.prev-button:hover {
  background-color: var(--red-esigelec);
  color: var(--white);
}

.submit-button {
  background-color: var(--red-esigelec);
  color: var(--white);
  border: none;
  border-radius: 6px;
  padding: 10px;
  flex: 2;
  width: 100%;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.submit-button:hover {
  background-color: var(--red-btn-hover);
}

.reject-button {
  background-color: transparent;
  color: var(--red-esigelec);
  border: 2px solid var(--red-esigelec);
  border-radius: 6px;
  padding: 10px;
  width: 100%;
  margin-top: 10px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.reject-button:hover {
  background-color: var(--red-esigelec);
  color: var(--white);
}

.pending-confirmation {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}

.mini-map-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 600px;
  flex-shrink: 0;
}

.mini-map {
  width: 100%;
  flex: 1 1 auto;
  min-height: 300px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: crosshair;
  /* Les panes internes de Leaflet montent jusqu'à z-index:700 ; sans ceci,
     ces valeurs remontent hors de la carte et passent devant le bouton de
     fermeture de la modale (z-index:10). isolation:isolate les enferme ici. */
  isolation: isolate;
}

.map-hint {
  margin: 0;
  font-size: 0.85em;
  color: var(--gray-dark);
  text-align: center;
}

@media (max-width: 768px) {
  .form-map-wrapper {
    flex-direction: column;
    align-items: center;
    max-height: 80vh;
    overflow-y: auto;
  }
  .mini-map-wrapper {
    width: 100%;
  }
  .mini-map {
    width: 100%;
    height: 300px;
  }
  .step-label {
    display: none;
  }
}

</style>
