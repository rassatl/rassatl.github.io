<script setup>
import { ref, inject } from 'vue'
import { usePendingCompanies } from '../../composables/usePendingCompanies.js'
import CompanyItem from './CompanyItem.vue'
import AddCompanyForm from '../add-company-form/AddCompanyForm.vue'

const t = inject('t')
const { pendingCompanies, reject } = usePendingCompanies()
const emit = defineEmits(['refresh'])

const selected = ref(null)

const openReview = (company) => {
  selected.value = company
}
const closeReview = () => {
  selected.value = null
}

const quickReject = async (company) => {
  if (!confirm(t('pendingCompanies.confirmReject'))) return
  await reject(company.id)
}
</script>

<template>
  <div class="pending-companies">
    <template v-if="selected">
      <button type="button" class="back-button" @click="closeReview">← {{ t('pendingCompanies.back') }}</button>
      <AddCompanyForm
        :pendingCompany="selected"
        @refresh="() => { emit('refresh'); closeReview(); }"
        @close="closeReview"
      />
    </template>
    <template v-else>
      <h2>{{ t('pendingCompanies.title') }}</h2>
      <p v-if="pendingCompanies.length === 0" class="empty">{{ t('pendingCompanies.empty') }}</p>
      <ul v-else>
        <li v-for="company in pendingCompanies" :key="company.id">
          <CompanyItem
            :speciality="company.speciality"
            :name="company.name"
            :city="company.city"
            :country="company.country"
            :pc="String(company.pc)"
          />
          <p v-if="company.submittedBy" class="submitted-by">
            {{ t('pendingCompanies.submittedBy') }} <strong>{{ company.submittedBy }}</strong>
          </p>
          <div class="pending-actions">
            <button type="button" class="review-button" @click="openReview(company)">{{ t('pendingCompanies.review') }}</button>
            <button type="button" class="reject-button" @click="quickReject(company)">{{ t('pendingCompanies.reject') }}</button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.pending-companies {
  min-width: 400px;
  max-width: 100%;
}

h2 {
  color: var(--red-esigelec);
  text-align: center;
  margin-bottom: 20px;
}

.empty {
  color: var(--gray-dark);
  text-align: center;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.submitted-by {
  font-size: 0.85em;
  color: var(--gray-dark);
  margin: 6px 0 0 0;
}

.pending-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.review-button,
.reject-button,
.back-button {
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.review-button {
  flex: 1;
  background-color: var(--red-esigelec);
  color: var(--white);
  border: none;
}

.review-button:hover {
  background-color: var(--red-btn-hover);
}

.reject-button {
  flex: 1;
  background-color: transparent;
  color: var(--red-esigelec);
  border: 2px solid var(--red-esigelec);
}

.reject-button:hover {
  background-color: var(--red-esigelec);
  color: var(--white);
}

.back-button {
  background: none;
  border: none;
  color: var(--red-esigelec);
  margin-bottom: 15px;
  padding: 0;
}

.back-button:hover {
  text-decoration: underline;
}
</style>
