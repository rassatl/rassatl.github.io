<script setup>
import { computed } from 'vue';
import { getI18n } from '../constants/i18n';

const props = defineProps({
  isOpen: Boolean,
  sidebarOffset: {
    type: Number,
    default: 0,
  },
  language: {
    type: String,
    default: 'fr',
  },
});

const emit = defineEmits(['close']);

const ui = computed(() => getI18n(props.language));
</script>

<template>
  <!-- Utilisation de Teleport pour rendre le modal dans le body -->
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      :style="{
        left: `${sidebarOffset}px`,
        width: `calc(100vw - ${sidebarOffset}px)`,
      }"
      @click.self="emit('close')"
    >
      <div
        class="modal-content"
        :style="{
          width: `min(1280px, calc(100vw - ${sidebarOffset}px - 32px))`,
        }"
      >
        <button class="modal-close" :aria-label="ui.common.close" :title="ui.common.close" @click="emit('close')">×</button>
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: white;
  padding: 20px;
  width: min(1280px, 94vw);
  max-height: 90vh;
  overflow: auto;
  box-sizing: border-box;
  border-radius: 8px;
  position: relative;
}
.modal-close {
  color: var(--black);
  position: absolute;
  top: 0px;
  right: 0px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  z-index: 10000 !important;
}

@media (max-width: 900px) {
  .modal-content {
    width: 96vw;
    max-height: 90vh;
    padding: 14px;
  }
}
</style>
