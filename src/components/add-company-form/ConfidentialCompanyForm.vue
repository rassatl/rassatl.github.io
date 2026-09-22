<script setup>
import { ref, watch, onMounted, inject, computed } from 'vue';
import { getCountryList } from '../../data/countries.js'
import { useAuth } from '../../composables/useAuth.js'
import { usePendingCompanies } from '../../composables/usePendingCompanies.js'
import { useErrorLogs } from '../../composables/useErrorLogs.js'
import { useLoginModal } from '../../composables/useLoginModal.js'
import StepIndicator from './StepIndicator.vue'
import ConfidentialCompanyStep from './steps/ConfidentialCompanyStep.vue'
import ConfidentialMiniMap from './steps/ConfidentialMiniMap.vue'
import ConfidentialContactStep from './steps/ConfidentialContactStep.vue'
import ConfidentialReviewStep from './steps/ConfidentialReviewStep.vue'

// Formulaire confidentiel : utilisé par défaut par un visiteur non connecté
// pour une nouvelle soumission (voir AddCompanyForm.vue, qui choisit ce
// formulaire ou FullCompanyForm.vue selon l'état de connexion), mais aussi,
// par choix explicite (canSwitchToFull), par un étudiant connecté qui
// préfère rester anonyme plutôt que de passer par le formulaire complet.
// Sert aussi à la révision par un admin d'une proposition déjà de ce format
// (repérée par l'absence du champ "name"). Ni nom, ni adresse, ni site web,
// ni contacts, ni mission : seuls spécialité, pays, ville et un point sur la
// carte, plus un avis personnel facultatif. Toujours totalement anonyme,
// jamais d'auteur, quel que soit l'état de connexion de qui la soumet (voir
// firestore.rules).

const t = inject('t')
const { studentEmail } = useAuth();
const { submitPending, approve, reject: rejectPending } = usePendingCompanies();
const { logError } = useErrorLogs();
const { open: openLoginModal } = useLoginModal();

const props = defineProps({
  pendingCompany: { type: Object, default: null },
  canSwitchToFull: { type: Boolean, default: false },
});
const emit = defineEmits(['refresh', 'close', 'switch-to-full']);

const isReviewMode = computed(() => !!props.pendingCompany);

const speciality = ref(props.pendingCompany?.speciality ?? '');
const city = ref(props.pendingCompany?.city ?? '');
const country = ref(props.pendingCompany?.country ?? '');
const x = ref(props.pendingCompany?.x ?? '');
const y = ref(props.pendingCompany?.y ?? '');
const countryList = ref([]);

const isLoading = ref(false);
const submissionDone = ref(false);
const currentStep = ref(1);
const stepError = ref('');
// Incrémenté à chaque tentative de passage à l'étape suivante (ou de
// soumission) sans point placé sur la carte : attire l'œil vers la carte,
// en rejouant l'animation à chaque nouveau clic plutôt qu'une seule fois.
const pinMissingAttempt = ref(0);

// Le point est considéré comme placé dès que x/y sont renseignés.
watch([x, y], ([newX, newY]) => {
  if (newX !== '' && newY !== '') pinMissingAttempt.value = 0;
});

const stepKeys = ['company', 'contact', 'review'];
const totalSteps = stepKeys.length;
const currentKey = computed(() => stepKeys[currentStep.value - 1]);
const showStep = (key) => isReviewMode.value || currentKey.value === key;

const stepLabelKeys = {
  company: 'addCompanyForm.step1Label',
  contact: 'addCompanyForm.stepContactLabel',
  review: 'addCompanyForm.step4LabelConfidential',
};
const stepLabel = (key) => t(stepLabelKeys[key]);
const stepLabels = stepKeys.map(stepLabel);

// Traduit le code d'erreur renvoyé par ConfidentialCompanyStep.validateFields().
const companyStepErrorKeys = {
  company: 'addCompanyForm.stepErrorCompany',
};

const companyStepRef = ref(null);
const miniMapRef = ref(null);
const contactStepRef = ref(null);
const reviewStepRef = ref(null);

onMounted(() => {
  const lang = localStorage.getItem('lang') || 'fr';
  countryList.value = Object.entries(getCountryList(lang));
});

// La mini-carte est cachée (v-show) sur l'étape avis : Leaflet calcule mal
// ses tuiles pendant qu'un conteneur est en display:none, il faut donc
// recalculer sa taille à chaque retour sur l'étape entreprise.
watch(currentKey, (key) => {
  if (key === 'company') miniMapRef.value?.invalidateSize();
});

// Gère la soumission du formulaire : en mode révision tout est déjà visible,
// donc "Valider" soumet directement ; sinon on avance étape par étape.
const handleSubmit = () => {
  if (isReviewMode.value) {
    submitForm();
  } else {
    goNext();
  }
};

// Avance à l'étape suivante si l'étape courante est valide, ou soumet le
// formulaire depuis la dernière étape.
const goNext = () => {
  stepError.value = '';
  if (currentKey.value === 'company') {
    const { error } = companyStepRef.value.validateFields();
    if (error) {
      stepError.value = t(companyStepErrorKeys[error]);
      if (error === 'company' && (x.value === '' || y.value === '')) pinMissingAttempt.value += 1;
      return;
    }
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

// Envoie la proposition en attente de validation (toujours anonyme), ou
// valide la proposition actuellement en révision.
const submitForm = async () => {
  if (isLoading.value) return;

  const { data: company, error } = companyStepRef.value.validateFields();
  const validContact = contactStepRef.value.validate();
  const validReview = reviewStepRef.value.validate();

  if (error || !validContact || !validReview) {
    stepError.value = t('addCompanyForm.stepErrorGeneric');
    if (error === 'company' && (x.value === '' || y.value === '')) pinMissingAttempt.value += 1;
    return;
  }

  if (!validReview.skipped) {
    const { skipped, ...reviewData } = validReview;
    company.review = reviewData;
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
    if (!countryFromCoordinates || !country.value.toLowerCase().includes(countryFromCoordinates.toLowerCase())) {
      alert(t('addCompanyForm.errorCompanyStateNotCoherentConfidential') + countryFromCoordinates);
      return;
    }

    if (props.pendingCompany) {
      // Jamais de contacts « d'entreprise » ni d'auteur pour une proposition
      // confidentielle. Le moyen de contact peut avoir été corrigé pendant
      // la révision : on republie la version validée à l'instant, pas celle
      // déjà en base.
      await approve(props.pendingCompany.id, company, null, null, validContact);
      emit('refresh');
      emit('close');
    } else {
      await submitPending(company, { confidentialContact: validContact });
      submissionDone.value = true;
    }
  } catch (e) {
    console.error("Erreur lors de l'ajout du point : ", e);
    logError(e, 'confidentialCompanyForm:submit');
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
    logError(e, 'confidentialCompanyForm:reject');
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
    <form v-else class="form-container" @submit.prevent="handleSubmit">
      <h2>{{ pendingCompany ? t('addCompanyForm.reviewTitle') : t('addCompanyForm.addConfidentialCompany') }}</h2>
      <p v-if="!isReviewMode" class="confidential-subtitle">{{ t('addCompanyForm.confidentialSubtitle') }}</p>

      <div v-if="!isReviewMode && !studentEmail" class="full-form-notice">
        <p>{{ t('addCompanyForm.confidentialUpsellText') }}</p>
        <button type="button" class="upsell-button" @click="openLoginModal">
          {{ t('login.openButton') }}
        </button>
      </div>
      <button
        v-if="canSwitchToFull"
        type="button"
        class="switch-mode-button"
        @click="emit('switch-to-full')"
      >
        {{ t('addCompanyForm.switchToFull') }}
      </button>

      <StepIndicator v-if="!isReviewMode" :steps="stepLabels" :current-step="currentStep" />

      <!-- Étape entreprise -->
      <h3 v-if="isReviewMode" class="review-section-title">{{ stepLabel('company') }}</h3>
      <div v-show="showStep('company')">
        <ConfidentialCompanyStep
          ref="companyStepRef"
          v-model:speciality="speciality"
          v-model:country="country"
          v-model:city="city"
          :x="x"
          :y="y"
          :country-list="countryList"
        />
      </div>

      <!-- Étape moyen de contact -->
      <h3 v-if="isReviewMode" class="review-section-title">{{ stepLabel('contact') }}</h3>
      <div v-show="showStep('contact')">
        <ConfidentialContactStep ref="contactStepRef" :pending-company="pendingCompany" />
      </div>

      <!-- Étape avis personnel -->
      <h3 v-if="isReviewMode" class="review-section-title">{{ stepLabel('review') }}</h3>
      <div v-show="showStep('review')">
        <ConfidentialReviewStep ref="reviewStepRef" :pending-company="pendingCompany" />
      </div>

      <p v-if="stepError" class="step-error">{{ stepError }}</p>

      <div class="wizard-actions">
        <button v-if="!isReviewMode && currentStep > 1" type="button" class="prev-button" @click="goPrev">
          {{ t('addCompanyForm.previousButton') }}
        </button>
        <button type="submit" class="submit-button">
          {{ !isReviewMode && currentStep < totalSteps
            ? t('addCompanyForm.nextButton')
            : (pendingCompany ? t('addCompanyForm.validateButton') : t('addCompanyForm.addPointButton')) }}
        </button>
      </div>
      <button v-if="pendingCompany" type="button" class="reject-button" @click="handleReject">
        {{ t('addCompanyForm.rejectButton') }}
      </button>
    </form>

    <ConfidentialMiniMap
      ref="miniMapRef"
      v-show="showStep('company')"
      v-model:x="x"
      v-model:y="y"
      :speciality="speciality"
      :city="city"
      :country="country"
      :pending-company="pendingCompany"
      :missing-pin-attempt="pinMissingAttempt"
    />
  </div>
</template>


<style scoped>

.form-map-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 50px;
}

.form-container {
  background: var(--white);
  padding: 25px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 500px;
  max-width: 500px;
  flex-shrink: 0;
  max-height: 80vh;
  overflow-y: auto;
  margin: 0 auto;
  font-family: 'Segoe UI', sans-serif;
  box-sizing: border-box;
}

h2 {
  color: var(--red-esigelec);
  text-align: center;
  margin-bottom: 4px;
}

.confidential-subtitle {
  color: var(--gray-dark);
  text-align: center;
  font-size: 0.85em;
  margin: 0 0 16px 0;
}

.full-form-notice {
  background-color: #f5f8ff;
  border: 1px solid var(--blue-esigelec);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.full-form-notice p {
  margin: 0;
  font-size: 0.9em;
  color: var(--gray-dark);
}

.upsell-button {
  background-color: var(--blue-esigelec);
  color: var(--white);
  border: none;
  border-radius: 6px;
  padding: 9px;
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: filter 0.2s ease;
}

.upsell-button:hover {
  filter: brightness(1.1);
}

.switch-mode-button {
  display: block;
  margin: 0 auto 16px auto;
  background: none;
  border: none;
  color: var(--red-esigelec);
  font-size: 0.85em;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  text-align: center;
}

.review-section-title {
  color: var(--red-esigelec);
  border-top: 2px solid var(--gray-white-light);
  padding-top: 14px;
  margin: 14px 0 10px 0;
  font-size: 1em;
}

.review-section-title:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.step-error {
  color: var(--red-esigelec);
  font-size: 0.85em;
  text-align: center;
  margin: 10px 0 0 0;
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

@media (max-width: 768px) {
  .form-map-wrapper {
    flex-direction: column;
    align-items: center;
    max-height: 80vh;
    overflow-y: auto;
  }
  .form-container {
    width: 100%;
    max-height: none;
    overflow-y: visible;
  }
}

</style>
