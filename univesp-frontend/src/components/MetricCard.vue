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
  <div class="surface-panel p-4 md:p-5">
    <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">{{ label }}</p>
    <p class="mt-3 text-[1.9rem] font-semibold text-slate-950">{{ value }}</p>
    <p v-if="hint" class="mt-2 text-sm leading-6 text-slate-600">{{ hint }}</p>
  </div>
</template>
