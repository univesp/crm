<script setup>
defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Number],
    required: true,
  },
  hint: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="crm-stat-tile">
    <p class="crm-stat-tile__label">{{ label }}</p>
    <p class="crm-stat-tile__value">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{{ hint }}</p>
  </div>
</template>
