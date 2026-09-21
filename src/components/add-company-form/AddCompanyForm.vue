<script setup>
import { ref, watch, onMounted, inject, computed } from 'vue';
import { getCountryList } from '../../data/countries.js'
import { useAuth } from '../../composables/useAuth.js'
import { usePendingCompanies } from '../../composables/usePendingCompanies.js'
import { useErrorLogs } from '../../composables/useErrorLogs.js'
import StepIndicator from './StepIndicator.vue'
import StudentStep from './steps/StudentStep.vue'
import CompanyStep from './steps/CompanyStep.vue'
import MiniMap from './steps/MiniMap.vue'
import ContactsStep from './steps/ContactsStep.vue'
import MissionStep from './steps/MissionStep.vue'
import ReviewStep from './steps/ReviewStep.vue'

const t = inject('t')
const { isAdmin, studentEmail } = useAuth();
const { submitPending, approve, addCompanyDirectly, reject: rejectPending } = usePendingCompanies();
const { logError } = useErrorLogs();

// Quand une proposition en attente est fournie, le formulaire passe en mode
// "révision" : il est pré-rempli et permet de la modifier avant de valider
// ou de la refuser, au lieu de créer une nouvelle soumission.
const props = defineProps({ pendingCompany: { type: Object, default: null } });

const emit = defineEmits(['refresh', 'close']);

// En mode révision, l'admin doit pouvoir juger l'ensemble de la proposition
// d'un coup d'œil pour décider de valider ou refuser : on affiche donc
// toutes les sections en même temps plutôt que de les cacher étape par étape.
const isReviewMode = computed(() => !!props.pendingCompany);

// Un admin (ajout direct ou révision) est de confiance ; tous les autres
// doivent d'abord prouver qu'ils sont étudiants, sinon la proposition est de
// toute façon refusée par les règles Firestore.
const needsVerification = computed(() => !isAdmin.value && !isReviewMode.value);

// État de l'étape 1, partagé entre CompanyStep (champs) et MiniMap (carte)
// via v-model : les deux doivent rester synchronisés (ex. un géocodage
// déclenché par l'adresse déplace le repère, un glisser-déposer du repère
// met à jour les coordonnées).
const speciality = ref(props.pendingCompany?.speciality ?? '');
const name = ref(props.pendingCompany?.name ?? '');
const address = ref(props.pendingCompany?.address ?? '');
const city = ref(props.pendingCompany?.city ?? '');
const pc = ref(props.pendingCompany?.pc ?? '');
const country = ref(props.pendingCompany?.country ?? '');
const website = ref(props.pendingCompany?.website ?? '');
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

// Étapes affichées, dans l'ordre. Chaque étape est repérée par sa clé et non
// par son numéro, car la vérification étudiante n'existe que pour certains
// utilisateurs et décalerait sinon toutes les autres.
const stepKeys = computed(() => [
  ...(needsVerification.value ? ['student'] : []),
  'company', 'contacts', 'mission', 'review',
]);
const totalSteps = computed(() => stepKeys.value.length);
const currentKey = computed(() => stepKeys.value[currentStep.value - 1]);
const showStep = (key) => isReviewMode.value || currentKey.value === key;

const stepLabelKeys = {
  student: 'addCompanyForm.stepStudentLabel',
  company: 'addCompanyForm.step1Label',
  contacts: 'addCompanyForm.step2Label',
  mission: 'addCompanyForm.step3Label',
  review: 'addCompanyForm.step4Label',
};
const stepLabel = (key) => t(stepLabelKeys[key]);
const stepLabels = computed(() => stepKeys.value.map(stepLabel));

// Traduit le code d'erreur renvoyé par CompanyStep.validateFields().
const companyStepErrorKeys = {
  company: 'addCompanyForm.stepErrorCompany',
  website: 'addCompanyForm.stepErrorWebsite',
};

// Choix de l'étudiant : afficher (ou non) son email sur la fiche de
// l'entreprise publiée. Privé par défaut ; partagé avec StudentStep (v-model).
const submitterVisible = ref(false);
const studentStepRef = ref(null);
const companyStepRef = ref(null);
const miniMapRef = ref(null);
const contactsStepRef = ref(null);
const missionStepRef = ref(null);
const reviewStepRef = ref(null);

onMounted(() => {
  const lang = localStorage.getItem('lang') || 'fr';
  countryList.value = Object.entries(getCountryList(lang));
});

// La mini-carte est cachée (v-show) sur les étapes 2 à 4 : Leaflet calcule
// mal ses tuiles pendant qu'un conteneur est en display:none, il faut donc
// recalculer sa taille à chaque retour sur l'étape 1.
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
  if (currentKey.value === 'student' && !studentStepRef.value.validate()) {
    stepError.value = t('addCompanyForm.stepErrorStudent');
    return;
  }
  if (currentKey.value === 'company') {
    const { error } = companyStepRef.value.validateFields();
    if (error) {
      stepError.value = t(companyStepErrorKeys[error]);
      if (error === 'company' && (x.value === '' || y.value === '')) pinMissingAttempt.value += 1;
      return;
    }
  }
  if (currentKey.value === 'contacts' && !contactsStepRef.value.validate()) {
    stepError.value = t('addCompanyForm.stepErrorContacts');
    return;
  }
  if (currentKey.value === 'mission' && !missionStepRef.value.validate()) {
    stepError.value = t('addCompanyForm.stepErrorMission');
    return;
  }

  if (currentStep.value < totalSteps.value) {
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

  // Filet de sécurité : la session étudiante a pu être fermée (déconnexion,
  // autre onglet) depuis l'étape de vérification.
  if (needsVerification.value && !studentEmail.value) {
    currentStep.value = 1;
    stepError.value = t('addCompanyForm.stepErrorStudent');
    return;
  }

  const { data: company, error } = companyStepRef.value.validateFields();
  const validContacts = contactsStepRef.value.validate();
  const validMission = missionStepRef.value.validate();
  const validReview = reviewStepRef.value.validate();

  if (error || !validContacts || !validMission || !validReview) {
    stepError.value = t('addCompanyForm.stepErrorGeneric');
    if (error === 'company' && (x.value === '' || y.value === '')) pinMissingAttempt.value += 1;
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
    if (!countryFromCoordinates || !country.value.toLowerCase().includes(countryFromCoordinates.toLowerCase())) {
      alert(t('addCompanyForm.errorCompanyStateNotCoherent') + countryFromCoordinates);
      return;
    }

    if (props.pendingCompany) {
      await approve(props.pendingCompany.id, company, validContacts, {
        email: props.pendingCompany.submittedBy,
        visible: props.pendingCompany.submitterVisible,
      });
      emit('refresh');
      emit('close');
    } else if (isAdmin.value) {
      await addCompanyDirectly(company, validContacts);
      emit('refresh');
      emit('close');
    } else {
      await submitPending(company, validContacts, { visible: submitterVisible.value });
      submissionDone.value = true;
    }
  } catch (e) {
    console.error("Erreur lors de l'ajout de l'entreprise : ", e);
    logError(e, 'addCompanyForm:submit');
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
    logError(e, 'addCompanyForm:reject');
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
      <h2>{{ pendingCompany ? t('addCompanyForm.reviewTitle') : t('addCompanyForm.addCompany') }}</h2>

      <StepIndicator v-if="!isReviewMode" :steps="stepLabels" :current-step="currentStep" />

      <!-- Auteur de la proposition, visible des seuls admins en révision -->
      <p v-if="pendingCompany?.submittedBy" class="submitted-by">
        {{ t('pendingCompanies.submittedBy') }} <strong>{{ pendingCompany.submittedBy }}</strong><br />
        {{ pendingCompany.submitterVisible ? t('pendingCompanies.submitterVisible') : t('pendingCompanies.submitterPrivate') }}
      </p>

      <!-- Étape de vérification : email étudiant (jamais affiché sur le site) -->
      <div v-if="needsVerification" v-show="showStep('student')">
        <StudentStep ref="studentStepRef" v-model:visible="submitterVisible" />
      </div>

      <!-- Étape entreprise -->
      <h3 v-if="isReviewMode" class="review-section-title">{{ stepLabel('company') }}</h3>
      <div v-show="showStep('company')">
        <CompanyStep
          ref="companyStepRef"
          v-model:speciality="speciality"
          v-model:name="name"
          v-model:website="website"
          v-model:country="country"
          v-model:address="address"
          v-model:city="city"
          v-model:pc="pc"
          :x="x"
          :y="y"
          :country-list="countryList"
        />
      </div>

      <!-- Étape contact(s) -->
      <h3 v-if="isReviewMode" class="review-section-title">{{ stepLabel('contacts') }}</h3>
      <div v-show="showStep('contacts')">
        <ContactsStep ref="contactsStepRef" :pending-company="pendingCompany" />
      </div>

      <!-- Étape mission -->
      <h3 v-if="isReviewMode" class="review-section-title">{{ stepLabel('mission') }}</h3>
      <div v-show="showStep('mission')">
        <MissionStep ref="missionStepRef" :pending-company="pendingCompany" />
      </div>

      <!-- Étape avis -->
      <h3 v-if="isReviewMode" class="review-section-title">{{ stepLabel('review') }}</h3>
      <div v-show="showStep('review')">
        <ReviewStep ref="reviewStepRef" :pending-company="pendingCompany" />
      </div>

      <p v-if="stepError" class="step-error">{{ stepError }}</p>

      <div class="wizard-actions">
        <button v-if="!isReviewMode && currentStep > 1" type="button" class="prev-button" @click="goPrev">
          {{ t('addCompanyForm.previousButton') }}
        </button>
        <button type="submit" class="submit-button">
          {{ !isReviewMode && currentStep < totalSteps
            ? t('addCompanyForm.nextButton')
            : (pendingCompany ? t('addCompanyForm.validateButton') : t('addCompanyForm.addCompanyButton')) }}
        </button>
      </div>
      <button v-if="pendingCompany" type="button" class="reject-button" @click="handleReject">
        {{ t('addCompanyForm.rejectButton') }}
      </button>
    </form>

    <MiniMap
      ref="miniMapRef"
      v-show="showStep('company')"
      v-model:x="x"
      v-model:y="y"
      :speciality="speciality"
      :address="address"
      :city="city"
      :pc="pc"
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
  /* width (pas seulement max-width) : sans taille explicite, un flex item
     shrink-to-fit se redimensionne selon son contenu — une longue phrase
     d'erreur sur une seule ligne pouvait élargir toute la modale d'un coup. */
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
  margin-bottom: 20px;
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

.submitted-by {
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
