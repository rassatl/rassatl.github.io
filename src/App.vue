<script setup>
import { ref } from 'vue'
import ListeDeroulante from './components/sidebar/ListeDeroulante.vue'
import MapComponent from './components/map/MapView.vue'
import HideContactInfo from './components/hide-contact/HideContactInfo.vue'
import VerifyAccountInfo from './components/verify-account/VerifyAccountInfo.vue'
import SiteInfo from './components/site-info/SiteInfo.vue'

// État centralisé pour l'ouverture de la sidebar : ouverte par défaut sur
// ordinateur et tablette, fermée sur téléphone pour laisser la carte visible.
const isOpen = ref(window.innerWidth > 768)
const visibleCompanies = ref([])
const selectedSpeciality = ref('');
const mapRef = ref(null)

// Lien "masquer mes informations" envoyé par email à un contact d'entreprise :
// ?hideContact=<companyId>:<contactId>:<token>. Résolu une fois au chargement
// (pas besoin d'un vrai routeur pour cette unique page publique annexe).
const params = new URLSearchParams(window.location.search)
const hideContactParam = params.get('hideContact')
const hideContactParts = (() => {
  if (!hideContactParam) return null
  const [companyId, contactId, token] = hideContactParam.split(':')
  return companyId && contactId && token ? { companyId, contactId, token } : null
})()

// Lien de vérification de compte étudiant envoyé par email (EmailJS, voir
// useEmailNotifications.js) : ?verifyAccount=<uid>:<token>. Même principe que
// hideContact ci-dessus.
const verifyAccountParam = params.get('verifyAccount')
const verifyAccountParts = (() => {
  if (!verifyAccountParam) return null
  const [uid, token] = verifyAccountParam.split(':')
  return uid && token ? { uid, token } : null
})()
</script>


<template>
  <HideContactInfo
    v-if="hideContactParts"
    :companyId="hideContactParts.companyId"
    :contactId="hideContactParts.contactId"
    :token="hideContactParts.token"
  />
  <VerifyAccountInfo
    v-else-if="verifyAccountParts"
    :uid="verifyAccountParts.uid"
    :token="verifyAccountParts.token"
  />
  <template v-else>
    <SiteInfo />
    <ListeDeroulante
      :isOpen="isOpen"
      :visibleCompanies="visibleCompanies"
      @toggle="isOpen = !isOpen"
      @update-speciality="selectedSpeciality = $event"
      @company-added="mapRef?.refreshCompanies()"
    />
    <MapComponent ref="mapRef" :selectedSpeciality="selectedSpeciality" @update-visible-companies="visibleCompanies = $event"/>
  </template>
</template>
 