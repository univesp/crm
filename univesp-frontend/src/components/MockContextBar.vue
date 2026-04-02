<script setup>
import { computed, ref } from 'vue'

import { summarizeScopeForBar } from '@/services/mockContextRuntime'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const expanded = ref(false)

const mockContext = computed(() => auth.mockContext)
const isStudentShell = computed(() => mockContext.value.isStudentShell)
const scopeSummary = computed(() => summarizeScopeForBar(mockContext.value))

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
</script>

<template>
  <section
    :class="[
      'mb-4 rounded-[20px] border border-slate-200 bg-white/88 shadow-[0_8px_20px_rgba(16,18,20,0.04)]',
      isStudentShell ? 'px-3 py-2.5' : 'px-4 py-3',
    ]"
    aria-label="Contexto local do ambiente"
  >
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span class="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 font-semibold text-[var(--color-primary-dark)]">
          Ambiente local
        </span>
        <span
          v-for="item in summaryItems"
          :key="item.id"
          class="rounded-full bg-slate-100 px-3 py-1"
        >
          <span class="font-semibold text-slate-900">{{ item.label }}:</span>
          {{ item.value }}
        </span>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        :aria-expanded="expanded ? 'true' : 'false'"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Ocultar contexto' : 'Ver contexto' }}
      </button>
    </div>

    <div v-if="expanded" class="mt-3 grid gap-3 border-t border-slate-200 pt-3 md:grid-cols-2">
      <article
        v-for="item in barItems"
        :key="item.id"
        class="rounded-[16px] bg-slate-50/90 px-4 py-3"
      >
        <p class="text-xs font-semibold tracking-[0.1em] text-slate-500">
          {{ item.label }}
        </p>
        <p class="mt-1.5 text-sm font-semibold text-slate-900">
          {{ item.value }}
        </p>
      </article>
    </div>
  </section>
</template>
