<script setup>
import { ref, watch, onMounted, inject, computed, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder';
import { iconForSpeciality } from '../../../utils/mapIcons';
import MapLayerSwitcher from '../../map/MapLayerSwitcher.vue';
import { useErrorLogs } from '../../../composables/useErrorLogs.js';

// Mini-carte du formulaire confidentiel (visiteurs non connectés) : sans
// adresse détaillée, la ville/le pays ne font que recentrer la carte, le clic
// reste seul à poser précisément le repère (voir MiniMap.vue pour la version
// complète, qui géocode et place automatiquement depuis une adresse).

const t = inject('t')
const { logError } = useErrorLogs()
const props = defineProps({
  speciality: { type: String, default: '' },
  city: { type: String, default: '' },
  country: { type: String, default: '' },
  pendingCompany: { type: Object, default: null },
  // Incrémenté par le parent à chaque clic sur "Suivant" tant qu'aucun point
  // n'est placé, pour rejouer l'animation d'alerte à chaque tentative plutôt
  // qu'une seule fois.
  missingPinAttempt: { type: Number, default: 0 },
});

const x = defineModel('x', { default: '' })
const y = defineModel('y', { default: '' })

const mapContainer = ref(null);
const isPinPlaced = ref(false);
// Reste vrai tant qu'aucun point n'est placé, pour garder la carte et le
// texte en rouge entre deux tentatives ; `pinAlertPulse` ne sert lui qu'à
// rejouer l'animation à chaque nouvelle tentative (voir watch plus bas).
const missingPinWarning = computed(() => props.missingPinAttempt > 0 && !isPinPlaced.value);
const pinAlertPulse = ref(false);
watch(() => props.missingPinAttempt, async (value, previous) => {
  if (value <= previous) return;
  // On retire puis rajoute la classe d'animation pour la rejouer à chaque
  // clic sur "Suivant" : sans ce détour, une classe déjà présente ne
  // redéclenche pas l'animation CSS.
  pinAlertPulse.value = false;
  await nextTick();
  requestAnimationFrame(() => { pinAlertPulse.value = true; });
});
let map = null;
let marker = null;
let addressDebounceTimeout = null;
const isLoading = ref(false);

const geocode = async (params) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ ...params, format: 'json' })}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'FindMyCompany/1.0 (lou.rassat2003@gmail.com)'
    }
  });
  return response.json();
};

const activeLayerKey = ref('standard');
let layerInstances = {};
const layerOptions = computed(() => [
  { key: 'standard', label: t('mapLayers.standard'), thumbnail: 'https://a.tile.openstreetmap.org/5/16/11.png' },
  { key: 'satellite', label: t('mapLayers.satellite'), thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/11/16' },
  { key: 'dark', label: t('mapLayers.dark'), thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/5/11/16' },
  { key: 'terrain', label: t('mapLayers.terrain'), thumbnail: 'https://a.tile.opentopomap.org/5/16/11.png' },
]);

// Change le fond de carte affiché.
function selectLayer(key) {
  if (key === activeLayerKey.value || !layerInstances[key]) return;
  map.removeLayer(layerInstances[activeLayerKey.value]);
  map.addLayer(layerInstances[key]);
  activeLayerKey.value = key;
}

// Pose ou déplace le repère et synchronise les coordonnées du formulaire.
// Utilisé aussi bien par le recentrage automatique que par un ajustement
// manuel (glisser ou clic sur la carte).
const placeMarker = (latlng, { recenter = false } = {}) => {
  if (!marker) {
    marker = L.marker(latlng, { icon: iconForSpeciality(props.speciality), draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      x.value = pos.lat;
      y.value = pos.lng;
    });
  } else {
    marker.setLatLng(latlng);
  }

  isPinPlaced.value = true;
  x.value = latlng.lat;
  y.value = latlng.lng;

  if (recenter) {
    map.setView(latlng, 15);
  }
};

// Garde la couleur du repère cohérente avec la spécialité choisie.
watch(() => props.speciality, (newSpeciality) => {
  if (marker) {
    marker.setIcon(iconForSpeciality(newSpeciality));
  }
});

onMounted(() => {
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419],
    zoom: 5,
    minZoom: 3,
    maxBounds: [[-90, -180], [90, 180]],
    worldCopyJump: false,
  });

  // Plusieurs fonds de carte au choix (standard, satellite, sombre, relief),
  // comme sur la carte principale (voir MapView.vue).
  const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  });

  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  });

  const darkLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community',
    maxZoom: 16,
  });

  const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  });

  layerInstances = { standard: standardLayer, satellite: satelliteLayer, dark: darkLayer, terrain: terrainLayer };
  standardLayer.addTo(map);

  // Permet à l'utilisateur d'ajuster ou de placer le point manuellement
  // en cliquant directement sur la carte d'aperçu.
  map.on('click', (e) => placeMarker(e.latlng));

  // En mode révision, on affiche directement la position déjà soumise
  // plutôt que de relancer une recherche.
  if (props.pendingCompany) {
    placeMarker(L.latLng(props.pendingCompany.x, props.pendingCompany.y), { recenter: true });
  }
});

// Une fois ville et pays connus, on géocode et on place le point par défaut
// au centre de la ville : il n'y a pas d'adresse détaillée dans ce
// formulaire pour un emplacement plus précis, mais l'utilisateur peut
// toujours ajuster en glissant le repère ou en cliquant ailleurs sur la carte.
watch(() => [props.city, props.country], ([newCity, newCountry]) => {
  clearTimeout(addressDebounceTimeout);
  addressDebounceTimeout = setTimeout(async () => {
    if (![newCity, newCountry].every(field => field.trim() !== '')) {
      return;
    }

    isLoading.value = true;
    try {
      const results = await geocode({ city: newCity, country: newCountry });
      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        placeMarker(L.latLng(lat, lon), { recenter: true });
      } else {
        console.warn("Aucun résultat pour cette ville.");
      }
    } catch (error) {
      console.error("Erreur lors de l'appel à Nominatim:", error);
      logError(error, 'confidentialMiniMap:nominatim');
    } finally {
      isLoading.value = false;
    }
  }, 500);
});

// La mini-carte est cachée (v-show) entre les étapes : Leaflet calcule mal
// ses tuiles pendant qu'un conteneur est en display:none, il faut donc
// recalculer sa taille à chaque retour sur l'étape entreprise.
const invalidateSize = () => {
  if (map) setTimeout(() => map.invalidateSize(), 0);
};

defineExpose({ invalidateSize });
</script>

<template>
  <div class="mini-map-wrapper">
    <div class="mini-map-container" :class="{ 'missing-pin': missingPinWarning, pulse: pinAlertPulse }">
      <div class="mini-map" ref="mapContainer"></div>
      <MapLayerSwitcher :layers="layerOptions" :active="activeLayerKey" @select="selectLayer" />
    </div>
    <p
      class="map-hint"
      :class="{ 'map-hint-warning': missingPinWarning && !isPinPlaced, pulse: pinAlertPulse }"
    >
      <svg v-if="missingPinWarning && !isPinPlaced" class="warning-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {{ missingPinWarning ? t('addCompanyForm.mapMissingPinHint') : (isPinPlaced ? t('addCompanyForm.mapAdjustHint') : t('addCompanyForm.mapPlaceHintConfidential')) }}
    </p>
  </div>
</template>

<style scoped>
.mini-map-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 600px;
  flex-shrink: 0;
}

.mini-map-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 300px;
  /* Les panes internes de Leaflet montent jusqu'à z-index:700 ; sans ceci,
     ces valeurs remontent hors de la carte et passent devant le bouton de
     fermeture de la modale (z-index:10). isolation:isolate les enferme ici. */
  isolation: isolate;
}

.mini-map {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: crosshair;
  transition: outline-color 0.2s ease;
  outline: 3px solid transparent;
  outline-offset: 2px;
}

.mini-map-container.missing-pin .mini-map {
  outline-color: var(--red-esigelec);
}

.mini-map-container.pulse .mini-map {
  animation: pin-outline-pulse 1.2s ease-in-out 2;
}

@keyframes pin-outline-pulse {
  0%, 100% { outline-color: var(--red-esigelec); }
  50% { outline-color: transparent; }
}

/* MapLayerSwitcher est en position:fixed par défaut (pensé pour la carte
   plein écran) : ici on le rattache au conteneur de la mini-carte pour
   éviter qu'il se superpose au sélecteur de la carte principale visible
   derrière la modale. */
.mini-map-container :deep(.layer-switcher) {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.map-hint {
  margin: 0;
  font-size: 0.85em;
  color: var(--gray-dark);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.map-hint-warning {
  color: var(--red-esigelec);
  font-weight: 700;
  background-color: #fdeeee;
  border: 1px solid var(--red-esigelec);
  border-radius: 6px;
  padding: 8px 10px;
}

.map-hint.pulse {
  animation: hint-attention 0.4s ease-in-out 2;
}

.warning-icon {
  flex-shrink: 0;
}

@keyframes hint-attention {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

@media (max-width: 768px) {
  .mini-map-wrapper {
    width: 100%;
  }
  .mini-map {
    width: 100%;
    height: 300px;
  }
}
</style>
