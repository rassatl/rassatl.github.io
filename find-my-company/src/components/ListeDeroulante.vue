<script setup>
/**
 * Composant ListeDeroulante (Sidebar)
 * Affiche la barre latérale avec la liste des entreprises
 * Fournit des filtres par spécialité et une barre de recherche
 * Permet l'ajout/suppression d'entreprises via une modale
 */

import { onMounted, ref, computed } from 'vue'
import { getAllCompanies, searchCompanies } from '../services/companyService'
import Modal from './Modal.vue'
import AddCompanyForm from './AddCompanyForm.vue'
import ListCompanies from './ListCompanies.vue'

// Props et événements
const props = defineProps({
  isOpen: Boolean, // Indique si la sidebar est ouverte
  visibleCompanies: Array // Entreprises visibles sur la carte (filtrées par zone)
})

const emit = defineEmits(['toggle', 'update-speciality'])

// États du composant
const isModalOpen = ref(false)
const companies = ref([])
const selectedSpeciality = ref('')
const searchQuery = ref('') // Terme de recherche
const language = ref('fr')

// Options de spécialités disponibles
const specialityOptions = [
  { value: '', label: 'Toutes' },
  { value: 'Développement Logiciel, Tests et Qualité', label: 'Développement Logiciel' },
  { value: 'IA & Big Data', label: 'IA & Big Data' }
]

/**
 * Ouvre la modale d'ajout d'entreprise
 * Ferme la sidebar si elle est ouverte pour laisser de la place
 */
const openModal = () => {
  isModalOpen.value = true
  if (props.isOpen) {
    emit('toggle')
  }
}

/**
 * Ferme la modale d'ajout d'entreprise
 */
const closeModal = () => {
  isModalOpen.value = false
}

/**
 * Rafraîchit la liste des entreprises depuis Firestore
 */
const fetchCompanies = async () => {
  try {
    const allCompanies = await getAllCompanies()
    companies.value = allCompanies
    console.log(`✅ ${allCompanies.length} entreprises chargées`)
  } catch (error) {
    console.error('❌ Erreur lors du chargement des entreprises:', error)
  }
}

/**
 * Réinitialise les filtres de recherche
 */
const clearFilters = () => {
  searchQuery.value = ''
  selectedSpeciality.value = ''
  emit('update-speciality', '')
}

/**
 * Calcule la liste des entreprises à afficher
 * Applique successivement:
 * 1. Filtrage par zone géographique visible (si disponible)
 * 2. Filtrage par spécialité
 * 3. Filtrage par recherche textuelle
 */
const filteredCompanies = computed(() => {
  // Étape 1: Utiliser soit les entreprises visibles sur la carte, soit toutes les entreprises
  let result = props.visibleCompanies?.length > 0
    ? props.visibleCompanies
    : companies.value

  // Étape 2: Filtrer par spécialité
  if (selectedSpeciality.value) {
    result = result.filter(c => c.speciality === selectedSpeciality.value)
  }

  // Étape 3: Filtrer par recherche textuelle
  if (searchQuery.value.trim()) {
    result = searchCompanies(searchQuery.value, result)
  }

  return result
})

/**
 * Affiche les statistiques de la recherche
 */
const searchStats = computed(() => {
  return {
    total: companies.value.length,
    visible: filteredCompanies.value.length,
    selected: selectedSpeciality.value || 'Toutes'
  }
})

/**
 * Bascule l'ouverture/fermeture de la sidebar
 */
function toggleSideBar() {
  emit('toggle')
}

// Charger les entreprises au montage du composant
onMounted(fetchCompanies)
</script>

<template>
  <div>
    <!-- Barre latérale (Sidebar) -->
    <div
      class="sidebar"
      :class="{ closed: !props.isOpen }"
      :style="{ width: props.isOpen ? '400px' : '0' }">

      <!-- Boutons visuels historiques de la sidebar -->
      <div v-if="props.isOpen" class="connection-action">
        <button @click="fetchCompanies" class="refresh-button" aria-label="Connexion">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-user"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
      </div>

      <div v-if="props.isOpen" class="list-action">
        <button @click="fetchCompanies" class="refresh-button" aria-label="Liste d'attente">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-list"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
      </div>

      <div v-if="props.isOpen" class="refresh-action">
        <button @click="fetchCompanies" class="refresh-button" aria-label="Rafraîchir">⟳</button>
      </div>

      <div v-if="props.isOpen" class="add-company-action">
        <button @click="openModal" class="plus-button" aria-label="Ajouter">+</button>
      </div>

      <!-- En-tête -->
      <hr class="separator" />
      <h1>Find My Company</h1>

      <!-- Sélecteur de langue -->
      <div v-if="props.isOpen" class="language-switch" aria-label="Choix de la langue">
        <button
          class="lang-btn"
          :class="{ active: language === 'fr' }"
          @click="language = 'fr'"
          type="button"
        >
          FR
        </button>
        <button
          class="lang-btn"
          :class="{ active: language === 'en' }"
          @click="language = 'en'"
          type="button"
        >
          EN
        </button>
      </div>

      <hr class="separator" />

      <!-- Barre de recherche -->
      <div v-if="props.isOpen" class="search-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher une entreprise..."
          class="search-input"
          aria-label="Rechercher une entreprise"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="clear-search"
          title="Effacer la recherche"
        >
          ✕
        </button>
      </div>

      <!-- Filtres -->
      <h2 v-if="props.isOpen" class="filter-title">Filtres</h2>

      <!-- Filtre par spécialité -->
      <div v-if="props.isOpen" class="filter-bar">
        <label for="speciality-select" class="filter-label">Spécialité:</label>
        <select
          id="speciality-select"
          v-model="selectedSpeciality"
          @change="$emit('update-speciality', selectedSpeciality)"
          class="filter-select"
          aria-label="Filtrer par spécialité"
        >
          <option
            v-for="opt in specialityOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Bouton réinitialiser filtres -->
      <button
        v-if="props.isOpen && (selectedSpeciality || searchQuery)"
        @click="clearFilters"
        class="btn-clear-filters"
      >
        🔄 Réinitialiser filtres
      </button>

      <!-- Statistiques de recherche -->
      <div v-if="props.isOpen && companies.length > 0" class="search-stats">
        <small>
          {{ filteredCompanies.length }} / {{ companies.length }} entreprises
          <span v-if="selectedSpeciality" class="badge">{{ searchStats.selected }}</span>
        </small>
      </div>

      <!-- Titre de la section -->
      <h2 v-if="props.isOpen && filteredCompanies.length > 0" class="companies-title">
        📋 Entreprises ({{ filteredCompanies.length }})
      </h2>

      <!-- Message si aucune entreprise -->
      <div v-if="props.isOpen && filteredCompanies.length === 0" class="no-results">
        <p>📭 Aucune entreprise ne correspond à vos filtres.</p>
        <button v-if="searchQuery || selectedSpeciality" @click="clearFilters" class="btn-clear">
          Réinitialiser
        </button>
      </div>

      <!-- Liste des entreprises filtrées -->
      <ListCompanies v-if="props.isOpen && filteredCompanies.length > 0" :companies="filteredCompanies" />
    </div>

    <!-- Modale d'ajout d'entreprise -->
    <Modal :isOpen="isModalOpen" @close="closeModal">
      <AddCompanyForm :language="language" @refresh="fetchCompanies" @close="closeModal" />
    </Modal>

    <!-- Bouton de basculement sidebar -->
    <button
      class="toggle-button"
      @click="toggleSideBar"
      :class="{ closed: !props.isOpen }"
      :style="{ left: props.isOpen ? '400px' : '0' }"
      :aria-label="props.isOpen ? 'Fermer le menu' : 'Ouvrir le menu'"
    >
      <span class="arrow" :class="props.isOpen ? 'left' : 'right'"></span>
    </button>
  </div>
</template>

<style scoped>
/* ========== TYPOGRAPHIE ========== */
h1 {
  font-size: 1.8rem;
  margin: 0;
  color: var(--red-esigelec);
  text-align: center;
  padding: 10px 0;
}

h2 {
  color: var(--red-esigelec);
  margin: 15px 0 10px 0;
  font-size: 1.1rem;
}

.filter-title {
  border-bottom: 2px solid var(--red-esigelec);
  padding-bottom: 8px;
}

.companies-title {
  border-bottom: 2px dotted var(--red-esigelec);
  padding-bottom: 8px;
}

.language-switch {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin: 6px 0 2px;
}

.lang-btn {
  border: 1px solid var(--red-esigelec);
  background: #fff;
  color: var(--red-esigelec);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.lang-btn.active {
  background: var(--red-esigelec);
  color: #fff;
}

/* ========== SÉPARATEURS ========== */
.separator {
  border: none;
  height: 3px;
  background: linear-gradient(90deg, var(--red-esigelec), transparent);
  margin: 10px 0;
  width: 100%;
}

/* ========== SIDEBAR ========== */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  background-color: var(--background-white);
  padding: 20px;
  overflow-y: auto;
  transition: transform 0.3s ease, width 0.3s ease;
  box-sizing: border-box;
  z-index: 1000;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.sidebar.closed {
  transform: translateX(-100%);
}

/* ========== BOUTONS HISTORIQUES ========== */
.add-company-action {
  position: absolute;
  top: -5px;
  right: 0;
}

.list-action {
  position: absolute;
  top: 0;
  left: 30px;
}

.connection-action {
  position: absolute;
  top: 0;
  left: 0;
}

.refresh-action {
  position: absolute;
  top: -2px;
  right: 30px;
}

.plus-button {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  font-size: 30px;
  font-weight: bold;
  color: var(--red-esigelec);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s ease, transform 0.3s ease;
  padding: 0;
  border-radius: 4px;
  outline: none;
}

.plus-button:focus,
.plus-button:focus:not(:focus-visible) {
  outline: none;
  box-shadow: none;
}

.plus-button:hover {
  color: var(--red-btn-hover);
  transform: scale(1.2);
}

.refresh-button {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  font-size: 22px;
  font-weight: bold;
  color: var(--red-esigelec);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s ease, transform 0.3s ease;
  padding: 0;
  border-radius: 4px;
  outline: none;
}

.refresh-button:hover {
  color: var(--red-btn-hover);
  transform: scale(1.2);
}

/* ========== BARRE DE RECHERCHE ========== */
.search-bar {
  position: relative;
  margin-bottom: 15px;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 35px 10px 15px;
  border: 2px solid var(--red-esigelec);
  border-radius: 6px;
  font-size: 14px;
  transition: box-shadow 0.3s;
}

.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
}

.clear-search {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 18px;
  padding: 5px;
}

.clear-search:hover {
  color: var(--red-esigelec);
}

/* ========== FILTRES ========== */
.filter-bar {
  margin-bottom: 15px;
}

.filter-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: var(--black);
  font-size: 0.9rem;
}

.filter-select {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 2px solid var(--red-esigelec);
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  cursor: pointer;
  transition: border-color 0.3s;
}

.filter-select:focus {
  outline: none;
  border-color: #ff6b6b;
}

.btn-clear-filters {
  width: 100%;
  padding: 10px;
  background: white;
  border: 2px dashed var(--red-esigelec);
  color: var(--red-esigelec);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 10px;
  transition: all 0.3s;
}

.btn-clear-filters:hover {
  background: var(--red-esigelec);
  color: white;
}

/* ========== STATISTIQUES ========== */
.search-stats {
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #666;
}

.badge {
  background: var(--red-esigelec);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 5px;
}

/* ========== RÉSULTATS VIDES ========== */
.no-results {
  text-align: center;
  padding: 30px 15px;
  color: #999;
}

.no-results p {
  margin-bottom: 15px;
  font-size: 14px;
}

.btn-clear {
  padding: 10px 20px;
  background: var(--red-esigelec);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s;
}

.btn-clear:hover {
  background: #b8293f;
}

/* ========== BOUTON DE BASCULEMENT SIDEBAR ========== */
.toggle-button {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 35px;
  height: 60px;
  background-color: var(--red-esigelec);
  border: none;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: left 0.3s ease, background-color 0.3s;
  z-index: 1001;
  box-shadow: 2px 0 6px rgba(0, 0, 0, 0.2);
}

.toggle-button:hover {
  background-color: #b8293f;
}

.arrow {
  border: solid white;
  border-width: 0 3px 3px 0;
  display: inline-block;
  padding: 5px;
}

.right {
  transform: rotate(-45deg);
}

.left {
  transform: rotate(135deg);
}

/* ========== SCROLLBAR PERSONNALISÉE ========== */
.sidebar::-webkit-scrollbar {
  width: 6px;
}

.sidebar::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.sidebar::-webkit-scrollbar-thumb {
  background: var(--red-esigelec);
  border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: #b8293f;
}
</style>
