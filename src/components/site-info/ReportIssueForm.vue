<script setup>
import { ref, computed, inject } from 'vue'
import { useTickets } from '../../composables/useTickets.js'
import { useErrorLogs } from '../../composables/useErrorLogs.js'

const t = inject('t')
const { submitTicket } = useTickets()
const { logError } = useErrorLogs()
const emit = defineEmits(['close'])

const title = ref('')
const description = ref('')
const isLoading = ref(false)
const submitted = ref(false)
const attempted = ref(false)

const descriptionInvalid = computed(() => attempted.value && !description.value.trim())

const handleSubmit = async () => {
  attempted.value = true
  const cleanedDescription = description.value.trim()
  if (!cleanedDescription || isLoading.value) return

  isLoading.value = true
  try {
    await submitTicket({ title: title.value.trim(), description: cleanedDescription })
    submitted.value = true
  } catch (e) {
    console.error("Erreur lors de l'envoi du signalement :", e)
    logError(e, 'reportIssueForm:submit')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="report-issue">
    <template v-if="submitted">
      <h2>{{ t('reportIssue.sentTitle') }}</h2>
      <p>{{ t('reportIssue.sentText') }}</p>
      <button type="button" class="submit-button" @click="emit('close')">{{ t('reportIssue.closeButton') }}</button>
    </template>
    <form v-else @submit.prevent="handleSubmit">
      <h2>{{ t('reportIssue.title') }}</h2>
      <div class="form-group">
        <label for="issue-title">{{ t('reportIssue.fieldTitle') }} ({{ t('addCompanyForm.optional') }})</label>
        <input id="issue-title" v-model="title" maxlength="150" />
      </div>
      <div class="form-group">
        <label for="issue-description">{{ t('reportIssue.fieldDescription') }}</label>
        <textarea
          id="issue-description"
          v-model="description"
          maxlength="2000"
          rows="6"
          :class="{ invalid: descriptionInvalid }"
        ></textarea>
        <p v-if="descriptionInvalid" class="field-error">{{ t('reportIssue.errorDescription') }}</p>
      </div>
      <div class="form-actions">
        <button type="button" class="cancel-button" @click="emit('close')">{{ t('reportIssue.cancelButton') }}</button>
        <button type="submit" class="submit-button" :disabled="isLoading">{{ t('reportIssue.sendButton') }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.report-issue {
  width: 400px;
  max-width: 100%;
  font-family: 'Segoe UI', sans-serif;
}

h2 {
  color: var(--red-esigelec);
  text-align: center;
  margin-bottom: 20px;
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

input,
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
}

textarea {
  resize: vertical;
}

input:focus,
textarea:focus {
  border-color: var(--red-esigelec);
  outline: none;
}

input.invalid,
textarea.invalid {
  border-color: var(--red-esigelec);
  background-color: #fdeeee;
}

.field-error {
  margin: 6px 0 0 0;
  font-size: 0.8em;
  color: var(--red-esigelec);
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.cancel-button {
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

.cancel-button:hover {
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

.submit-button:disabled {
  opacity: 0.7;
  cursor: default;
}
</style>
