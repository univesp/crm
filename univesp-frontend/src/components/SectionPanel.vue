<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <section class="surface-panel rise-in p-6">
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p v-if="eyebrow" class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {{ eyebrow }}
        </p>
        <h2 class="mt-2 text-3xl font-semibold text-slate-950">{{ title }}</h2>
        <p v-if="description" class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {{ description }}
        </p>
      </div>

      <slot name="action"></slot>
    </div>

    <slot></slot>
  </section>
</template>
