<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  eyebrow: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="inner-panel p-5">
    <p v-if="eyebrow" class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {{ eyebrow }}
    </p>
    <h3 class="mt-2 text-lg font-semibold text-slate-950">{{ title }}</h3>
    <p v-if="description" class="mt-3 text-sm leading-6 text-slate-600">{{ description }}</p>
    <slot></slot>
  </div>
</template>
