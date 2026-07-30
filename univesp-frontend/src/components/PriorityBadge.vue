<script setup>
import { computed } from 'vue'

const props = defineProps({
  priority: {
    type: String,
    required: true,
  },
})

const toneClass = computed(() => {
  const priority = props.priority.toLowerCase()

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
    {{ priority }}
  </span>
</template>
