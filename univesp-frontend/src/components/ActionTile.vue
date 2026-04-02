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
  <div class="inner-panel p-4">
    <p v-if="eyebrow" class="text-xs font-semibold tracking-[0.12em] text-slate-500">
      {{ eyebrow }}
    </p>
    <h3 class="mt-2 text-lg font-semibold text-slate-950">{{ title }}</h3>
    <p v-if="description" class="mt-2 text-sm leading-6 text-slate-600">{{ description }}</p>
    <slot></slot>
  </div>
</template>
