<script setup>
defineProps({
  message: { type: String, default: 'Carregando...' },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div
    class="loading-state"
    :class="{ 'loading-state--compact': compact }"
    role="status"
    aria-live="polite"
  >
    <span class="loading-state-spinner" aria-hidden="true" />
    <p>{{ message }}</p>
  </div>
</template>
