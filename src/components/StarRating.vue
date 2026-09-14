<script setup>
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
  max: { type: Number, default: 5 },
})
const emit = defineEmits(['update:modelValue'])

const setRating = (value) => {
  if (props.readonly) return
  emit('update:modelValue', value === props.modelValue ? 0 : value)
}
</script>

<template>
  <div class="star-rating" :class="{ readonly }">
    <button
      v-for="star in max"
      :key="star"
      type="button"
      class="star"
      :class="{ filled: star <= modelValue }"
      :disabled="readonly"
      :aria-label="`${star} / ${max}`"
      :aria-pressed="star <= modelValue"
      @click="setRating(star)"
    >★</button>
  </div>
</template>

<style scoped>
.star-rating {
  display: flex;
  gap: 4px;
}
.star {
  background: none;
  border: none;
  font-size: 1.8rem;
  line-height: 1;
  padding: 0;
  color: var(--gray-white-light);
  cursor: pointer;
  transition: color 0.15s ease, transform 0.15s ease;
}
.star-rating:not(.readonly) .star:hover {
  transform: scale(1.15);
}
.star.filled {
  color: var(--red-esigelec);
}
.star-rating.readonly .star {
  cursor: default;
}
</style>
