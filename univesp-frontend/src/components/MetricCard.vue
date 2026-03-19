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
  <div class="surface-panel p-5">
    <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{{ label }}</p>
    <p class="mt-4 text-3xl font-semibold text-slate-950">{{ value }}</p>
    <p v-if="hint" class="mt-3 text-sm leading-6 text-slate-600">{{ hint }}</p>
  </div>
</template>
