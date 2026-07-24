<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  context: {
    type: Object,
    required: true,
  },
  feedback: {
    type: Object,
    default: () => ({ type: '', message: '' }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  operationalLinks: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['assume', 'dismiss'])
</script>

<template>
  <section class="rounded-[8px] border border-[rgba(8,115,145,0.18)] bg-[rgba(224,242,254,0.55)] px-4 py-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="max-w-3xl">
        <p class="text-xs font-semibold uppercase tracking-wider text-[#0b6e8c]">{{ context.title }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-700">{{ context.description }}</p>
        <p v-if="context.ownerLabel" class="mt-2 text-xs font-semibold text-slate-500">
          Responsavel atual: {{ context.ownerLabel }}
        </p>
        <p
          v-if="feedback.message"
          :class="[
            'mt-2 text-sm font-medium',
            feedback.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]',
          ]"
        >
          {{ feedback.message }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <template v-if="operationalLinks.length">
          <RouterLink
            v-for="link in operationalLinks"
            :key="link.id"
            :to="link.route"
            class="rounded-[8px] bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            {{ link.label }}
          </RouterLink>
        </template>
        <button
          v-if="context.canAssume"
          type="button"
          class="rounded-[8px] bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="$emit('assume')"
        >
          {{ loading ? 'Assumindo...' : 'Assumir / acelerar' }}
        </button>
        <button
          type="button"
          class="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          @click="$emit('dismiss')"
        >
          Fechar
        </button>
      </div>
    </div>
  </section>
</template>
