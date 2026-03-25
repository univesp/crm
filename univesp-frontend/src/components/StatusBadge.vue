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

  if (label.includes('crit')) {
    return 'badge-criticality-high'
  }

  if (label.includes('alta') || label.includes('acao') || label.includes('aguardando')) {
    return 'badge-warning'
  }

  if (label.includes('moderado') || label.includes('media')) {
    return 'badge-criticality-medium'
  }

  if (label.includes('baixa') || label.includes('baixo')) {
    return 'badge-criticality-low'
  }

  if (label.includes('resolvido') || label.includes('revisao')) {
    return 'badge-success'
  }

  return 'badge-neutral'
})
</script>

<template>
  <span :class="['badge-base', toneClass]">
    {{ label }}
  </span>
</template>
