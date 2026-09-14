<script setup>
import { ref } from 'vue'

defineProps({
  layers: { type: Array, required: true }, // [{ key, label, thumbnail }]
  active: { type: String, required: true },
})
const emit = defineEmits(['select'])

const expanded = ref(false)

// Le survol suffit sur ordinateur ; sur tactile (pas de "hover" fiable), un
// tap sur la vignette active ouvre la liste, et sélectionner une option la
// referme.
const handleSelect = (key) => {
  emit('select', key)
  expanded.value = false
}
</script>

<template>
  <div
    class="layer-switcher"
    @mouseenter="expanded = true"
    @mouseleave="expanded = false"
  >
    <button
      v-for="layer in layers"
      v-show="expanded || layer.key === active"
      :key="layer.key"
      type="button"
      class="layer-option"
      :class="{ active: layer.key === active }"
      :title="layer.label"
      @click="layer.key === active ? (expanded = !expanded) : handleSelect(layer.key)"
    >
      <img :src="layer.thumbnail" :alt="layer.label" />
      <span>{{ layer.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.layer-switcher {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  gap: 6px;
  background: rgba(255, 255, 255, 0.9);
  padding: 6px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.layer-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 56px;
  background: none;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 3px;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease;
}

.layer-option img {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}

.layer-option span {
  font-size: 10px;
  font-weight: 600;
  color: var(--gray-dark);
  line-height: 1;
}

.layer-option:hover {
  transform: translateY(-2px);
}

.layer-option.active {
  border-color: var(--red-esigelec);
}

.layer-option.active span {
  color: var(--red-esigelec);
}

@media (max-width: 480px) {
  .layer-option {
    width: 44px;
  }
  .layer-option img {
    width: 34px;
    height: 34px;
  }
  .layer-option span {
    display: none;
  }
}
</style>
