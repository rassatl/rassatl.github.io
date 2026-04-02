<script setup>
/**
 * Formulaire d'ajout d'entreprise avec géocodage d'adresse.
 * Inclut un sélecteur de calques et le positionnement manuel du marqueur.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createCompany } from '../services/companyService';
import { getI18n, MAP_LAYERS, SECTOR_OPTIONS, SPECIALITY_OPTIONS } from '../constants/i18n';

const props = defineProps({
  language: {
    type: String,
    default: 'fr',
  },
  currentUser: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'close']);
const ui = computed(() => getI18n(props.language));

const speciality = ref('');
const name = ref('');
const address = ref('');
const city = ref('');
const pc = ref('');
const country = ref('');
const description = ref('');
const website = ref('');
const sectors = ref([]);
const lastHiringDate = ref('');
const x = ref('');
const y = ref('');

const isLoading = ref(false);
const isGeocoding = ref(false);
const geocodingStatus = ref(''); // 'success' | 'error' | 'manual' | ''
const errorMessage = ref('');
const successMessage = ref('');

let map = null;
let marker = null;
let currentTileLayer = null;
let debounceTimeout = null;
const mapContainer = ref(null);

// ─── Définition des calques disponibles ───────────────────────────────────
const LAYERS = MAP_LAYERS;

const activeLayerId = ref('plan');
const layerPanelOpen = ref(false);

const localizedLayers = computed(() => {
  return LAYERS.map((layer) => ({
    ...layer,
    label: layer.labels[props.language] || layer.labels.fr,
  }));
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const specialityOptions = computed(() => {
  return SPECIALITY_OPTIONS.filter((item) => item.value !== '').map((item) => ({
    value: item.value,
    label: item.fullLabels?.[props.language] || item.fullLabels?.fr || item.value,
  }));
});

const sectorOptions = computed(() => {
  return SECTOR_OPTIONS.map((item) => ({
    value: item.value,
    label: item.labels[props.language] || item.labels.fr,
  }));
});

// ─── Changer de calque ────────────────────────────────────────────────────
function switchLayer(layerDef) {
  if (!map) return;
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer);
  }
  currentTileLayer = L.tileLayer(layerDef.url, layerDef.options).addTo(map);
  currentTileLayer.bringToBack();
  activeLayerId.value = layerDef.id;
  layerPanelOpen.value = false;
}

// ─── Placement et mise à jour du marqueur ─────────────────────────────────
function setMarkerAndCoords(latLng, isManual = false) {
  if (!marker) {
    marker = L.marker(latLng, { icon: redIcon, draggable: true }).addTo(map);
    
    // Écouteur pour la fin du glisser-déposer (drag)
    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      x.value = pos.lat.toFixed(6);
      y.value = pos.lng.toFixed(6);
      geocodingStatus.value = 'manual';
    });
  } else {
    marker.setLatLng(latLng);
  }
  
  x.value = latLng.lat.toFixed(6);
  y.value = latLng.lng.toFixed(6);
  
  if (isManual) {
    geocodingStatus.value = 'manual';
  }
}

// ─── Cycle de vie ─────────────────────────────────────────────────────────
onMounted(() => {
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419],
    zoom: 5,
    minZoom: 3,
    maxBounds: [[-90, -180], [90, 180]],
    worldCopyJump: false,
  });

  const defaultLayer = LAYERS.find((l) => l.id === 'plan');
  currentTileLayer = L.tileLayer(defaultLayer.url, defaultLayer.options).addTo(map);

  // Clic sur la carte = placer le point manuellement
  map.on('click', (e) => {
    layerPanelOpen.value = false;
    setMarkerAndCoords(e.latlng, true);
  });
});

onBeforeUnmount(() => {
  clearTimeout(debounceTimeout);
  if (map) {
    map.remove();
    map = null;
  }
});

// ─── Géocodage automatique ────────────────────────────────────────────────
watch([address, city, pc, country], ([newAddress, newCity, newPc, newCountry]) => {
  clearTimeout(debounceTimeout);

  if (![newAddress, newCity, newPc, newCountry].every((field) => field.trim() !== '')) {
    if (geocodingStatus.value !== 'manual') geocodingStatus.value = '';
    return;
  }

  // Ne pas écraser une position si l'utilisateur l'a placée manuellement récemment, 
  // sauf si l'adresse a significativement changé. On relance quand même le geocodage.
  debounceTimeout = setTimeout(async () => {
    const fullAddress = `${newAddress}, ${newPc} ${newCity}, ${newCountry}`;
    if (fullAddress.trim().length <= 10) return;

    isGeocoding.value = true;
    if (geocodingStatus.value !== 'manual') geocodingStatus.value = '';

    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(fullAddress)}&limit=1&lang=${props.language}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const features = data?.features;

      if (!Array.isArray(features) || features.length === 0) {
        geocodingStatus.value = 'error';
        errorMessage.value = ui.value.addCompany.addressNotFound;
        return;
      }

      const [lon, lat] = features[0].geometry.coordinates;
      const latLng = L.latLng(lat, lon);

      setMarkerAndCoords(latLng, false);
      map.setView(latLng, 15);
      
      geocodingStatus.value = 'success';
      errorMessage.value = '';
    } catch (error) {
      console.error('Erreur geocodage Photon:', error);
      geocodingStatus.value = 'error';
      errorMessage.value = ui.value.addCompany.geocodingFailed;
    } finally {
      isGeocoding.value = false;
    }
  }, 600);
});

// ─── Soumission du formulaire ─────────────────────────────────────────────
const isValidUrl = (value) => {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const validateForm = () => {
  errorMessage.value = '';

  const requiredFields = [
    { value: speciality.value, label: ui.value.addCompany.speciality },
    { value: name.value, label: ui.value.addCompany.name },
    { value: address.value, label: ui.value.addCompany.address },
    { value: city.value, label: ui.value.addCompany.city },
    { value: country.value, label: ui.value.addCompany.country },
    { value: pc.value, label: ui.value.addCompany.postalCode },
    { value: x.value, label: ui.value.addCompany.latitude },
    { value: y.value, label: ui.value.addCompany.longitude },
  ];

  const firstMissing = requiredFields.find((field) => !field.value && field.value !== 0);
  if (firstMissing) {
    errorMessage.value = `${firstMissing.label} ${ui.value.addCompany.required}.`;
    return false;
  }

  if (pc.value.trim().length < 3) {
    errorMessage.value = ui.value.addCompany.invalidPostalCode;
    return false;
  }

  if (!isValidUrl(website.value)) {
    errorMessage.value = ui.value.addCompany.invalidWebsite;
    return false;
  }

  const latitude = Number.parseFloat(x.value);
  const longitude = Number.parseFloat(y.value);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    errorMessage.value = ui.value.addCompany.invalidCoordinates;
    return false;
  }

  return true;
};

const resetForm = () => {
  speciality.value = '';
  name.value = '';
  address.value = '';
  city.value = '';
  country.value = '';
  pc.value = '';
  x.value = '';
  y.value = '';
  description.value = '';
  website.value = '';
  sectors.value = [];
  lastHiringDate.value = '';
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
  geocodingStatus.value = '';
};

const submitForm = async () => {
  if (!props.currentUser?.uid) {
    errorMessage.value = ui.value.auth.loginRequiredCreate;
    return;
  }

  if (!validateForm()) return;

  try {
    isLoading.value = true;
    errorMessage.value = '';

    await createCompany({
      speciality: speciality.value,
      name: name.value,
      address: address.value,
      city: city.value,
      country: country.value,
      pc: pc.value,
      x: x.value === '' ? null : Number.parseFloat(x.value),
      y: y.value === '' ? null : Number.parseFloat(y.value),
      description: description.value.trim(),
      sectors: sectors.value,
      website: website.value.trim(),
      lastHiringDate: lastHiringDate.value || null,
      createdByUid: props.currentUser.uid,
      createdByEmail: props.currentUser.email || '',
    });

    resetForm();
    successMessage.value = ui.value.addCompany.createdSuccess;
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    emit('refresh');
    emit('close');
  } catch (error) {
    console.error("Erreur lors de l'ajout:", error);
    errorMessage.value = error.message || ui.value.addCompany.createError;
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="form-map-wrapper">
    <form class="form-container" @submit.prevent="submitForm">
      <h2>{{ ui.addCompany.title }}</h2>

      <div v-if="errorMessage" class="alert alert-error">
        ❌ {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert-success">
        ✅ {{ successMessage }}
      </div>

      <div class="form-group">
        <label for="speciality">{{ ui.addCompany.speciality }} <span class="required">*</span></label>
        <select id="speciality" v-model="speciality" required>
          <option disabled value="">{{ ui.addCompany.selectSpeciality }}</option>
          <option v-for="spec in specialityOptions" :key="spec.value" :value="spec.value">
            {{ spec.label }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="name">{{ ui.addCompany.name }} <span class="required">*</span></label>
        <input id="name" v-model="name" type="text" :placeholder="ui.addCompany.examples.name" required />
      </div>

      <div class="form-group">
        <label for="country">{{ ui.addCompany.country }} <span class="required">*</span></label>
        <input id="country" v-model="country" type="text" :placeholder="ui.addCompany.examples.country" required />
      </div>

      <div class="form-group">
        <label for="city">{{ ui.addCompany.city }} <span class="required">*</span></label>
        <input id="city" v-model="city" type="text" :placeholder="ui.addCompany.examples.city" required />
      </div>

      <div class="form-group">
        <label for="address">{{ ui.addCompany.address }} <span class="required">*</span></label>
        <input id="address" v-model="address" type="text" :placeholder="ui.addCompany.examples.address" required />
      </div>

      <div class="form-group">
        <label for="pc">{{ ui.addCompany.postalCode }} <span class="required">*</span></label>
        <input id="pc" v-model="pc" type="text" :placeholder="ui.addCompany.examples.postalCode" required />
      </div>

      <section class="map-inline">
        <h3 class="map-title">{{ ui.addCompany.mapTitle }}</h3>
        <p class="map-subtitle">{{ ui.addCompany.mapSubtitlePrefix }} <strong>{{ ui.addCompany.mapSubtitleStrong }}</strong></p>

        <div v-if="isGeocoding" class="geocoding-status geocoding-loading">
          <span class="geocoding-spinner"></span> {{ ui.addCompany.geocodingLoading }}
        </div>
        <div v-else-if="geocodingStatus === 'success'" class="geocoding-status geocoding-success">
          {{ ui.addCompany.geocodingSuccess }} - {{ x }}, {{ y }}
        </div>
        <div v-else-if="geocodingStatus === 'manual'" class="geocoding-status geocoding-manual">
          {{ ui.addCompany.geocodingManual }} - {{ x }}, {{ y }}
        </div>
        <div v-else-if="geocodingStatus === 'error'" class="geocoding-status geocoding-error">
          {{ ui.addCompany.geocodingError }}
        </div>

        <div class="map-wrapper">
          <div class="mini-map" ref="mapContainer"></div>

          <div class="layer-switcher" @click.stop>
            <button
              type="button"
              class="layer-toggle-btn"
              :class="{ active: layerPanelOpen }"
              @click="layerPanelOpen = !layerPanelOpen"
              :title="ui.addCompany.changeMapType"
            >
              <div class="layer-thumb-wrap">
                <img
                  :src="localizedLayers.find(l => l.id === activeLayerId)?.thumb"
                  class="layer-thumb"
                  alt=""
                />
                <span class="layer-thumb-icon">
                  {{ localizedLayers.find(l => l.id === activeLayerId)?.icon }}
                </span>
              </div>
              <span class="layer-btn-label">{{ ui.addCompany.layers }}</span>
            </button>

            <Transition name="layer-panel">
              <div v-if="layerPanelOpen" class="layer-panel">
                <div class="layer-panel-title">{{ ui.addCompany.mapType }}</div>
                <div class="layer-options">
                  <button
                    type="button"
                    v-for="layer in localizedLayers"
                    :key="layer.id"
                    class="layer-option"
                    :class="{ selected: activeLayerId === layer.id }"
                    @click="switchLayer(layer)"
                    :title="layer.label"
                  >
                    <div class="layer-option-thumb-wrap">
                      <img :src="layer.thumb" class="layer-option-thumb" :alt="layer.label" />
                      <div v-if="activeLayerId === layer.id" class="layer-check">✓</div>
                    </div>
                    <span class="layer-option-label">{{ layer.label }}</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <div class="coord-grid">
        <div class="form-group">
          <label for="x">{{ ui.addCompany.latitude }} <span class="required">*</span></label>
          <input id="x" v-model="x" type="number" step="any" :placeholder="ui.addCompany.examples.latitude" required />
        </div>
        <div class="form-group">
          <label for="y">{{ ui.addCompany.longitude }} <span class="required">*</span></label>
          <input id="y" v-model="y" type="number" step="any" :placeholder="ui.addCompany.examples.longitude" required />
        </div>
      </div>

      <hr class="separator" />
      <h3>{{ ui.addCompany.additionalInfo }}</h3>

      <div class="form-group">
        <label for="description">{{ ui.addCompany.description }}</label>
        <textarea id="description" v-model="description" :placeholder="ui.addCompany.descriptionPlaceholder" rows="4"></textarea>
      </div>

      <div class="form-group">
        <label for="sectors">{{ ui.addCompany.sectors }}</label>
        <div class="checkbox-group">
          <label v-for="sector in sectorOptions" :key="sector.value" class="checkbox-label">
            <input type="checkbox" :value="sector.value" v-model="sectors" />
            {{ sector.label }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="website">{{ ui.addCompany.website }}</label>
        <input id="website" v-model="website" type="url" :placeholder="ui.addCompany.examples.website" />
      </div>

      <div class="form-group">
        <label for="lastHiringDate">{{ ui.addCompany.lastHiringDate }}</label>
        <input id="lastHiringDate" v-model="lastHiringDate" type="date" />
      </div>

      <button type="submit" class="submit-button" :disabled="isLoading">
        {{ isLoading ? ui.addCompany.adding : ui.addCompany.addButton }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.form-map-wrapper {
  display: block;
  width: 100%;
}

.form-map-wrapper,
.form-map-wrapper * {
  box-sizing: border-box;
}

.form-container {
  background: var(--white);
  padding: 25px;
  border-radius: 10px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--gray-white-light);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--black);
}

.required {
  color: var(--red-esigelec);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--gray-white-light);
  border-radius: 6px;
  font-size: 14px;
  background-color: var(--white);
  font-family: inherit;
  transition: border 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--red-esigelec);
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
}

.form-group textarea {
  resize: vertical;
}

.checkbox-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  min-width: 0;
}

.coord-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
  min-width: 0;
  word-break: break-word;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.separator {
  margin: 30px 0;
  border: none;
  border-top: 2px solid var(--gray-white-light);
}

h3 {
  color: var(--red-esigelec);
  margin: 20px 0 15px 0;
}

.alert {
  padding: 12px 15px;
  border-radius: 6px;
  margin-bottom: 15px;
  font-size: 14px;
}

.alert-error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.submit-button {
  width: 100%;
  padding: 12px;
  background-color: var(--red-esigelec);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
}

.submit-button:hover:not(:disabled) {
  background-color: #b8293f;
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.map-inline {
  margin: 10px 0 20px;
  min-width: 0;
  background: var(--white);
  border: 1px solid var(--gray-white-light);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-title {
  margin: 0;
  color: var(--red-esigelec);
  font-size: 1rem;
}

.map-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.geocoding-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 6px;
}

.geocoding-loading {
  color: #555;
  background: #f0f0f0;
}

.geocoding-success {
  color: #155724;
  background: #d4edda;
}

.geocoding-manual {
  color: #0c5460;
  background: #d1ecf1;
}

.geocoding-error {
  color: #856404;
  background: #fff3cd;
}

.geocoding-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #aaa;
  border-top-color: #555;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.map-wrapper {
  position: relative;
  width: 100%;
  height: clamp(260px, 32vh, 340px);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.mini-map {
  width: 100%;
  height: 100%;
}

/* ── Sélecteur de calques ────────────────────────────────────────── */
.layer-switcher {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: auto;
}

.layer-toggle-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 4px 4px 6px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 64px;
}

.layer-toggle-btn:hover,
.layer-toggle-btn.active {
  border-color: #4285f4;
  box-shadow: 0 2px 12px rgba(66, 133, 244, 0.4);
}

.layer-thumb-wrap {
  position: relative;
  width: 54px;
  height: 42px;
  border-radius: 5px;
  overflow: hidden;
}

.layer-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.layer-thumb-icon {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 15px;
  line-height: 1;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.7));
}

.layer-btn-label {
  font-size: 10px;
  font-weight: 700;
  color: #333;
  letter-spacing: 0.03em;
}

.layer-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
  padding: 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  min-width: 240px;
}

.layer-panel-title {
  font-size: 11px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.layer-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.layer-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 5px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.layer-option:hover {
  background: #f0f4ff;
  border-color: #aac4f7;
}

.layer-option.selected {
  border-color: #4285f4;
  background: #e8f0fe;
}

.layer-option-thumb-wrap {
  position: relative;
  width: 48px;
  height: 38px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.layer-option-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.layer-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(66, 133, 244, 0.6);
  color: white;
  font-size: 20px;
  font-weight: 700;
}

.layer-option-label {
  font-size: 10px;
  font-weight: 600;
  color: #333;
  text-align: center;
}

.layer-panel-enter-active,
.layer-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.layer-panel-enter-from,
.layer-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

@media (max-width: 1050px) {
  .form-container,
  .map-inline,
  .map-wrapper,
  .checkbox-group,
  .coord-grid {
    min-width: 0;
  }

  .coord-grid {
    grid-template-columns: 1fr;
  }

  .map-wrapper {
    height: clamp(220px, 30vh, 280px);
  }
}
</style>