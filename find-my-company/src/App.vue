<script setup>
import { ref } from 'vue'
import ListeDeroulante from './components/ListeDeroulante.vue'
import MapComponent from './components/MapView.vue'

// État centralisé pour l'ouverture de la sidebar
const isOpen = ref(true)
const visibleCompanies = ref([])
const selectedSpeciality = ref('');
const mapRef = ref(null)
</script>


<template>
  <ListeDeroulante
    :isOpen="isOpen"
    :visibleCompanies="visibleCompanies"
    @toggle="isOpen = !isOpen"
    @update-speciality="selectedSpeciality = $event"
    @company-added="mapRef?.refreshCompanies()"
  />
  <MapComponent ref="mapRef" :selectedSpeciality="selectedSpeciality" @update-visible-companies="visibleCompanies = $event"/>
</template>
 