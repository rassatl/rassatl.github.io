<script setup>
/**
 * Composant MapView
 * Affiche la carte interactive Leaflet avec tous les marqueurs des entreprises.
 * Inclut un sélecteur de calques style Google Maps (Plan / Satellite / Terrain / Sombre).
 */

import { onMounted, ref, watch, computed } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPublicCompanies } from '../services/companyService';
import { getI18n, MAP_LAYERS } from '../constants/i18n';

const mapContainer = ref(null);

const props = defineProps({
  isOpen: Boolean,
  selectedSpeciality: String,
  language: {
    type: String,
    default: 'fr',
  },
  refreshToken: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['update-visible-companies']);

const companies = ref([]);
let map = null;
let currentTileLayer = null;

const ui = computed(() => getI18n(props.language));

const localizedLayers = computed(() => {
  return MAP_LAYERS.map((layer) => ({
    ...layer,
    label: layer.labels[props.language] || layer.labels.fr,
  }));
});

const activeLayerId = ref('plan');
const layerPanelOpen = ref(false);

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

// ─── Marqueurs ────────────────────────────────────────────────────────────
const redIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function updateVisibleCompanies() {
  if (!map) return;
  const bounds = map.getBounds();
  const visibleCompanies = companies.value.filter(
    (c) =>
      (!props.selectedSpeciality || c.speciality === props.selectedSpeciality) &&
      c.x >= bounds.getSouth() &&
      c.x <= bounds.getNorth() &&
      c.y >= bounds.getWest() &&
      c.y <= bounds.getEast()
  );
  emit('update-visible-companies', visibleCompanies);
}

const clearMarkers = () => {
  companies.value.forEach((company) => {
    if (company.marker && map?.hasLayer(company.marker)) {
      company.marker.remove();
    }
  });
};

const fetchCompaniesAndAddMarkers = async () => {
  try {
    clearMarkers();
    const allCompanies = await getPublicCompanies();
    allCompanies.forEach((company) => {
      if (company.x && company.y && company.name) {
        const marker = L.marker([company.x, company.y], { icon: redIcon }).addTo(map);
        marker.bindPopup(`
          <div class="company-popup">
            <strong>${company.name}</strong><br>
            <small>${company.city}, ${company.country}</small>
          </div>
        `);
        company.marker = marker;
      }
    });
    companies.value = allCompanies;
    updateVisibleCompanies();
    console.log(`✅ ${allCompanies.length} entreprises chargées et affichées`);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des entreprises:', error);
  }
};

// ─── Initialisation ───────────────────────────────────────────────────────
onMounted(async () => {
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419],
    zoom: 5,
    minZoom: 3,
    maxBounds: [[-90, -180], [90, 180]],
    worldCopyJump: false,
  });

  const defaultLayer = localizedLayers.value.find((l) => l.id === 'plan');
  currentTileLayer = L.tileLayer(defaultLayer.url, defaultLayer.options).addTo(map);

  await fetchCompaniesAndAddMarkers();

  map.on('moveend', () => updateVisibleCompanies());
  map.on('zoomend', () => updateVisibleCompanies());
  map.on('resize', () => updateVisibleCompanies());
  map.on('click', () => { layerPanelOpen.value = false; });
});

watch(
  () => props.isOpen,
  () => {
    setTimeout(() => { if (map) map.invalidateSize(); }, 400);
  }
);

watch(
  () => props.selectedSpeciality,
  (newSpeciality) => {
    if (!map) return;
    companies.value.forEach((company) => {
      if (company.marker) {
        const shouldShow =
          !newSpeciality || company.speciality === newSpeciality;
        if (shouldShow) {
          if (!map.hasLayer(company.marker)) company.marker.addTo(map);
        } else {
          if (map.hasLayer(company.marker)) company.marker.remove();
        }
      }
    });
    updateVisibleCompanies();
  },
  { immediate: true }
);

watch(
  () => props.refreshToken,
  async () => {
    if (!map) return;
    await fetchCompaniesAndAddMarkers();
  }
);
</script>

<template>
  <div
    id="map"
    ref="mapContainer"
    class="map-container"
    :class="{ 'sidebar-open': props.isOpen, 'sidebar-closed': !props.isOpen }"
  >
    <!-- ── Sélecteur de calques style Google Maps ── -->
    <div class="layer-switcher" @click.stop>

      <!-- Bouton principal -->
      <button
        class="layer-toggle-btn"
        :class="{ active: layerPanelOpen }"
        @click="layerPanelOpen = !layerPanelOpen"
        :title="ui.map.switchMapType"
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
        <span class="layer-btn-label">{{ ui.map.layers }}</span>
      </button>

      <!-- Panneau des options -->
      <Transition name="layer-panel">
        <div v-if="layerPanelOpen" class="layer-panel">
          <div class="layer-panel-title">{{ ui.map.mapType }}</div>
          <div class="layer-options">
            <button
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
</template>

<style scoped>
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100%;
  transition: all 0.3s ease;
  z-index: 0;
  overflow: hidden;
}

:deep(.company-popup) {
  white-space: nowrap;
}

/* ── Sélecteur ────────────────────────────────────────────────────── */
.layer-switcher {
  position: absolute;
  bottom: 36px;
  right: 14px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  /* Empêche les clics de traverser vers Leaflet */
  pointer-events: auto;
}

/* Bouton principal */
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

/* Panneau */
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

/* Animation panneau */
.layer-panel-enter-active,
.layer-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.layer-panel-enter-from,
.layer-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
</style>
