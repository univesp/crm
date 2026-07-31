<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
})

const toneClass = computed(() => {
  const label = props.label.toLowerCase()
  const shortHoursMatch = label.match(/(\d+)\s*h/)

  if (label.includes('venc')) {
    return 'badge-sla-overdue'
  }

  if (
    label.includes('min') ||
    label.includes('restante') ||
    label.includes('proximo') ||
    label.includes('curto') ||
    (shortHoursMatch && Number.parseInt(shortHoursMatch[1], 10) <= 4)
  ) {
    return 'badge-sla-soon'
  }

  if (label.includes('encerrado')) {
    return 'badge-neutral'
  }

  return 'badge-sla-ontrack'
})
</script>

<template>
  <span :class="['badge-base', toneClass]" :aria-label="`Prazo de resposta: ${label}`">
    {{ label }}
  </span>
</template>
