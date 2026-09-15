<script setup>
import { reactive, inject } from 'vue'
import StarRating from '../../common/StarRating.vue'

const t = inject('t')
const props = defineProps({ pendingCompany: { type: Object, default: null } });

const review = reactive({
  rating: props.pendingCompany?.review?.rating ?? 0,
  comment: props.pendingCompany?.review?.comment ?? '',
});

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

// L'avis est facultatif : sans note ni commentaire, l'étape est simplement
// ignorée. Un commentaire sans note n'a pas de sens et est donc refusé.
const validate = () => {
  const comment = normalizeText(review.comment, 500);
  if (!review.rating && !comment) return { skipped: true };
  if (!review.rating) return null;
  return { skipped: false, rating: review.rating, comment };
};

defineExpose({ validate });
</script>

<template>
  <p class="step-hint">{{ t('addCompanyForm.reviewHint') }}</p>
  <div class="form-group">
    <label>{{ t('addCompanyForm.reviewRatingLabel') }}</label>
    <StarRating v-model="review.rating" />
  </div>
  <div class="form-group">
    <label for="review-comment">{{ t('addCompanyForm.reviewCommentLabel') }}</label>
    <textarea id="review-comment" v-model="review.comment" maxlength="500" rows="5"></textarea>
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
