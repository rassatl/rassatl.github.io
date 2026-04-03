<script setup>

defineProps({
  isOpen: Boolean,
});

const emit = defineEmits(['close']);
</script>

<template>
  <!-- Utilisation de Teleport pour rendre le modal dans le body -->
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <button class="modal-close" @click="emit('close')">×</button>
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}
.modal-content {
  background: white;
  color: var(--black);
  padding: 20px;
  width: min(1280px, 94vw);
  height: min(90vh, 940px);
  max-height: 90vh;
  border-radius: 8px;
  position: relative;
  overflow: auto;
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
    height: 90vh;
    padding: 14px;
  }
}
</style>
