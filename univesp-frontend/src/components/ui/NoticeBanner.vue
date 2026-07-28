<script setup>
defineProps({
  message: { type: String, required: true },
  tone: {
    type: String,
    default: 'neutral',
    validator: (value) => ['neutral', 'success', 'warning', 'danger'].includes(value),
  },
})
</script>

<template>
  <div
    class="notice-banner"
    :class="`notice-${tone || 'neutral'}`"
    :role="tone === 'danger' ? 'alert' : 'status'"
  >
    {{ message }}
  </div>
</template>
