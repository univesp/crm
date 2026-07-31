<script setup>
import { computed } from 'vue'

const props = defineProps({
  priority: {
    type: String,
    required: true,
  },
  criticidade: {
    type: String,
    default: '',
  },
})

const toneClass = computed(() => {
  const priority = (props.criticidade || props.priority).toLowerCase()

  if (priority.includes('crit')) {
    return 'badge-criticality-high'
  }

  if (priority.includes('alta')) {
    return 'badge-priority-high'
  }

  if (priority.includes('media')) {
    return 'badge-priority-medium'
  }

  if (priority.includes('baixa')) {
    return 'badge-priority-low'
  }

  return 'badge-neutral'
})
</script>

<template>
  <span :class="['badge-base', toneClass]">
    {{ criticidade || priority }}
  </span>
</template>
