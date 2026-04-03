<script setup>
/**
 * Composant ListCompanies
 * Affiche une liste cliquable d'entreprises
 * Permet la visualisation des détails complets d'une entreprise via une modale
 */

import { ref } from 'vue'
import CompanyItem from './CompanyItem.vue'
import ModalCompany from './ModalCompany.vue'
import CompanyInformations from './CompanyInformations.vue'

// Props et événements
const props = defineProps({
  companies: {
    type: Array,
    required: true
  },
  sidebarOpen: {
    type: Boolean,
    default: false,
  },
  language: {
    type: String,
    default: 'fr'
  },
  currentUser: {
    type: Object,
    default: null,
  },
  currentUserProfile: {
    type: Object,
    default: null,
  }
})

const emit = defineEmits(['refresh'])

// État local
const isModalOpen = ref(false)
const selectedCompany = ref(null)

/**
 * Ouvre la modale affichant les détails complèts d'une entreprise
 * @param {Object} company - L'entreprise à afficher
 */
const openModal = (company) => {
  isModalOpen.value = true
  selectedCompany.value = company
}

/**
 * Ferme la modale de détails
 */
const closeModal = () => {
  isModalOpen.value = false
  selectedCompany.value = null
}

/**
 * Gère l'événement de suppression d'une entreprise
 * Ferme la modale et rafraîchit la liste
 */
const handleDelete = () => {
  closeModal()
  emit('refresh')
}

/**
 * Rafraîchit les données sans fermer la modale (ex: ajout d'avis).
 */
const handleRefresh = () => {
  emit('refresh')
}

/**
 * Gère l'événement de modification non implémentée pour l'instant
 */
const handleEdit = (company) => {
  // À implémenter: formulaire d'édition
  console.log('Édition de:', company.name)
}
</script>

<template>
  <!-- Liste des entreprises -->
  <ul class="companies-list">
    <!-- Chaque élément de la liste est cliquable pour ouvrir les détails -->
    <li
      v-for="company in companies"
      :key="company.id"
      @click="openModal(company)"
      class="company-list-item"
    >
      <CompanyItem
        :language="props.language"
        :speciality="company.speciality"
        :name="company.name"
        :city="company.city"
        :country="company.country"
        :pc="company.pc.toString()"
      />
    </li>
  </ul>

  <!-- Modale affichant les détails complets de l'entreprise sélectionnée -->
  <ModalCompany
    :isOpen="isModalOpen"
    :sidebarOffset="props.sidebarOpen ? 400 : 0"
    :language="props.language"
    @close="closeModal"
  >
    <CompanyInformations
      v-if="selectedCompany"
      :company="selectedCompany"
      :language="props.language"
      :currentUser="props.currentUser"
      :currentUserProfile="props.currentUserProfile"
      @refresh="handleRefresh"
      @delete="handleDelete"
      @edit="handleEdit"
    />
  </ModalCompany>
</template>

<style scoped>
.companies-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.company-list-item {
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.company-list-item:hover {
  transform: translateX(-4px);
}
</style>

