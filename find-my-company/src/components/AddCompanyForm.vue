<script setup>
/**
 * Formulaire d'ajout d'entreprise avec géocodage d'adresse.
 * Inclut un sélecteur de calques et le positionnement manuel du marqueur.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createCompany } from '../services/companyService';

const emit = defineEmits(['refresh', 'close']);

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
const LAYERS = [
  {
    id: 'plan',
    label: 'Plan',
    icon: '🗺️',
    thumb: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/6/32/22.png',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    },
  },
  {
    id: 'satellite',
    label: 'Satellite',
    icon: '🛰️',
    thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/22/32',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
    },
  },
  {
    id: 'terrain',
    label: 'Terrain',
    icon: '🏔️',
    thumb: 'https://a.tile.opentopomap.org/6/32/22.png',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
      subdomains: 'abc',
      maxZoom: 17,
    },
  },
  {
    id: 'dark',
    label: 'Sombre',
    icon: '🌙',
    thumb: 'https://a.basemaps.cartocdn.com/dark_all/6/32/22.png',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    },
  },
];

const activeLayerId = ref('plan');
const layerPanelOpen = ref(false);

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const specialityOptions = [
  'Développement Logiciel, Tests et Qualité',
  'IA & Big Data',
];

const sectorOptions = [
  'Technologie',
  'Santé',
  'Finance',
  'Éducation',
  'Commerce',
  'Ressources Humaines',
  'Marketing',
  'Autre',
];

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
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(fullAddress)}&limit=1&lang=fr`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const features = data?.features;

      if (!Array.isArray(features) || features.length === 0) {
        geocodingStatus.value = 'error';
        errorMessage.value = 'Adresse non trouvée. Vérifiez les informations saisies.';
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
      errorMessage.value = "Erreur lors de la géolocalisation de l'adresse.";
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
    { value: speciality.value, label: 'Spécialité' },
    { value: name.value, label: 'Nom' },
    { value: address.value, label: 'Adresse' },
    { value: city.value, label: 'Ville' },
    { value: country.value, label: 'Pays' },
    { value: pc.value, label: 'Code postal' },
    { value: x.value, label: 'Latitude (x)' },
    { value: y.value, label: 'Longitude (y)' },
  ];

  const firstMissing = requiredFields.find((field) => !field.value && field.value !== 0);
  if (firstMissing) {
    errorMessage.value = `${firstMissing.label} est obligatoire.`;
    return false;
  }

  if (pc.value.trim().length < 3) {
    errorMessage.value = 'Code postal invalide.';
    return false;
  }

  if (!isValidUrl(website.value)) {
    errorMessage.value = 'URL du site web invalide (ex: https://exemple.com).';
    return false;
  }

  const latitude = Number.parseFloat(x.value);
  const longitude = Number.parseFloat(y.value);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    errorMessage.value = 'Latitude (x) et Longitude (y) doivent être des nombres valides.';
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
    });

    resetForm();
    successMessage.value = 'Entreprise ajoutée avec succès.';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    emit('refresh');
    emit('close');
  } catch (error) {
    console.error("Erreur lors de l'ajout:", error);
    errorMessage.value = error.message || "Erreur lors de la création de l'entreprise.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="form-map-wrapper">
    <form class="form-container" @submit.prevent="submitForm">
      <h2>Ajouter une entreprise</h2>

      <div v-if="errorMessage" class="alert alert-error">
        ❌ {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert-success">
        ✅ {{ successMessage }}
      </div>

      <div class="form-group">
        <label for="speciality">Spécialité <span class="required">*</span></label>
        <select id="speciality" v-model="speciality" required>
          <option disabled value="">-- Sélectionner une spécialité --</option>
          <option v-for="spec in specialityOptions" :key="spec" :value="spec">
            {{ spec }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="name">Nom <span class="required">*</span></label>
        <input id="name" v-model="name" type="text" placeholder="Ex: Google France" required />
      </div>

      <div class="form-group">
        <label for="country">Pays <span class="required">*</span></label>
        <input id="country" v-model="country" type="text" placeholder="Ex: France" required />
      </div>

      <div class="form-group">
        <label for="city">Ville <span class="required">*</span></label>
        <input id="city" v-model="city" type="text" placeholder="Ex: Paris" required />
      </div>

      <div class="form-group">
        <label for="address">Adresse <span class="required">*</span></label>
        <input id="address" v-model="address" type="text" placeholder="Ex: 123 Rue de la Paix" required />
      </div>

      <div class="form-group">
        <label for="pc">Code Postal <span class="required">*</span></label>
        <input id="pc" v-model="pc" type="text" placeholder="Ex: 75001" required />
      </div>

      <section class="map-inline">
        <h3 class="map-title">Localisation automatique</h3>
        <p class="map-subtitle">La carte se met à jour avec l'adresse. <strong>Vous pouvez aussi cliquer sur la carte ou glisser le marqueur pour ajuster.</strong></p>

        <div v-if="isGeocoding" class="geocoding-status geocoding-loading">
          <span class="geocoding-spinner"></span> Recherche de l'adresse en cours…
        </div>
        <div v-else-if="geocodingStatus === 'success'" class="geocoding-status geocoding-success">
          ✅ Adresse localisée — {{ x }}, {{ y }}
        </div>
        <div v-else-if="geocodingStatus === 'manual'" class="geocoding-status geocoding-manual">
          📍 Position ajustée manuellement — {{ x }}, {{ y }}
        </div>
        <div v-else-if="geocodingStatus === 'error'" class="geocoding-status geocoding-error">
          ⚠️ Adresse introuvable, vérifiez les champs ci-dessus
        </div>

        <div class="map-wrapper">
          <div class="mini-map" ref="mapContainer"></div>

          <div class="layer-switcher" @click.stop>
            <button
              type="button"
              class="layer-toggle-btn"
              :class="{ active: layerPanelOpen }"
              @click="layerPanelOpen = !layerPanelOpen"
              title="Changer le type de carte"
            >
              <div class="layer-thumb-wrap">
                <img
                  :src="LAYERS.find(l => l.id === activeLayerId)?.thumb"
                  class="layer-thumb"
                  alt=""
                />
                <span class="layer-thumb-icon">
                  {{ LAYERS.find(l => l.id === activeLayerId)?.icon }}
                </span>
              </div>
              <span class="layer-btn-label">Calques</span>
            </button>

            <Transition name="layer-panel">
              <div v-if="layerPanelOpen" class="layer-panel">
                <div class="layer-panel-title">Type de carte</div>
                <div class="layer-options">
                  <button
                    type="button"
                    v-for="layer in LAYERS"
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
          <label for="x">Latitude (x) <span class="required">*</span></label>
          <input id="x" v-model="x" type="number" step="any" placeholder="Ex: 48.8566" required />
        </div>
        <div class="form-group">
          <label for="y">Longitude (y) <span class="required">*</span></label>
          <input id="y" v-model="y" type="number" step="any" placeholder="Ex: 2.3522" required />
        </div>
      </div>

      <hr class="separator" />
      <h3>Informations complémentaires</h3>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea id="description" v-model="description" placeholder="Décrivez brièvement l'entreprise..." rows="4"></textarea>
      </div>

      <div class="form-group">
        <label for="sectors">Secteurs d'activité</label>
        <div class="checkbox-group">
          <label v-for="sector in sectorOptions" :key="sector" class="checkbox-label">
            <input type="checkbox" :value="sector" v-model="sectors" />
            {{ sector }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="website">Site web</label>
        <input id="website" v-model="website" type="url" placeholder="https://exemple.com" />
      </div>

      <div class="form-group">
        <label for="lastHiringDate">Dernière embauche</label>
        <input id="lastHiringDate" v-model="lastHiringDate" type="date" />
      </div>

      <button type="submit" class="submit-button" :disabled="isLoading">
        {{ isLoading ? 'Ajout en cours...' : 'Ajouter l\'entreprise' }}
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