<script setup>
/**
 * Composant ListeDeroulante (Sidebar)
 * Affiche la barre latérale avec la liste des entreprises
 * Fournit des filtres par spécialité et une barre de recherche
 * Permet l'ajout/suppression d'entreprises via une modale
 */

import { onBeforeUnmount, onMounted, ref, computed, watch, nextTick } from 'vue'
import {
  approveCompany,
  rejectCompany,
  updateCompany,
  getPendingCompanies,
  getPublicCompanies,
  searchCompanies,
} from '../services/companyService'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Modal from './Modal.vue'
import AddCompanyForm from './AddCompanyForm.vue'
import ListCompanies from './ListCompanies.vue'
import { getI18n, SPECIALITY_OPTIONS } from '../constants/i18n'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'
import { upsertUserProfile } from '../services/userProfileService'

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
  currentUserProfile: {
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
const selectedCountry = ref('')
const selectedSector = ref('')
const selectedRating = ref('')
const selectedCity = ref('')
const modifiedRecentlyOnly = ref(false)
const searchQuery = ref('') // Terme de recherche
const isFiltersPanelOpen = ref(false)
const showAuthPanel = ref(false)
const showAdminPanel = ref(false)
const authFirstName = ref('')
const authLastName = ref('')
const authEmail = ref('')
const authPassword = ref('')
const isRegisterMode = ref(false)
const authLoading = ref(false)
const authError = ref('')
const pendingActionCompanyId = ref('')
const pendingRejectCompanyId = ref('')
const adminMessage = ref('')
const adminError = ref('')
const selectedPendingCompany = ref(null)
const isPendingDetailsOpen = ref(false)
const isEditPendingMode = ref(false)
const pendingEditLoading = ref(false)
const pendingEditForm = ref({
  name: '',
  speciality: '',
  address: '',
  city: '',
  country: '',
  pc: '',
  website: '',
  lastHiringDate: '',
  tutorName: '',
  tutorEmail: '',
  tutorPhone: '',
  hrName: '',
  hrEmail: '',
  hrPhone: '',
  description: '',
  sectorsText: '',
  x: '',
  y: '',
})
const pendingMapContainer = ref(null)

let pendingMap = null
let pendingMapMarker = null

const ui = computed(() => getI18n(props.language))

const roleLabel = computed(() => {
  if (props.userRole === 'admin') return ui.value.auth.admin
  if (props.userRole === 'user') return ui.value.auth.user
  return ui.value.auth.guest
})

const connectedAccountLabel = computed(() => {
  if (!props.currentUser) return ''

  const firstName = props.currentUserProfile?.firstName?.trim() || ''
  const lastName = props.currentUserProfile?.lastName?.trim() || ''
  const profileDisplayName = `${firstName} ${lastName}`.trim()

  if (profileDisplayName) return profileDisplayName
  if (props.currentUserProfile?.displayName?.trim()) return props.currentUserProfile.displayName
  if (props.currentUser.displayName?.trim()) return props.currentUser.displayName

  return ui.value.auth.connectedUserFallback
})

const canCreateCompany = computed(() => props.userRole === 'user' || props.userRole === 'admin')

const isAdmin = computed(() => props.userRole === 'admin')

const pendingCompanyCoordinatesValid = computed(() => {
  const latitude = Number(isEditPendingMode.value ? pendingEditForm.value.x : selectedPendingCompany.value?.x)
  const longitude = Number(isEditPendingMode.value ? pendingEditForm.value.y : selectedPendingCompany.value?.y)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
})

const adminEditableSpecialityOptions = computed(() => {
  return specialityOptions.value.filter((option) => option.value !== '')
})

const pendingCompanyExtraEntries = computed(() => {
  const company = selectedPendingCompany.value
  if (!company) return []

  const hiddenKeys = new Set([
    'id',
    'name',
    'speciality',
    'address',
    'city',
    'country',
    'pc',
    'x',
    'y',
    'description',
    'sectors',
    'website',
    'logo_url',
    'lastHiringDate',
    'tutorName',
    'tutorEmail',
    'tutorPhone',
    'hrName',
    'hrEmail',
    'hrPhone',
    'createdAt',
    'updatedAt',
    'createdByEmail',
    'createdByUid',
    'status',
    'validatedAt',
    'validatedByUid',
    'validatedByEmail',
    'studentRatings',
  ])

  return Object.entries(company)
    .filter(([key]) => !hiddenKeys.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
})

const formatTechnicalFieldLabel = (key) => {
  const labelMap = {
    id: ui.value.admin.identifier,
    status: ui.value.admin.status,
    createdByEmail: ui.value.admin.createdByEmail,
    createdByUid: ui.value.admin.createdByUid,
    createdAt: ui.value.admin.createdAt,
    updatedAt: ui.value.admin.updatedAt,
    validatedAt: ui.value.admin.validatedAt,
    validatedByUid: ui.value.admin.validatedByUid,
    validatedByEmail: ui.value.admin.validatedByEmail,
  }

  return labelMap[key] || key
}

const specialityOptions = computed(() => {
  return SPECIALITY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.labels[props.language] || option.labels.fr
  }))
})

const countryOptions = computed(() => {
  const countries = Array.from(
    new Set(
      companies.value
        .map((company) => company.country)
        .filter((country) => typeof country === 'string' && country.trim())
        .map((country) => country.trim())
    )
  ).sort((a, b) => a.localeCompare(b, props.language))

  return countries.map((country) => ({ value: country, label: country }))
})

const cityOptions = computed(() => {
  const cities = Array.from(
    new Set(
      companies.value
        .map((company) => company.city)
        .filter((city) => typeof city === 'string' && city.trim())
        .map((city) => city.trim())
    )
  ).sort((a, b) => a.localeCompare(b, props.language))

  return cities.map((city) => ({ value: city, label: city }))
})

const sectorOptions = computed(() => {
  const sectors = Array.from(
    new Set(
      companies.value
        .flatMap((company) => (Array.isArray(company.sectors) ? company.sectors : []))
        .filter((sector) => typeof sector === 'string' && sector.trim())
        .map((sector) => sector.trim())
    )
  ).sort((a, b) => a.localeCompare(b, props.language))

  return sectors.map((sector) => ({ value: sector, label: sector }))
})

const ratingOptions = computed(() => {
  return [
    { value: '', label: ui.value.sidebar.allRatings },
    { value: '4.5', label: `${ui.value.sidebar.ratingAtLeast} 4.5` },
    { value: '4', label: `${ui.value.sidebar.ratingAtLeast} 4` },
    { value: '3', label: `${ui.value.sidebar.ratingAtLeast} 3` },
  ]
})

const activeFiltersCount = computed(() => {
  return [
    selectedSpeciality.value,
    selectedCountry.value,
    selectedSector.value,
    selectedRating.value,
    selectedCity.value,
    searchQuery.value.trim(),
    modifiedRecentlyOnly.value,
  ].filter(Boolean).length
})

const hasActiveFilters = computed(() => activeFiltersCount.value > 0)

const toDateValue = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getCompanyAverageRating = (company) => {
  if (!Array.isArray(company.studentRatings) || company.studentRatings.length === 0) {
    return 0
  }

  const validRatings = company.studentRatings
    .map((entry) => Number(entry?.rating))
    .filter((rating) => Number.isFinite(rating))

  if (validRatings.length === 0) return 0

  const total = validRatings.reduce((sum, rating) => sum + rating, 0)
  return total / validRatings.length
}

const normalizeEmail = (email) => email.trim().toLowerCase()

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const mapAuthError = (error) => {
  const code = error?.code || ''

  if (code === 'auth/invalid-email') return ui.value.auth.invalidEmail
  if (code === 'auth/email-already-in-use') return ui.value.auth.emailAlreadyInUse
  if (code === 'auth/user-not-found') return ui.value.auth.invalidCredentials
  if (code === 'auth/wrong-password') return ui.value.auth.invalidCredentials
  if (code === 'auth/invalid-credential') return ui.value.auth.invalidCredentials
  if (code === 'auth/weak-password') return ui.value.auth.weakPassword

  return ui.value.auth.authError
}

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

  if (isRegisterMode.value && (!authFirstName.value.trim() || !authLastName.value.trim())) {
    authError.value = ui.value.auth.nameRequired
    return
  }

  const email = normalizeEmail(authEmail.value)
  if (!isValidEmail(email)) {
    authError.value = ui.value.auth.invalidEmail
    return
  }

  try {
    authLoading.value = true
    if (isRegisterMode.value) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, authPassword.value)
      const firstName = authFirstName.value.trim()
      const lastName = authLastName.value.trim()
      const fullName = `${firstName} ${lastName}`.trim()

      if (fullName) {
        await updateProfile(userCredential.user, { displayName: fullName })
      }

      await upsertUserProfile({
        uid: userCredential.user.uid,
        email,
        firstName,
        lastName,
        displayName: fullName,
      })
    } else {
      await signInWithEmailAndPassword(auth, email, authPassword.value)
    }
    authFirstName.value = ''
    authLastName.value = ''
    authEmail.value = email
    authPassword.value = ''
    showAuthPanel.value = false
  } catch (error) {
    console.error('❌ Erreur auth:', error)
    authError.value = mapAuthError(error)
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
    authFirstName.value = ''
    authLastName.value = ''
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
  selectedCountry.value = ''
  selectedSector.value = ''
  selectedRating.value = ''
  selectedCity.value = ''
  modifiedRecentlyOnly.value = false
  emit('update-speciality', '')
}

const formatPendingValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return ui.value.companyInfo.notSpecified
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return ui.value.companyInfo.notSpecified
    return value.join(', ')
  }

  if (value instanceof Date) {
    return value.toLocaleDateString(props.language)
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

const formatPendingDate = (value) => {
  if (!value) return ui.value.companyInfo.notSpecified

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ui.value.companyInfo.notSpecified
  }

  return date.toLocaleDateString(props.language)
}

const normalizeDateInput = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const loadPendingEditForm = (company) => {
  pendingEditForm.value = {
    name: company?.name || '',
    speciality: company?.speciality || '',
    address: company?.address || '',
    city: company?.city || '',
    country: company?.country || '',
    pc: company?.pc || '',
    website: company?.website || '',
    lastHiringDate: normalizeDateInput(company?.lastHiringDate),
    tutorName: company?.tutorName || '',
    tutorEmail: company?.tutorEmail || '',
    tutorPhone: company?.tutorPhone || '',
    hrName: company?.hrName || '',
    hrEmail: company?.hrEmail || '',
    hrPhone: company?.hrPhone || '',
    description: company?.description || '',
    sectorsText: Array.isArray(company?.sectors) ? company.sectors.join(', ') : '',
    x: company?.x !== undefined && company?.x !== null ? String(company.x) : '',
    y: company?.y !== undefined && company?.y !== null ? String(company.y) : '',
  }
}

const openPendingDetails = async (company) => {
  if (props.isOpen) {
    emit('toggle')
  }
  isEditPendingMode.value = false
  selectedPendingCompany.value = company
  loadPendingEditForm(company)
  isPendingDetailsOpen.value = true
  await initPendingMap()
}

const openPendingEdit = async (company) => {
  await openPendingDetails(company)
  isEditPendingMode.value = true
}

const cancelPendingEdit = () => {
  isEditPendingMode.value = false
  if (selectedPendingCompany.value) {
    loadPendingEditForm(selectedPendingCompany.value)
  }
}

const savePendingEdit = async () => {
  if (!selectedPendingCompany.value?.id || !isAdmin.value) return

  if (!pendingEditForm.value.name.trim() || !pendingEditForm.value.speciality.trim() || !pendingEditForm.value.address.trim() || !pendingEditForm.value.city.trim() || !pendingEditForm.value.country.trim() || !pendingEditForm.value.pc.trim()) {
    adminError.value = ui.value.admin.editValidationError
    return
  }

  const latitude = Number.parseFloat(pendingEditForm.value.x)
  const longitude = Number.parseFloat(pendingEditForm.value.y)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    adminError.value = ui.value.addCompany.invalidCoordinates
    return
  }

  const sectors = pendingEditForm.value.sectorsText
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  adminError.value = ''
  adminMessage.value = ''

  try {
    pendingEditLoading.value = true
    await updateCompany(selectedPendingCompany.value.id, {
      name: pendingEditForm.value.name.trim(),
      speciality: pendingEditForm.value.speciality,
      address: pendingEditForm.value.address.trim(),
      city: pendingEditForm.value.city.trim(),
      country: pendingEditForm.value.country.trim(),
      pc: pendingEditForm.value.pc.trim(),
      website: pendingEditForm.value.website.trim(),
      description: pendingEditForm.value.description.trim(),
      sectors,
      x: latitude,
      y: longitude,
      lastHiringDate: pendingEditForm.value.lastHiringDate || null,
      tutorName: pendingEditForm.value.tutorName.trim(),
      tutorEmail: pendingEditForm.value.tutorEmail.trim(),
      tutorPhone: pendingEditForm.value.tutorPhone.trim(),
      hrName: pendingEditForm.value.hrName.trim(),
      hrEmail: pendingEditForm.value.hrEmail.trim(),
      hrPhone: pendingEditForm.value.hrPhone.trim(),
    })

    await fetchCompanies()
    await fetchPendingCompaniesForAdmin()
    const refreshed = pendingCompanies.value.find((company) => company.id === selectedPendingCompany.value.id)
    if (refreshed) {
      selectedPendingCompany.value = refreshed
      loadPendingEditForm(refreshed)
    }
    isEditPendingMode.value = false
    adminMessage.value = ui.value.admin.editSuccess
    emit('data-changed')
  } catch (error) {
    console.error('❌ Erreur édition admin:', error)
    adminError.value = error.message || ui.value.admin.approveError
  } finally {
    pendingEditLoading.value = false
  }
}

const closePendingDetails = () => {
  isPendingDetailsOpen.value = false
  isEditPendingMode.value = false
  selectedPendingCompany.value = null
  destroyPendingMap()
}

const destroyPendingMap = () => {
  if (pendingMap) {
    pendingMap.remove()
    pendingMap = null
    pendingMapMarker = null
  }
}

const initPendingMap = async () => {
  if (!isPendingDetailsOpen.value || !pendingCompanyCoordinatesValid.value) {
    destroyPendingMap()
    return
  }

  await nextTick()

  if (!pendingMapContainer.value) return

  const latitude = Number(isEditPendingMode.value ? pendingEditForm.value.x : selectedPendingCompany.value.x)
  const longitude = Number(isEditPendingMode.value ? pendingEditForm.value.y : selectedPendingCompany.value.y)

  if (!pendingMap) {
    pendingMap = L.map(pendingMapContainer.value, {
      center: [latitude, longitude],
      zoom: 14,
      minZoom: 3,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(pendingMap)
  }

  pendingMap.setView([latitude, longitude], 14)

  if (pendingMapMarker) {
    pendingMapMarker.setLatLng([latitude, longitude])
  } else {
    pendingMapMarker = L.marker([latitude, longitude]).addTo(pendingMap)
  }

  pendingMapMarker.bindPopup(selectedPendingCompany.value.name || ui.value.admin.detailsTitle)
  pendingMap.invalidateSize()
}

const rejectPendingCompany = async (companyId) => {
  if (!props.currentUser?.uid || !isAdmin.value) return
  if (!window.confirm(ui.value.admin.confirmReject)) return

  adminError.value = ''
  adminMessage.value = ''
  pendingRejectCompanyId.value = companyId

  try {
    await rejectCompany(companyId, props.currentUser)
    adminMessage.value = ui.value.admin.rejectedSuccess
    if (selectedPendingCompany.value?.id === companyId) {
      closePendingDetails()
    }
    await fetchCompanies()
    await fetchPendingCompaniesForAdmin()
    emit('data-changed')
  } catch (error) {
    console.error('❌ Erreur refus admin:', error)
    adminError.value = error.message || ui.value.admin.rejectError
  } finally {
    pendingRejectCompanyId.value = ''
  }
}

/**
 * Calcule la liste des entreprises à afficher
 * Applique successivement:
 * 1. Filtrage par zone géographique visible (si disponible)
 * 2. Filtrage par spécialité
 * 3. Filtrage par recherche textuelle
 * 4. Filtrage par pays, ville et secteur
 * 5. Filtrage par date de modification
 * 6. Filtrage par note moyenne
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

  // Étape 4: Filtrer par pays, ville et secteur
  if (selectedCountry.value) {
    result = result.filter((company) => company.country === selectedCountry.value)
  }

  if (selectedCity.value) {
    result = result.filter((company) => company.city === selectedCity.value)
  }

  if (selectedSector.value) {
    result = result.filter((company) => Array.isArray(company.sectors) && company.sectors.includes(selectedSector.value))
  }

  // Étape 5: Filtrer sur les entreprises modifiées récemment
  if (modifiedRecentlyOnly.value) {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000
    result = result.filter((company) => {
      const updated = toDateValue(company.updatedAt)
      const created = toDateValue(company.createdAt)
      const referenceDate = updated || created
      return referenceDate ? referenceDate.getTime() >= threshold : false
    })
  }

  // Étape 6: Filtrer par note moyenne
  if (selectedRating.value) {
    const minRating = Number(selectedRating.value)
    result = result.filter((company) => getCompanyAverageRating(company) >= minRating)
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
    activeFilters: activeFiltersCount.value,
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

watch(
  () => selectedPendingCompany.value,
  async () => {
    if (!isPendingDetailsOpen.value) return
    await initPendingMap()
  }
)

watch(
  () => [pendingEditForm.value.x, pendingEditForm.value.y, isEditPendingMode.value],
  async () => {
    if (!isPendingDetailsOpen.value || !isEditPendingMode.value) return
    await initPendingMap()
  }
)

onBeforeUnmount(() => {
  destroyPendingMap()
})
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

      <div v-if="props.isOpen && props.currentUser" class="session-indicator">
        <span class="session-dot" aria-hidden="true"></span>
        <span class="session-text">
          {{ ui.auth.connectedAs }}: {{ connectedAccountLabel }}
        </span>
        <span v-if="props.userRole === 'admin'" class="session-role">{{ roleLabel }}</span>
      </div>

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
            <template v-if="isRegisterMode">
              <input
                v-model="authFirstName"
                type="text"
                :placeholder="ui.auth.firstName"
                class="auth-input"
              />
              <input
                v-model="authLastName"
                type="text"
                :placeholder="ui.auth.lastName"
                class="auth-input"
              />
            </template>
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

      <!-- Bandeau de filtres -->
      <div v-if="props.isOpen" class="filters-band">
        <button
          class="filters-toggle"
          type="button"
          @click="isFiltersPanelOpen = !isFiltersPanelOpen"
          :aria-expanded="String(isFiltersPanelOpen)"
          :aria-controls="'filters-panel'"
        >
          <span class="filters-toggle-title">{{ ui.sidebar.filters }}</span>
          <span v-if="activeFiltersCount > 0" class="filters-toggle-count">
            {{ activeFiltersCount }} {{ ui.sidebar.activeFilters }}
          </span>
          <span class="filters-toggle-icon" :class="{ open: isFiltersPanelOpen }" aria-hidden="true">▾</span>
        </button>

        <transition name="filters-slide">
          <div v-if="isFiltersPanelOpen" id="filters-panel" class="filters-panel">
            <div class="filter-bar">
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

            <div class="filter-bar">
              <label for="country-select" class="filter-label">{{ ui.sidebar.country }}</label>
              <select id="country-select" v-model="selectedCountry" class="filter-select" :aria-label="ui.sidebar.countryAria">
                <option value="">{{ ui.sidebar.allCountries }}</option>
                <option v-for="opt in countryOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="filter-bar">
              <label for="sector-select" class="filter-label">{{ ui.sidebar.sectors }}</label>
              <select id="sector-select" v-model="selectedSector" class="filter-select" :aria-label="ui.sidebar.sectorsAria">
                <option value="">{{ ui.sidebar.allSectors }}</option>
                <option v-for="opt in sectorOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="filter-bar">
              <label for="rating-select" class="filter-label">{{ ui.sidebar.rating }}</label>
              <select id="rating-select" v-model="selectedRating" class="filter-select" :aria-label="ui.sidebar.ratingAria">
                <option v-for="opt in ratingOptions" :key="opt.value || 'all-ratings'" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="filter-bar">
              <label for="city-select" class="filter-label">{{ ui.sidebar.city }}</label>
              <select id="city-select" v-model="selectedCity" class="filter-select" :aria-label="ui.sidebar.cityAria">
                <option value="">{{ ui.sidebar.allCities }}</option>
                <option v-for="opt in cityOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <label class="filter-checkbox">
              <input v-model="modifiedRecentlyOnly" type="checkbox" />
              <span>{{ ui.sidebar.recentlyUpdated }}</span>
            </label>
          </div>
        </transition>
      </div>

      <!-- Bouton réinitialiser filtres -->
      <button
        v-if="props.isOpen && hasActiveFilters"
        @click="clearFilters"
        class="btn-clear-filters"
      >
        🔄 {{ ui.sidebar.resetFilters }}
      </button>

      <!-- Statistiques de recherche -->
      <div v-if="props.isOpen && companies.length > 0" class="search-stats">
        <small>
          {{ filteredCompanies.length }} / {{ companies.length }} {{ ui.sidebar.companies }}
          <span v-if="searchStats.activeFilters > 0" class="badge">{{ searchStats.activeFilters }} {{ ui.sidebar.activeFilters }}</span>
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
                {{ ui.admin.proposedBy }}: {{ company.createdByEmail || ui.companyInfo.notSpecified }}
              </small>
              <small v-if="company.createdAt">
                {{ ui.admin.proposedAt }}: {{ new Date(company.createdAt).toLocaleDateString(props.language) }}
              </small>
            </div>
            <div class="pending-actions">
              <button
                class="details-btn"
                type="button"
                @click="openPendingDetails(company)"
              >
                {{ ui.admin.viewDetails }}
              </button>
              <button
                class="edit-btn"
                type="button"
                @click="openPendingEdit(company)"
              >
                {{ ui.admin.edit }}
              </button>
              <button
                class="approve-btn"
                type="button"
                :disabled="pendingActionCompanyId === company.id"
                @click="approvePendingCompany(company.id)"
              >
                {{ pendingActionCompanyId === company.id ? ui.admin.approving : ui.admin.approve }}
              </button>
              <button
                class="reject-btn"
                type="button"
                :disabled="pendingRejectCompanyId === company.id"
                @click="rejectPendingCompany(company.id)"
              >
                {{ pendingRejectCompanyId === company.id ? ui.admin.rejecting : ui.admin.reject }}
              </button>
            </div>
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
        :currentUser="props.currentUser"
        :currentUserProfile="props.currentUserProfile"
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

    <Modal
      :isOpen="isPendingDetailsOpen"
      @close="closePendingDetails"
    >
      <div v-if="selectedPendingCompany" class="pending-details-content">
        <h2>{{ isEditPendingMode ? ui.admin.editTitle : ui.admin.detailsTitle }}</h2>

        <div class="pending-modal-actions">
          <button
            v-if="!isEditPendingMode"
            class="edit-btn"
            type="button"
            @click="isEditPendingMode = true"
          >
            {{ ui.admin.edit }}
          </button>
          <template v-else>
            <button
              class="approve-btn"
              type="button"
              :disabled="pendingEditLoading"
              @click="savePendingEdit"
            >
              {{ pendingEditLoading ? ui.admin.editing : ui.admin.saveChanges }}
            </button>
            <button
              class="details-btn"
              type="button"
              :disabled="pendingEditLoading"
              @click="cancelPendingEdit"
            >
              {{ ui.admin.cancelEdit }}
            </button>
          </template>
        </div>

        <section class="pending-details-section">
          <h3>{{ ui.admin.generalInfo }}</h3>
          <div v-if="!isEditPendingMode" class="pending-details-grid">
            <p><strong>{{ ui.admin.identifier }}:</strong> {{ selectedPendingCompany.id }}</p>
            <p><strong>{{ ui.addCompany.name }}:</strong> {{ formatPendingValue(selectedPendingCompany.name) }}</p>
            <p><strong>{{ ui.companyInfo.speciality }}:</strong> {{ formatPendingValue(selectedPendingCompany.speciality) }}</p>
            <p><strong>{{ ui.companyInfo.address }}:</strong> {{ formatPendingValue(selectedPendingCompany.address) }}</p>
            <p><strong>{{ ui.companyInfo.city }}:</strong> {{ formatPendingValue(selectedPendingCompany.city) }}</p>
            <p><strong>{{ ui.companyInfo.country }}:</strong> {{ formatPendingValue(selectedPendingCompany.country) }}</p>
            <p><strong>{{ ui.companyInfo.postalCode }}:</strong> {{ formatPendingValue(selectedPendingCompany.pc) }}</p>
            <p><strong>{{ ui.companyInfo.website }}:</strong> {{ formatPendingValue(selectedPendingCompany.website) }}</p>
            <p><strong>{{ ui.companyInfo.lastHiringDate }}:</strong> {{ formatPendingDate(selectedPendingCompany.lastHiringDate) }}</p>
            <p><strong>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactName }}:</strong> {{ formatPendingValue(selectedPendingCompany.tutorName) }}</p>
            <p><strong>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactEmail }}:</strong> {{ formatPendingValue(selectedPendingCompany.tutorEmail) }}</p>
            <p><strong>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactPhone }}:</strong> {{ formatPendingValue(selectedPendingCompany.tutorPhone) }}</p>
            <p><strong>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactName }}:</strong> {{ formatPendingValue(selectedPendingCompany.hrName) }}</p>
            <p><strong>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactEmail }}:</strong> {{ formatPendingValue(selectedPendingCompany.hrEmail) }}</p>
            <p><strong>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactPhone }}:</strong> {{ formatPendingValue(selectedPendingCompany.hrPhone) }}</p>
            <p><strong>{{ ui.admin.status }}:</strong> {{ formatPendingValue(selectedPendingCompany.status) }}</p>
            <p><strong>{{ ui.admin.proposedBy }}:</strong> {{ formatPendingValue(selectedPendingCompany.createdByEmail) }}</p>
            <p><strong>{{ ui.admin.proposedAt }}:</strong> {{ formatPendingDate(selectedPendingCompany.createdAt) }}</p>
          </div>
          <div v-else class="pending-edit-grid">
            <label>{{ ui.addCompany.name }}
              <input v-model="pendingEditForm.name" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.speciality }}
              <select v-model="pendingEditForm.speciality" class="pending-edit-input">
                <option v-for="opt in adminEditableSpecialityOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </label>
            <label>{{ ui.companyInfo.address }}
              <input v-model="pendingEditForm.address" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.city }}
              <input v-model="pendingEditForm.city" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.country }}
              <input v-model="pendingEditForm.country" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.postalCode }}
              <input v-model="pendingEditForm.pc" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.website }}
              <input v-model="pendingEditForm.website" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.lastHiringDate }}
              <input v-model="pendingEditForm.lastHiringDate" type="date" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactName }}
              <input v-model="pendingEditForm.tutorName" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactEmail }}
              <input v-model="pendingEditForm.tutorEmail" type="email" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactPhone }}
              <input v-model="pendingEditForm.tutorPhone" type="tel" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactName }}
              <input v-model="pendingEditForm.hrName" type="text" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactEmail }}
              <input v-model="pendingEditForm.hrEmail" type="email" class="pending-edit-input" />
            </label>
            <label>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactPhone }}
              <input v-model="pendingEditForm.hrPhone" type="tel" class="pending-edit-input" />
            </label>
            <label>{{ ui.addCompany.latitude }}
              <input v-model="pendingEditForm.x" type="number" step="any" class="pending-edit-input" />
            </label>
            <label>{{ ui.addCompany.longitude }}
              <input v-model="pendingEditForm.y" type="number" step="any" class="pending-edit-input" />
            </label>
            <label class="pending-edit-full">{{ ui.companyInfo.sectors }}
              <input v-model="pendingEditForm.sectorsText" type="text" class="pending-edit-input" placeholder="Technologie, Sante" />
            </label>
            <label class="pending-edit-full">{{ ui.companyInfo.description }}
              <textarea v-model="pendingEditForm.description" rows="4" class="pending-edit-input"></textarea>
            </label>
          </div>
        </section>

        <section v-if="!isEditPendingMode" class="pending-details-section">
          <h3>{{ ui.companyInfo.description }}</h3>
          <p>{{ formatPendingValue(selectedPendingCompany.description) }}</p>
        </section>

        <section v-if="!isEditPendingMode" class="pending-details-section">
          <h3>{{ ui.companyInfo.sectors }}</h3>
          <p>{{ formatPendingValue(selectedPendingCompany.sectors) }}</p>
        </section>

        <section class="pending-details-section">
          <h3>{{ ui.admin.locationPreview }}</h3>
          <p>
            <strong>{{ ui.addCompany.latitude }}:</strong> {{ formatPendingValue(isEditPendingMode ? pendingEditForm.x : selectedPendingCompany.x) }}
            |
            <strong>{{ ui.addCompany.longitude }}:</strong> {{ formatPendingValue(isEditPendingMode ? pendingEditForm.y : selectedPendingCompany.y) }}
          </p>
          <div v-if="pendingCompanyCoordinatesValid" ref="pendingMapContainer" class="pending-map"></div>
          <p v-else class="admin-error">{{ ui.admin.coordinatesUnavailable }}</p>
        </section>

        <section v-if="!isEditPendingMode" class="pending-details-section">
          <h3>{{ ui.admin.technicalData }}</h3>
          <div v-if="pendingCompanyExtraEntries.length > 0" class="pending-extra-list">
            <p v-for="entry in pendingCompanyExtraEntries" :key="entry[0]">
              <strong>{{ formatTechnicalFieldLabel(entry[0]) }}:</strong> {{ formatPendingValue(entry[1]) }}
            </p>
          </div>
          <p v-else>{{ ui.companyInfo.notSpecified }}</p>
        </section>

        <section v-if="!isEditPendingMode" class="pending-details-section">
          <h3>{{ ui.admin.rawData }}</h3>
          <div class="pending-raw-data-list">
            <p><strong>{{ ui.admin.identifier }}:</strong> {{ selectedPendingCompany.id }}</p>
            <p><strong>{{ ui.addCompany.name }}:</strong> {{ formatPendingValue(selectedPendingCompany.name) }}</p>
            <p><strong>{{ ui.companyInfo.speciality }}:</strong> {{ formatPendingValue(selectedPendingCompany.speciality) }}</p>
            <p><strong>{{ ui.companyInfo.address }}:</strong> {{ formatPendingValue(selectedPendingCompany.address) }}</p>
            <p><strong>{{ ui.companyInfo.city }}:</strong> {{ formatPendingValue(selectedPendingCompany.city) }}</p>
            <p><strong>{{ ui.companyInfo.country }}:</strong> {{ formatPendingValue(selectedPendingCompany.country) }}</p>
            <p><strong>{{ ui.companyInfo.postalCode }}:</strong> {{ formatPendingValue(selectedPendingCompany.pc) }}</p>
            <p><strong>{{ ui.companyInfo.website }}:</strong> {{ formatPendingValue(selectedPendingCompany.website) }}</p>
            <p><strong>{{ ui.companyInfo.lastHiringDate }}:</strong> {{ formatPendingDate(selectedPendingCompany.lastHiringDate) }}</p>
            <p><strong>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactName }}:</strong> {{ formatPendingValue(selectedPendingCompany.tutorName) }}</p>
            <p><strong>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactEmail }}:</strong> {{ formatPendingValue(selectedPendingCompany.tutorEmail) }}</p>
            <p><strong>{{ ui.companyInfo.tutor }} {{ ui.companyInfo.contactPhone }}:</strong> {{ formatPendingValue(selectedPendingCompany.tutorPhone) }}</p>
            <p><strong>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactName }}:</strong> {{ formatPendingValue(selectedPendingCompany.hrName) }}</p>
            <p><strong>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactEmail }}:</strong> {{ formatPendingValue(selectedPendingCompany.hrEmail) }}</p>
            <p><strong>{{ ui.companyInfo.hr }} {{ ui.companyInfo.contactPhone }}:</strong> {{ formatPendingValue(selectedPendingCompany.hrPhone) }}</p>
            <p><strong>{{ ui.admin.status }}:</strong> {{ formatPendingValue(selectedPendingCompany.status) }}</p>
            <p><strong>{{ ui.admin.createdByEmail }}:</strong> {{ formatPendingValue(selectedPendingCompany.createdByEmail) }}</p>
            <p><strong>{{ ui.admin.validatedAt }}:</strong> {{ formatPendingDate(selectedPendingCompany.validatedAt) }}</p>
            <p><strong>{{ ui.admin.validatedByEmail }}:</strong> {{ formatPendingValue(selectedPendingCompany.validatedByEmail) }}</p>
          </div>
        </section>
      </div>
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

.session-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e7e7e7;
  border-radius: 8px;
  background: #f8fafc;
  margin: 8px 0 6px;
}

.session-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1fa35b;
  flex-shrink: 0;
}

.session-text {
  font-size: 12px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.session-role {
  font-size: 11px;
  font-weight: 700;
  color: var(--red-esigelec);
  border: 1px solid rgba(220, 53, 69, 0.25);
  border-radius: 999px;
  padding: 2px 8px;
  flex-shrink: 0;
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

.pending-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
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

.details-btn {
  border: 1px solid #1565c0;
  border-radius: 6px;
  background: #e3f2fd;
  color: #0d47a1;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.details-btn:hover {
  background: #d4e9ff;
}

.edit-btn {
  border: 1px solid #ef6c00;
  border-radius: 6px;
  background: #fff3e0;
  color: #bf360c;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.edit-btn:hover {
  background: #ffe7cc;
}

.reject-btn {
  border: none;
  border-radius: 6px;
  background: #c62828;
  color: #fff;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.reject-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pending-details-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--black);
}

.pending-modal-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pending-details-section {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
  color: var(--black);
}

.pending-details-section h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: var(--red-esigelec);
}

.pending-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 14px;
}

.pending-details-grid p,
.pending-extra-list p {
  margin: 0;
  font-size: 14px;
  word-break: break-word;
  color: var(--black);
}

.pending-edit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 14px;
}

.pending-edit-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--black);
}

.pending-edit-full {
  grid-column: 1 / -1;
}

.pending-edit-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  color: var(--black);
  font-size: 14px;
}

.pending-edit-input:focus {
  outline: none;
  border-color: var(--red-esigelec);
  box-shadow: 0 0 0 3px rgba(200, 16, 46, 0.12);
}

.pending-map {
  height: 280px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ddd;
  margin-top: 8px;
}

.pending-raw-data {
  margin: 0;
  background: #121212;
  color: #f6f6f6;
  border-radius: 8px;
  padding: 10px;
  max-height: 260px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.35;
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
  left: 45px;
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
.filters-band {
  margin-bottom: 12px;
}

.filters-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2px solid var(--red-esigelec);
  border-radius: 8px;
  background: linear-gradient(180deg, #fff, #f9f9f9);
  color: var(--red-esigelec);
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 700;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.filters-toggle:hover {
  background: #fff3f5;
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.12);
}

.filters-toggle-title {
  flex: 1;
  text-align: left;
}

.filters-toggle-count {
  font-size: 11px;
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--red-esigelec);
  color: #fff;
}

.filters-toggle-icon {
  font-size: 16px;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

.filters-toggle-icon.open {
  transform: rotate(180deg);
}

.filters-panel {
  border: 1px solid #ececec;
  border-top: 0;
  border-radius: 0 0 10px 10px;
  padding: 12px;
  background: #ffffff;
  display: grid;
  gap: 10px;
  margin-top: -2px;
}

.filter-bar {
  margin-bottom: 0;
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

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #333;
  font-size: 13px;
  font-weight: 600;
}

.filter-checkbox input {
  accent-color: var(--red-esigelec);
}

.filters-slide-enter-active,
.filters-slide-leave-active {
  transition: all 0.2s ease;
}

.filters-slide-enter-from,
.filters-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
