<script setup>
defineProps({
  stage: {
    type: Object,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <RouterLink
    :to="stage.route"
    class="surface-panel group flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-1"
  >
    <div class="flex items-center justify-between">
      <span class="soft-chip">{{ stage.id }}</span>
      <span
        :class="[
          'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]',
          active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
        ]"
      >
        {{ active ? 'Etapa atual' : 'Explorar' }}
      </span>
    </div>
    <h3 class="mt-8 text-2xl font-semibold text-slate-950">{{ stage.label }}</h3>
    <p class="mt-3 text-sm leading-6 text-slate-600">{{ stage.description }}</p>
    <div class="mt-6 border-t border-slate-900/10 pt-4">
      <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Saida esperada
      </p>
      <p class="mt-2 text-sm font-medium text-slate-800">{{ stage.output }}</p>
    </div>
  </RouterLink>
</template>
