<script setup>
/**
 * Composant ListeDeroulante (Sidebar)
 * Affiche la barre latérale avec la liste des entreprises
 * Fournit des filtres par spécialité et une barre de recherche
 * Permet l'ajout/suppression d'entreprises via une modale
 */

import { onMounted, ref, computed, watch } from 'vue'
import {
  approveCompany,
  getPendingCompanies,
  getPublicCompanies,
  searchCompanies,
} from '../services/companyService'
import Modal from './Modal.vue'
import AddCompanyForm from './AddCompanyForm.vue'
import ListCompanies from './ListCompanies.vue'
import { getI18n, SPECIALITY_OPTIONS } from '../constants/i18n'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

// Props et événements
const props = defineProps({
  isOpen: Boolean, // Indique si la sidebar est ouverte
  visibleCompanies: Array, // Entreprises visibles sur la carte (filtrées par zone)
  language: {
    type: String,
    default: 'fr'
  },
  refreshToken: {
    type: Number,
    default: 0,
  },
  currentUser: {
    type: Object,
    default: null,
  },
  userRole: {
    type: String,
    default: 'guest',
  },
})

const emit = defineEmits(['toggle', 'update-speciality', 'update-language', 'data-changed'])

// États du composant
const isModalOpen = ref(false)
const companies = ref([])
const pendingCompanies = ref([])
const selectedSpeciality = ref('')
const searchQuery = ref('') // Terme de recherche
const showAuthPanel = ref(false)
const showAdminPanel = ref(false)
const authEmail = ref('')
const authPassword = ref('')
const isRegisterMode = ref(false)
const authLoading = ref(false)
const authError = ref('')
const pendingActionCompanyId = ref('')
const adminMessage = ref('')
const adminError = ref('')

const ui = computed(() => getI18n(props.language))

const roleLabel = computed(() => {
  if (props.userRole === 'admin') return ui.value.auth.admin
  if (props.userRole === 'user') return ui.value.auth.user
  return ui.value.auth.guest
})

const canCreateCompany = computed(() => props.userRole === 'user' || props.userRole === 'admin')

const isAdmin = computed(() => props.userRole === 'admin')

const specialityOptions = computed(() => {
  return SPECIALITY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.labels[props.language] || option.labels.fr
  }))
})

/**
 * Ouvre la modale d'ajout d'entreprise
 * Ferme la sidebar si elle est ouverte pour laisser de la place
 */
const openModal = () => {
  if (!canCreateCompany.value) {
    showAuthPanel.value = true
    authError.value = ui.value.auth.loginRequiredCreate
    return
  }
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
    const allCompanies = await getPublicCompanies()
    companies.value = allCompanies
    console.log(`✅ ${allCompanies.length} entreprises chargées`)
  } catch (error) {
    console.error('❌ Erreur lors du chargement des entreprises:', error)
  }
}

const fetchPendingCompaniesForAdmin = async () => {
  if (!isAdmin.value) {
    pendingCompanies.value = []
    return
  }

  try {
    pendingCompanies.value = await getPendingCompanies()
  } catch (error) {
    console.error('❌ Erreur lors du chargement de la liste d\'attente:', error)
    adminError.value = error.message || ui.value.admin.approveError
  }
}

const handleCompanyCreated = async () => {
  await fetchCompanies()
  await fetchPendingCompaniesForAdmin()
  emit('data-changed')
}

const toggleAuthPanel = () => {
  if (props.currentUser) {
    handleLogout()
    return
  }

  showAuthPanel.value = !showAuthPanel.value
}

const toggleAdminPanel = async () => {
  if (!isAdmin.value) return

  showAdminPanel.value = !showAdminPanel.value
  if (showAdminPanel.value) {
    await fetchPendingCompaniesForAdmin()
  }
}

const handleAuthSubmit = async () => {
  authError.value = ''
  adminMessage.value = ''

  if (!auth) {
    authError.value = ui.value.auth.firebaseConfigError
    return
  }

  if (!authEmail.value.trim() || !authPassword.value) {
    authError.value = ui.value.auth.authError
    return
  }

  try {
    authLoading.value = true
    if (isRegisterMode.value) {
      await createUserWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value)
    } else {
      await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value)
    }
    authPassword.value = ''
    showAuthPanel.value = false
  } catch (error) {
    console.error('❌ Erreur auth:', error)
    authError.value = error.message || ui.value.auth.authError
  } finally {
    authLoading.value = false
  }
}

const handleLogout = async () => {
  if (!auth) {
    authError.value = ui.value.auth.firebaseConfigError
    return
  }

  try {
    await signOut(auth)
    authPassword.value = ''
    adminMessage.value = ''
    showAuthPanel.value = false
  } catch (error) {
    console.error('❌ Erreur lors de la deconnexion:', error)
    authError.value = error.message || ui.value.auth.authError
  }
}

const approvePendingCompany = async (companyId) => {
  if (!props.currentUser?.uid || !isAdmin.value) return

  adminError.value = ''
  adminMessage.value = ''
  pendingActionCompanyId.value = companyId

  try {
    await approveCompany(companyId, props.currentUser)
    adminMessage.value = ui.value.admin.approvedSuccess
    await fetchCompanies()
    await fetchPendingCompaniesForAdmin()
    emit('data-changed')
  } catch (error) {
    console.error('❌ Erreur validation admin:', error)
    adminError.value = error.message || ui.value.admin.approveError
  } finally {
    pendingActionCompanyId.value = ''
  }
}

watch(
  () => props.currentUser,
  (newUser) => {
    if (newUser) {
      showAuthPanel.value = false
    }
  }
)

watch(
  () => props.userRole,
  (newRole) => {
    if (newRole !== 'admin') {
      showAdminPanel.value = false
    }
  }
)

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
  const selectedLabel = specialityOptions.value.find(
    (option) => option.value === selectedSpeciality.value
  )?.label;

  return {
    total: companies.value.length,
    visible: filteredCompanies.value.length,
    selected: selectedLabel || specialityOptions.value[0].label
  }
})

/**
 * Bascule l'ouverture/fermeture de la sidebar
 */
function toggleSideBar() {
  emit('toggle')
}

// Charger les entreprises au montage du composant
onMounted(async () => {
  await fetchCompanies()
  await fetchPendingCompaniesForAdmin()
})

watch(
  () => props.refreshToken,
  async () => {
    await fetchCompanies()
    await fetchPendingCompaniesForAdmin()
  }
)

watch(
  () => props.userRole,
  async () => {
    await fetchCompanies()
    await fetchPendingCompaniesForAdmin()
  }
)
</script>

<template>
  <div>
    <!-- Barre latérale (Sidebar) -->
    <div
      class="sidebar"
      :class="{ closed: !props.isOpen }"
      :style="{ width: props.isOpen ? '400px' : '0' }">

      <div v-if="props.isOpen" class="connection-action">
        <button
          @click="toggleAuthPanel"
          class="refresh-button icon-button"
          :aria-label="props.currentUser ? ui.auth.logout : ui.auth.login"
          :title="props.currentUser ? ui.auth.logout : ui.auth.login"
        >
          <svg
            v-if="props.currentUser"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M21 3v18" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </div>

      <div v-if="props.isOpen && isAdmin" class="list-action">
        <button
          @click="toggleAdminPanel"
          class="refresh-button icon-button"
          :aria-label="ui.sidebar.pendingList"
          :title="ui.sidebar.pendingList"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      </div>

      <div v-if="props.isOpen" class="refresh-action">
        <button @click="fetchCompanies" class="refresh-button" :aria-label="ui.sidebar.refresh">⟳</button>
      </div>
      
      <!-- Sélecteur de langue -->
      <div v-if="props.isOpen" class="language-switch" :aria-label="ui.sidebar.languageLabel">
        <button
          class="lang-btn"
          :class="{ active: props.language === 'fr' }"
          @click="emit('update-language', 'fr')"
          type="button"
        >
          FR
        </button>
        <button
          class="lang-btn"
          :class="{ active: props.language === 'en' }"
          @click="emit('update-language', 'en')"
          type="button"
        >
          EN
        </button>
      </div>

      <div v-if="props.isOpen && canCreateCompany" class="add-company-action">
        <button @click="openModal" class="plus-button" :aria-label="ui.sidebar.addCompany">+</button>
      </div>

      <!-- En-tête -->
      <hr class="separator" />
      <h1>Find My Company</h1>

      <div v-if="props.isOpen && showAuthPanel" class="auth-panel">
        <div class="role-badge" :class="props.userRole">
          {{ roleLabel }}
        </div>

        <template v-if="props.currentUser">
          <p class="connected-as">{{ ui.auth.connectedAs }}: {{ props.currentUser.email }}</p>
          <button class="auth-btn secondary" type="button" @click="handleLogout">
            {{ ui.auth.logout }}
          </button>
        </template>

        <template v-else>
          <div class="auth-fields">
            <input
              v-model="authEmail"
              type="email"
              :placeholder="ui.auth.email"
              class="auth-input"
            />
            <input
              v-model="authPassword"
              type="password"
              :placeholder="ui.auth.password"
              class="auth-input"
            />
            <button
              class="auth-btn"
              type="button"
              :disabled="authLoading"
              @click="handleAuthSubmit"
            >
              {{ authLoading ? '...' : (isRegisterMode ? ui.auth.register : ui.auth.login) }}
            </button>
            <button
              class="auth-switch"
              type="button"
              @click="isRegisterMode = !isRegisterMode"
            >
              {{ isRegisterMode ? ui.auth.switchToLogin : ui.auth.switchToRegister }}
            </button>
          </div>
        </template>

        <p v-if="authError" class="auth-error">{{ authError }}</p>
      </div>

      <hr class="separator" />

      <!-- Barre de recherche -->
      <div v-if="props.isOpen" class="search-bar">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="ui.sidebar.searchPlaceholder"
          class="search-input"
          :aria-label="ui.sidebar.searchAria"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="clear-search"
          :title="ui.sidebar.clearSearch"
        >
          ✕
        </button>
      </div>

      <!-- Filtres -->
      <h2 v-if="props.isOpen" class="filter-title">{{ ui.sidebar.filters }}</h2>

      <!-- Filtre par spécialité -->
      <div v-if="props.isOpen" class="filter-bar">
        <label for="speciality-select" class="filter-label">{{ ui.sidebar.speciality }}</label>
        <select
          id="speciality-select"
          v-model="selectedSpeciality"
          @change="$emit('update-speciality', selectedSpeciality)"
          class="filter-select"
          :aria-label="ui.sidebar.specialityAria"
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
        🔄 {{ ui.sidebar.resetFilters }}
      </button>

      <!-- Statistiques de recherche -->
      <div v-if="props.isOpen && companies.length > 0" class="search-stats">
        <small>
          {{ filteredCompanies.length }} / {{ companies.length }} {{ ui.sidebar.companies }}
          <span v-if="selectedSpeciality" class="badge">{{ searchStats.selected }}</span>
        </small>
      </div>

      <div v-if="props.isOpen && isAdmin && showAdminPanel" class="admin-panel">
        <h2>{{ ui.admin.title }}</h2>
        <p class="admin-subtitle">{{ ui.admin.subtitle }}</p>
        <p v-if="adminMessage" class="admin-success">{{ adminMessage }}</p>
        <p v-if="adminError" class="admin-error">{{ adminError }}</p>

        <div v-if="pendingCompanies.length === 0" class="admin-empty">
          {{ ui.admin.noPending }}
        </div>

        <ul v-else class="pending-list">
          <li v-for="company in pendingCompanies" :key="company.id" class="pending-item">
            <div class="pending-main">
              <strong>{{ company.name }}</strong>
              <small>{{ company.city }}, {{ company.country }}</small>
              <small>
                {{ ui.admin.proposedBy }}: {{ company.createdByEmail || 'N/A' }}
              </small>
              <small v-if="company.createdAt">
                {{ ui.admin.proposedAt }}: {{ new Date(company.createdAt).toLocaleDateString(props.language) }}
              </small>
            </div>
            <button
              class="approve-btn"
              type="button"
              :disabled="pendingActionCompanyId === company.id"
              @click="approvePendingCompany(company.id)"
            >
              {{ pendingActionCompanyId === company.id ? ui.admin.approving : ui.admin.approve }}
            </button>
          </li>
        </ul>
      </div>

      <!-- Titre de la section -->
      <h2 v-if="props.isOpen && filteredCompanies.length > 0" class="companies-title">
        {{ ui.sidebar.companiesTitle }} ({{ filteredCompanies.length }})
      </h2>

      <!-- Message si aucune entreprise -->
      <div v-if="props.isOpen && filteredCompanies.length === 0" class="no-results">
        <p>{{ ui.sidebar.noResults }}</p>
        <button v-if="searchQuery || selectedSpeciality" @click="clearFilters" class="btn-clear">
          {{ ui.sidebar.reset }}
        </button>
      </div>

      <!-- Liste des entreprises filtrées -->
      <ListCompanies
        v-if="props.isOpen && filteredCompanies.length > 0"
        :companies="filteredCompanies"
        :sidebarOpen="props.isOpen"
        :language="props.language"
      />
    </div>

    <!-- Modale d'ajout d'entreprise -->
    <Modal :isOpen="isModalOpen" @close="closeModal">
      <AddCompanyForm
        :language="props.language"
        :currentUser="props.currentUser"
        @refresh="handleCompanyCreated"
        @close="closeModal"
      />
    </Modal>

    <!-- Bouton de basculement sidebar -->
    <button
      class="toggle-button"
      @click="toggleSideBar"
      :class="{ closed: !props.isOpen }"
      :style="{ left: props.isOpen ? '400px' : '0' }"
      :aria-label="props.isOpen ? ui.sidebar.closeMenu : ui.sidebar.openMenu"
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
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 32px;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  z-index: 2;
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

.auth-panel {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
  margin-top: 8px;
  background: #fafafa;
}

.role-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  padding: 4px 10px;
  margin-bottom: 8px;
}

.role-badge.guest {
  background: #f4f4f4;
  color: #666;
}

.role-badge.user {
  background: #e3f2fd;
  color: #1565c0;
}

.role-badge.admin {
  background: #ffe8cc;
  color: #b26b00;
}

.connected-as {
  margin: 0 0 8px;
  font-size: 12px;
  color: #555;
  word-break: break-all;
}

.auth-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 13px;
}

.auth-btn {
  border: none;
  background: var(--red-esigelec);
  color: #fff;
  border-radius: 6px;
  padding: 8px 10px;
  font-weight: 600;
  cursor: pointer;
}

.auth-btn.secondary {
  background: #666;
}

.auth-switch {
  border: none;
  background: transparent;
  color: var(--red-esigelec);
  text-align: left;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
}

.auth-error {
  margin: 8px 0 0;
  color: #b00020;
  font-size: 12px;
}

.admin-panel {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 14px;
  background: #fffdf9;
}

.admin-subtitle {
  margin: 0 0 10px;
  font-size: 12px;
  color: #555;
}

.admin-success {
  color: #1b5e20;
  font-size: 12px;
}

.admin-error {
  color: #b00020;
  font-size: 12px;
}

.admin-empty {
  font-size: 13px;
  color: #666;
}

.pending-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pending-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.pending-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pending-main small {
  color: #666;
  font-size: 11px;
}

.approve-btn {
  border: none;
  border-radius: 6px;
  background: #2e7d32;
  color: #fff;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.approve-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  left: 15px;
}

.refresh-action {
  position: absolute;
  top: -2px;
  right: 30px;
}

.icon-button {
  padding: 0;
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
