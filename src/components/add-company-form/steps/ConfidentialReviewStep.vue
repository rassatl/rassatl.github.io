<script setup>
import { reactive, inject } from 'vue'
import StarRating from '../../common/StarRating.vue'

const t = inject('t')
const props = defineProps({ pendingCompany: { type: Object, default: null } });

// Avis personnel du formulaire confidentiel : le ressenti de l'étudiant sur
// son expérience (mission, pays, logement...), sans rien qui identifie
// l'entreprise elle-même.
const review = reactive({
  rating: props.pendingCompany?.review?.rating ?? 0,
  missionFeeling: props.pendingCompany?.review?.missionFeeling ?? '',
  countryFeeling: props.pendingCompany?.review?.countryFeeling ?? '',
  housingFeeling: props.pendingCompany?.review?.housingFeeling ?? '',
});

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

// L'avis est entièrement facultatif : sans aucun champ rempli, l'étape est
// simplement ignorée.
const validate = () => {
  const missionFeeling = normalizeText(review.missionFeeling, 500);
  const countryFeeling = normalizeText(review.countryFeeling, 500);
  const housingFeeling = normalizeText(review.housingFeeling, 500);

  if (!review.rating && !missionFeeling && !countryFeeling && !housingFeeling) return { skipped: true };

  const result = { skipped: false };
  if (review.rating) result.rating = review.rating;
  if (missionFeeling) result.missionFeeling = missionFeeling;
  if (countryFeeling) result.countryFeeling = countryFeeling;
  if (housingFeeling) result.housingFeeling = housingFeeling;
  return result;
};

defineExpose({ validate });
</script>

<template>
  <p class="step-hint">{{ t('addCompanyForm.reviewHintConfidential') }}</p>
  <div class="form-group">
    <label>{{ t('addCompanyForm.reviewRatingLabelConfidential') }}</label>
    <StarRating v-model="review.rating" />
  </div>
  <div class="form-group">
    <label for="review-mission">{{ t('addCompanyForm.reviewMissionLabel') }}</label>
    <textarea id="review-mission" v-model="review.missionFeeling" maxlength="500" rows="4"></textarea>
  </div>
  <div class="form-group">
    <label for="review-country">{{ t('addCompanyForm.reviewCountryLabel') }}</label>
    <textarea id="review-country" v-model="review.countryFeeling" maxlength="500" rows="4"></textarea>
  </div>
  <div class="form-group">
    <label for="review-housing">{{ t('addCompanyForm.reviewHousingLabel') }}</label>
    <textarea id="review-housing" v-model="review.housingFeeling" maxlength="500" rows="4"></textarea>
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

textarea {
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
  resize: vertical;
}

textarea:focus {
  border-color: var(--red-esigelec);
  outline: none;
}
</style>
