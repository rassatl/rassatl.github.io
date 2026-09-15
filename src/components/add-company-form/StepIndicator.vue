<script setup>
defineProps({
  steps: { type: Array, required: true },
  currentStep: { type: Number, required: true },
})
</script>

<template>
  <ol class="step-indicator">
    <li
      v-for="(label, index) in steps"
      :key="label"
      :class="{ active: currentStep === index + 1, done: currentStep > index + 1 }"
    >
      <span class="step-number">{{ index + 1 }}</span>
      <span class="step-label">{{ label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.step-indicator {
  display: flex;
  justify-content: space-between;
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
  gap: 4px;
}

.step-indicator li {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  opacity: 0.5;
}

.step-indicator li.active,
.step-indicator li.done {
  opacity: 1;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--gray-white-light);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.step-indicator li.active .step-number,
.step-indicator li.done .step-number {
  background: var(--red-esigelec);
}

.step-label {
  font-size: 0.7em;
  color: var(--gray-dark);
  font-weight: 600;
}

@media (max-width: 768px) {
  .step-label {
    display: none;
  }
}
</style>
