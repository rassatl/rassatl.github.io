<script setup>
/**
 * Formulaire d'ajout d'entreprise avec géocodage d'adresse.
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
const errorMessage = ref('');
const successMessage = ref('');

let map = null;
let marker = null;
let debounceTimeout = null;
const mapContainer = ref(null);

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

onMounted(() => {
  map = L.map(mapContainer.value, {
    center: [46.656066, 0.364419],
    zoom: 5,
    minZoom: 3,
    maxBounds: [[-90, -180], [90, 180]],
    worldCopyJump: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
});

onBeforeUnmount(() => {
  clearTimeout(debounceTimeout);
  if (map) {
    map.remove();
    map = null;
  }
});

watch([address, city, pc, country], ([newAddress, newCity, newPc, newCountry]) => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(async () => {
    if (![newAddress, newCity, newPc, newCountry].every((field) => field.trim() !== '')) {
      return;
    }

    const fullAddress = `${newAddress}, ${newPc} ${newCity}, ${newCountry}`;
    if (fullAddress.trim().length <= 10) {
      return;
    }

    isLoading.value = true;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Find-My-Company/1.0',
          },
        }
      );

      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        errorMessage.value = 'Adresse non trouvée. Vérifiez les informations saisies.';
        return;
      }

      const { lat, lon } = results[0];
      const latLng = L.latLng(lat, lon);
      if (!marker) {
        marker = L.marker(latLng, { icon: redIcon }).addTo(map);
      } else {
        marker.setLatLng(latLng);
      }

      map.setView(latLng, 15);
      x.value = Number.parseFloat(lat);
      y.value = Number.parseFloat(lon);
      errorMessage.value = '';
    } catch (error) {
      console.error('Erreur géocodage:', error);
      errorMessage.value = "Erreur lors de la géolocalisation de l'adresse.";
    } finally {
      isLoading.value = false;
    }
  }, 500);
});

const isValidUrl = (value) => {
  if (!value) {
    return true;
  }

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
    { value: x.value, label: 'Latitude' },
    { value: y.value, label: 'Longitude' },
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
};

const submitForm = async () => {
  if (!validateForm()) {
    return;
  }

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
      x: Number.parseFloat(x.value),
      y: Number.parseFloat(y.value),
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
    <!-- Formulaire d'ajout d'entreprise -->
    <form class="form-container" @submit.prevent="submitForm">
      <h2>Ajouter une entreprise</h2>

      <!-- Messages d'erreur et de succès -->
      <div v-if="errorMessage" class="alert alert-error">
        ❌ {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert-success">
        ✅ {{ successMessage }}
      </div>

      <!-- Champs obligatoires -->
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
        <input
          id="address"
          v-model="address"
          type="text"
          placeholder="Ex: 123 Rue de la Paix"
          required
        />
      </div>

      <div class="form-group">
        <label for="pc">Code Postal <span class="required">*</span></label>
        <input id="pc" v-model="pc" type="text" placeholder="Ex: 75001" required />
      </div>

      <!-- Carte placée juste après les informations d'adresse -->
      <section class="map-inline">
        <h3 class="map-title">Localisation automatique</h3>
        <p class="map-subtitle">La carte se met à jour dès que l'adresse est complète.</p>
        <p class="coords" v-if="x && y">Coordonnées: {{ x }}, {{ y }}</p>
        <div class="mini-map" ref="mapContainer"></div>
      </section>

      <!-- Champs optionnels -->
      <hr class="separator" />
      <h3>Informations complémentaires</h3>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          v-model="description"
          placeholder="Décrivez brièvement l'entreprise..."
          rows="4"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="sectors">Secteurs d'activité</label>
        <div class="checkbox-group">
          <label v-for="sector in sectorOptions" :key="sector" class="checkbox-label">
            <input
              type="checkbox"
              :value="sector"
              v-model="sectors"
            />
            {{ sector }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="website">Site web</label>
        <input
          id="website"
          v-model="website"
          type="url"
          placeholder="https://exemple.com"
        />
      </div>

      <div class="form-group">
        <label for="lastHiringDate">Dernière embauche</label>
        <input
          id="lastHiringDate"
          v-model="lastHiringDate"
          type="date"
        />
      </div>

      <!-- Bouton de soumission -->
      <button
        type="submit"
        class="submit-button"
        :disabled="isLoading"
      >
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

.coords {
  margin: 0;
  font-size: 0.85rem;
  color: #444;
  font-weight: 600;
}

.mini-map {
  width: 100%;
  min-width: 0;
  flex: 0 0 auto;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  height: clamp(260px, 32vh, 340px);
}

@media (max-width: 1050px) {
  .form-container,
  .map-inline,
  .mini-map,
  .checkbox-group {
    min-width: 0;
  }

  .mini-map {
    height: clamp(220px, 30vh, 280px);
  }
}
</style>
