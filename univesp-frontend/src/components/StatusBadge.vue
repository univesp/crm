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

  if (label.includes('urgente') || label.includes('atrasad')) {
    return 'badge-danger'
  }

  if (label.includes('faq')) {
    return 'badge-success'
  }

  if (label.includes('respondido op') || label.includes('respondido pelo op')) {
    return 'badge-info'
  }

  if (label.includes('acao') || label.includes('sua acao')) {
    return 'badge-danger'
  }

  if (label.includes('analise')) {
    return 'badge-danger'
  }

  if (label.includes('respondid')) {
    return 'badge-info'
  }

  if (label.includes('reencaminh')) {
    return 'badge-info'
  }

  if (label.includes('respondida no portal')) {
    return 'badge-info'
  }

  if (label.includes('conclu')) {
    return 'badge-success'
  }

  if (label.includes('alta') || label.includes('aguardando')) {
    return 'badge-warning'
  }

  if (label.includes('pendente')) {
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
  <span :class="['badge-base', toneClass]" :aria-label="`Status: ${label}`">
    {{ label }}
  </span>
</template>
