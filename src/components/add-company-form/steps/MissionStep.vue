<script setup>
import { ref, inject } from 'vue'

const t = inject('t')
const props = defineProps({ pendingCompany: { type: Object, default: null } });

const mission = ref(props.pendingCompany?.mission ?? '');

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

const validate = () => {
  const cleaned = normalizeText(mission.value, 1000);
  return cleaned ? cleaned : null;
};

defineExpose({ validate });
</script>

<template>
  <div class="form-group">
    <label for="mission">{{ t('addCompanyForm.missionLabel') }}</label>
    <p class="step-hint">{{ t('addCompanyForm.missionHint') }}</p>
    <textarea id="mission" v-model="mission" maxlength="1000" rows="8"></textarea>
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
