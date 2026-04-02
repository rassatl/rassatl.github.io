<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import ListeDeroulante from './components/ListeDeroulante.vue'
import MapComponent from './components/MapView.vue'
import { DEFAULT_LANGUAGE } from './constants/i18n'
import { auth } from './firebase'

// État centralisé pour l'ouverture de la sidebar
const isOpen = ref(true)
const visibleCompanies = ref([])
const selectedSpeciality = ref('');
const language = ref(localStorage.getItem('site-language') || DEFAULT_LANGUAGE)
const refreshToken = ref(0)
const currentUser = ref(null)

const adminEmails = new Set(
  `${import.meta.env.VITE_ADMIN_EMAIL || ''}`
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

const userRole = computed(() => {
  if (!currentUser.value) return 'guest'
  const email = currentUser.value.email?.toLowerCase() || ''
  return adminEmails.has(email) ? 'admin' : 'user'
})

let stopAuthListener = () => {}

if (auth) {
  stopAuthListener = onAuthStateChanged(auth, (user) => {
    currentUser.value = user
  })
}

onBeforeUnmount(() => {
  stopAuthListener()
})

watch(language, (newLanguage) => {
  localStorage.setItem('site-language', newLanguage)
})

const onDataChanged = () => {
  refreshToken.value += 1
}

// Watcher pour logger les changements
// watch(isOpen, (newVal) => {
//   console.log('🧭 isOpen value changed:', newVal)
// })
// watcher pour visibleCompanies
// watch(visibleCompanies, (newVal) => {
//   console.log('🧭 visibleCompanies value changed:', visibleCompanies.value.length)
// })
</script>


<template>
  <ListeDeroulante
    :isOpen="isOpen"
    :visibleCompanies="visibleCompanies"
    :language="language"
    :refreshToken="refreshToken"
    :currentUser="currentUser"
    :userRole="userRole"
    @toggle="isOpen = !isOpen"
    @update-speciality="selectedSpeciality = $event"
    @update-language="language = $event"
    @data-changed="onDataChanged"
  />
  <MapComponent
    :isOpen="isOpen"
    :selectedSpeciality="selectedSpeciality"
    :language="language"
    :refreshToken="refreshToken"
    @update-visible-companies="visibleCompanies = $event"
  />
</template>
 