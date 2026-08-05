<script setup>
import { computed, ref } from 'vue'

import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { resolveAreaQueueBucket } from '@/services/areaQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const openCardId = ref('')

const overview = computed(() => studentSupportStore.areaManagerOverview(auth.mockContext) || {})
const queueEntries = computed(() => studentSupportStore.areaQueueEntries(auth.mockContext) || [])
const priorityQueueRoute = {
  path: '/area/fila',
  query: { bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' },
}

const ruleHints = computed(() => overview.value.ruleImpactHints || [])
const pendingSuggestions = computed(() => overview.value.pendingKnowledgeSuggestions || [])
const pressurePoints = computed(() => (overview.value.operationalQuestions || []).slice(0, 4))
const subjectBottlenecks = computed(() => (overview.value.subjectBottlenecks || []).slice(0, 6))
const teamLoad = computed(() => (overview.value.loadByAnalyst || []).slice(0, 8))

function caseEntries(predicate = () => true) {
  return queueEntries.value.filter(predicate).slice(0, 5)
}

const cards = computed(() => {
  const kpis = overview.value.kpis || {}
  const alertItems = [
    ...ruleHints.value.map((item) => ({ ...item, kind: 'rule' })),
    ...pendingSuggestions.value.map((item) => ({
      id: `suggestion-${item.id}`,
      title: item.title,
      description: `${item.subjectLabel} · ${item.authorName || 'Sugestão recebida'}`,
      tone: 'info',
      kind: 'suggestion',
    })),
  ].slice(0, 5)

  return [
    {
      id: 'backlog',
      label: 'Backlog',
      value: kpis.backlogTotal || 0,
      helper: 'Casos ativos na área.',
      tone: 'neutral',
      entries: caseEntries(),
      query: { bucket: 'all', sortField: 'sla', sortDirection: 'asc' },
    },
    {
      id: 'overdue',
      label: 'Vencidos',
      value: kpis.overdue || 0,
      helper: 'Exigem ação imediata.',
      tone: 'danger',
      entries: caseEntries((entry) => entry.isOverdue),
      query: { bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' },
    },
    {
      id: 'risk',
      label: 'Em risco',
      value: kpis.atRisk || 0,
      helper: 'Podem vencer em breve.',
      tone: 'warning',
      entries: caseEntries((entry) => entry.isAtRisk && !entry.isOverdue),
      query: { bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' },
    },
    {
      id: 'unassigned',
      label: 'Sem responsável',
      value: kpis.unassigned || 0,
      helper: 'Precisam de distribuição.',
      tone: 'warning',
      entries: caseEntries((entry) => entry.isUnassigned || entry.hasOperationalOwnerError),
      query: { scopeState: 'owner_missing', bucket: 'all' },
    },
    {
      id: 'alerts',
      label: 'Alertas',
      value: alertItems.length,
      helper: 'Regras e sugestões para revisar.',
      tone: 'info',
      alerts: alertItems,
      query: { bucket: 'all' },
    },
  ]
})

const activeCard = computed(() => cards.value.find((card) => card.id === openCardId.value) || null)

function toggleCard(cardId) {
  openCardId.value = openCardId.value === cardId ? '' : cardId
}

function toneClass(tone = '') {
  if (tone === 'danger') {
    return 'border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.82)] text-[var(--color-danger)]'
  }

  if (tone === 'warning') {
    return 'border-[rgba(202,138,4,0.24)] bg-[rgba(254,243,199,0.78)] text-[#8a5200]'
  }

  if (tone === 'info') {
    return 'border-[rgba(8,115,145,0.2)] bg-[rgba(224,242,254,0.72)] text-[#0b6e8c]'
  }

  return 'border-slate-200 bg-white text-slate-900'
}

function cardDetailId(card) {
  return `area-operation-card-detail-${card.id}`
}

function caseRoute(entry = {}) {
  return {
    path: `/area/fila/${entry.id}`,
    query: entry.currentAreaLabel ? { area: entry.currentAreaLabel } : {},
  }
}

function cardQueueRoute(card) {
  return {
    path: '/area/fila',
    query: card.query || {},
  }
}

function alertRoute(alert) {
  return alert.kind === 'suggestion' ? '/area/mudancas' : '/area/governanca'
}

function statusLabel(entry) {
  return entry.areaStatusLabel || entry.status || resolveAreaQueueBucket(entry)
}
</script>

<template>
  <div class="grid gap-4">
    <section class="crm-panel px-5 py-5">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <header class="crm-page-header mb-0 max-w-3xl">
          <h1 class="crm-page-title">Operação da área</h1>
          <p class="crm-page-description">
            Escolha um indicador para entender o problema e agir no recorte certo.
          </p>
        </header>

        <RouterLink :to="priorityQueueRoute" class="crm-button-primary shrink-0">
          Ver casos prioritários
        </RouterLink>
      </div>
    </section>

    <section aria-label="Indicadores da operação" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <button
        v-for="card in cards"
        :id="`area-operation-card-${card.id}`"
        :key="card.id"
        type="button"
        :aria-expanded="openCardId === card.id ? 'true' : 'false'"
        :aria-controls="cardDetailId(card)"
        :class="[
          'rounded-[8px] border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          toneClass(card.tone),
          openCardId === card.id ? 'ring-2 ring-[rgba(8,115,145,0.24)]' : 'hover:shadow-sm',
        ]"
        @click="toggleCard(card.id)"
      >
        <span class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold uppercase tracking-normal">{{ card.label }}</span>
          <span aria-hidden="true" class="text-base">{{ openCardId === card.id ? '−' : '+' }}</span>
        </span>
        <span class="mt-2 block text-2xl font-semibold leading-none text-slate-950">{{ card.value }}</span>
        <span class="mt-2 block text-xs leading-5 text-slate-700">{{ card.helper }}</span>
      </button>
    </section>

    <section
      v-if="activeCard"
      :id="cardDetailId(activeCard)"
      class="crm-panel"
      role="region"
      :aria-labelledby="`area-operation-card-${activeCard.id}`"
    >
      <div class="flex flex-col gap-3 border-b border-[var(--border-default)] px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-[var(--color-text)]">{{ activeCard.label }}</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Veja o recorte atual e abra o caso ou a configuração que precisa de atenção.
          </p>
        </div>
        <RouterLink :to="cardQueueRoute(activeCard)" class="crm-button-secondary shrink-0 px-3 py-2 text-xs">
          Abrir recorte em Casos
        </RouterLink>
      </div>

      <div v-if="activeCard.entries?.length" class="divide-y divide-[var(--border-default)]">
        <article v-for="entry in activeCard.entries" :key="entry.id" class="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-[var(--color-text-muted)]">{{ entry.id }}</p>
            <h3 class="mt-1 text-sm font-semibold text-[var(--color-text)]">{{ entry.subject }}</h3>
            <p class="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              {{ entry.student }} · {{ entry.currentAssigneeLabel || 'Sem responsável' }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="statusLabel(entry)" />
            <SlaBadge v-if="entry.sla" :label="entry.sla" />
            <RouterLink :to="caseRoute(entry)" class="crm-button-secondary px-3 py-2 text-xs">
              Abrir caso
            </RouterLink>
          </div>
        </article>
      </div>

      <div v-else-if="activeCard.alerts?.length" class="grid gap-3 px-5 py-4">
        <article v-for="alert in activeCard.alerts" :key="alert.id" :class="['rounded-[8px] border px-4 py-3', toneClass(alert.tone)]">
          <p class="text-sm font-semibold text-slate-950">{{ alert.title }}</p>
          <p class="mt-1 text-sm leading-6 text-slate-700">{{ alert.description }}</p>
          <RouterLink :to="alertRoute(alert)" class="mt-3 inline-flex text-xs font-semibold text-[#0b6e8c] hover:underline">
            {{ alert.kind === 'suggestion' ? 'Revisar sugestão' : 'Abrir regras operacionais' }}
          </RouterLink>
        </article>
      </div>

      <p v-else class="px-5 py-5 text-sm leading-6 text-[var(--color-text-muted)]">
        Nenhum item precisa de ação neste recorte.
      </p>
    </section>

    <details class="crm-panel overflow-hidden">
      <summary class="cursor-pointer list-none px-5 py-4 text-base font-semibold text-[var(--color-text)]">
        Apoio à decisão
        <span class="ml-2 text-sm font-normal text-[var(--color-text-muted)]">carga, assuntos e sugestões</span>
      </summary>

      <div class="grid gap-4 border-t border-[var(--border-default)] px-5 py-4 xl:grid-cols-2">
        <section>
          <h2 class="text-base font-semibold text-[var(--color-text)]">Carga da equipe</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">Compare volume e risco antes de ajustar a distribuição.</p>
          <div v-if="teamLoad.length" class="mt-3 divide-y divide-[var(--border-default)] rounded-[8px] border border-[var(--border-default)]">
            <div v-for="item in teamLoad" :key="item.analystName" class="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center">
              <p class="text-sm font-semibold text-[var(--color-text)]">{{ item.analystName }}</p>
              <p class="text-xs text-[var(--color-text-muted)]">Ativos: <strong class="text-[var(--color-text)]">{{ item.activeCases }}</strong></p>
              <p class="text-xs text-[var(--color-text-muted)]">Vencidos: <strong class="text-[var(--color-text)]">{{ item.overdueCases }}</strong></p>
              <p class="text-xs text-[var(--color-text-muted)]">Em risco: <strong class="text-[var(--color-text)]">{{ item.riskCases }}</strong></p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-base font-semibold text-[var(--color-text)]">Temas com maior fila</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">Assuntos que concentram casos ativos ou risco de prazo.</p>
          <div v-if="subjectBottlenecks.length" class="mt-3 divide-y divide-[var(--border-default)] rounded-[8px] border border-[var(--border-default)]">
            <div v-for="item in subjectBottlenecks" :key="item.id" class="flex items-center justify-between gap-3 px-4 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-[var(--color-text)]">{{ item.subjectLabel }}</p>
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">{{ item.openCases }} ativos · {{ item.overdueCases }} vencidos · {{ item.riskCases }} em risco</p>
              </div>
              <RouterLink :to="cardQueueRoute({ query: { subject: item.subjectLabel, bucket: 'all', sortField: 'sla', sortDirection: 'asc' } })" class="crm-button-secondary shrink-0 px-3 py-2 text-xs">
                Ver casos
              </RouterLink>
            </div>
          </div>
        </section>

        <section v-if="pendingSuggestions.length">
          <h2 class="text-base font-semibold text-[var(--color-text)]">Sugestões de melhoria</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Sugestões recebidas que aguardam revisão da gestão.
          </p>
          <div class="mt-3 divide-y divide-[var(--border-default)] rounded-[8px] border border-[var(--border-default)]">
            <div v-for="item in pendingSuggestions.slice(0, 5)" :key="item.id" class="flex items-center justify-between gap-3 px-4 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-[var(--color-text)]">{{ item.title }}</p>
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">{{ item.subjectLabel || 'Conteúdo vigente' }}</p>
              </div>
              <RouterLink to="/area/mudancas" class="crm-button-secondary shrink-0 px-3 py-2 text-xs">
                Revisar
              </RouterLink>
            </div>
          </div>
        </section>

        <section class="xl:col-span-2">
          <h2 class="text-base font-semibold text-[var(--color-text)]">Pressão atual</h2>
          <div v-if="pressurePoints.length" class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div v-for="item in pressurePoints" :key="item.id" class="rounded-[8px] border border-[var(--border-default)] bg-slate-50/70 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-600">{{ item.question }}</p>
              <p class="mt-2 text-sm font-semibold text-slate-950">{{ item.headline }}</p>
              <p class="mt-1 text-xs leading-5 text-slate-600">{{ item.helper }}</p>
            </div>
          </div>
        </section>
      </div>
    </details>
  </div>
</template>
