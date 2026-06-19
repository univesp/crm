<script setup>
import { computed, ref } from 'vue'

import { summarizeScopeForBar } from '@/services/mockContextRuntime'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const expanded = ref(false)

const mockContext = computed(() => auth.mockContext)
const isStudentShell = computed(() => mockContext.value.isStudentShell)
const scopeSummary = computed(() => summarizeScopeForBar(mockContext.value))
const showLocalBadge = computed(() => Boolean(mockContext.value.mockMode))

const primaryIdentity = computed(() => {
  if (isStudentShell.value) {
    return {
      id: 'profile',
      label: 'Perfil',
      value: mockContext.value.profileLabel,
    }
  }

  return {
    id: 'user',
    label: 'Usuario',
    value: mockContext.value.userName,
  }
})

const barItems = computed(() => [
  { id: 'origin', label: 'Entrada', value: mockContext.value.entryOrigin },
  { id: 'polo', label: 'Polo', value: mockContext.value.currentPolo },
  { id: 'queues', label: 'Filas visiveis', value: scopeSummary.value.queues.join(', ') || 'Nenhuma' },
  { id: 'areas', label: 'Areas visiveis', value: scopeSummary.value.areas.join(', ') || 'Nenhuma' },
])

const summaryItems = computed(() => [
  ...(isStudentShell.value
    ? [
        { id: 'profile', label: 'Perfil', value: mockContext.value.profileLabel },
        { id: 'mode', label: 'Ambiente', value: mockContext.value.mockMode ? 'Modo local' : 'Ambiente real' },
        { id: 'ai', label: 'IA', value: mockContext.value.aiEnabled ? 'Ligada' : 'Desligada' },
      ]
    : [
        { id: 'profile', label: 'Perfil', value: mockContext.value.profileLabel },
        { id: 'user', label: 'Usuario', value: mockContext.value.userName },
        { id: 'mode', label: 'Ambiente', value: mockContext.value.mockMode ? 'Modo local' : 'Ambiente real' },
        { id: 'ai', label: 'IA', value: mockContext.value.aiEnabled ? 'Ligada' : 'Desligada' },
      ]),
])

const secondarySummaryItems = computed(() => {
  const primaryId = primaryIdentity.value.id
  return summaryItems.value.filter((item) => item.id !== primaryId)
})
</script>

<template>
  <section
    :class="[
      'mb-3 rounded-[8px] border border-slate-200 bg-white/84 shadow-sm',
      isStudentShell ? 'px-3 py-2' : 'px-3.5 py-2.5',
    ]"
    aria-label="Contexto local do ambiente"
  >
    <div class="flex flex-wrap items-center justify-between gap-2.5">
      <div class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-600">
        <span
          v-if="showLocalBadge"
          class="rounded-full border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/55 px-2.5 py-0.5 font-medium text-[var(--color-primary-dark)]"
        >
          Ambiente local
        </span>
        <span
          class="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-0.5"
          :title="`${primaryIdentity.label}: ${primaryIdentity.value}`"
        >
          <span class="font-medium text-slate-700">{{ primaryIdentity.label }}:</span>
          <span class="ml-1 text-slate-900">{{ primaryIdentity.value }}</span>
        </span>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        :aria-expanded="expanded ? 'true' : 'false'"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Ocultar contexto' : 'Contexto' }}
      </button>
    </div>

    <div v-if="expanded" class="mt-2.5 grid gap-2.5 border-t border-slate-200 pt-2.5">
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="item in secondarySummaryItems"
          :key="item.id"
          class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
        >
          <span class="font-medium text-slate-900">{{ item.label }}:</span>
          {{ item.value }}
        </span>
      </div>
      <div class="grid gap-2 md:grid-cols-2">
        <article
          v-for="item in barItems"
          :key="item.id"
          class="rounded-[8px] bg-slate-50/90 px-3 py-2.5"
        >
          <p class="text-[11px] font-semibold tracking-normal text-slate-500">
            {{ item.label }}
          </p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{ item.value }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
