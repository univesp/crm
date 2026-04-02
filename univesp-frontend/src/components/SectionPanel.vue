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
  <section class="surface-panel rise-in p-5 md:p-6">
    <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p v-if="eyebrow" class="text-xs font-semibold tracking-[0.12em] text-slate-500">
          {{ eyebrow }}
        </p>
        <h2 class="mt-2 text-[1.65rem] font-semibold text-slate-950 md:text-[1.8rem]">{{ title }}</h2>
        <p v-if="description" class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {{ description }}
        </p>
      </div>

      <slot name="action"></slot>
    </div>

    <slot></slot>
  </section>
</template>
