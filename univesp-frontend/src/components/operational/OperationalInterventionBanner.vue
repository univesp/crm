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
  <section class="crm-card crm-state-info px-4 py-4" role="region" aria-label="Intervenção operacional">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="max-w-3xl">
        <p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-info)]">{{ context.title }}</p>
        <p class="mt-2 text-sm leading-6 text-[var(--color-text)]">{{ context.description }}</p>
        <p v-if="context.ownerLabel" class="mt-2 text-xs font-semibold text-[var(--color-text-muted)]">
          Responsável atual: {{ context.ownerLabel }}
        </p>
        <p
          v-if="feedback.message"
          :class="[
            'mt-2 text-sm font-medium',
            feedback.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]',
          ]"
          role="status"
        >
          {{ feedback.message }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="context.canAssume"
          type="button"
          class="crm-button-primary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="$emit('assume')"
        >
          {{ loading ? 'Assumindo...' : 'Assumir / acelerar' }}
        </button>
        <template v-if="operationalLinks.length">
          <RouterLink
            v-for="link in operationalLinks"
            :key="link.id"
            :to="link.route"
            class="crm-button-secondary px-3 py-2 text-xs"
          >
            {{ link.label }}
          </RouterLink>
        </template>
        <button
          type="button"
          class="crm-button-secondary px-3 py-2 text-xs"
          @click="$emit('dismiss')"
        >
          Fechar
        </button>
      </div>
    </div>
  </section>
</template>
