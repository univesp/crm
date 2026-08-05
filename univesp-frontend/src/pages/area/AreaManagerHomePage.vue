<script setup>
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const overview = computed(() => studentSupportStore.areaManagerOverview(auth.mockContext))

const priorityQueueRoute = {
  path: '/area/fila',
  query: { bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' },
}

const priorityCards = computed(() => {
  const kpis = overview.value?.kpis || {}

  return [
    {
      id: 'overdue',
      label: 'Vencidos',
      value: kpis.overdue || 0,
      helper: 'Exigem ação imediata.',
      tone: 'danger',
    },
    {
      id: 'risk',
      label: 'Em risco',
      value: kpis.atRisk || 0,
      helper: 'Podem vencer em breve.',
      tone: 'warning',
    },
    {
      id: 'unassigned',
      label: 'Sem responsável',
      value: kpis.unassigned || 0,
      helper: 'Precisam de distribuição.',
      tone: 'info',
    },
  ]
})

const decisions = computed(() => (overview.value?.interventionQueue || []).slice(0, 4))
const pressurePoints = computed(() => (overview.value?.operationalQuestions || []).slice(0, 4))
const ruleHints = computed(() => overview.value?.ruleImpactHints || [])
const subjectBottlenecks = computed(() => (overview.value?.subjectBottlenecks || []).slice(0, 6))
const teamLoad = computed(() => (overview.value?.loadByAnalyst || []).slice(0, 8))
const pendingSuggestions = computed(() => (overview.value?.pendingKnowledgeSuggestions || []).slice(0, 3))

function queueRoute(query = {}) {
  return {
    path: '/area/fila',
    query,
  }
}

function toneClass(tone = '') {
  if (tone === 'danger') {
    return 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.72)]'
  }

  if (tone === 'warning') {
    return 'border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.72)]'
  }

  return 'border-[rgba(8,115,145,0.14)] bg-[rgba(224,242,254,0.62)]'
}

function priorityLabel(priority = '') {
  if (priority === 'critical') {
    return 'Crítico'
  }

  if (priority === 'high') {
    return 'Alta prioridade'
  }

  if (priority === 'medium') {
    return 'Média prioridade'
  }

  return 'Acompanhar'
}
</script>

<template>
  <div class="grid gap-4">
    <section class="crm-panel px-5 py-5">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <header class="crm-page-header mb-0 max-w-3xl">
          <h1 class="crm-page-title">Operação da área</h1>
          <p class="crm-page-description">
            Decida o que precisa de atenção agora. Use Casos da área para localizar e abrir protocolos.
          </p>
        </header>

        <div class="flex flex-wrap gap-2">
          <RouterLink :to="priorityQueueRoute" class="crm-button-primary shrink-0">
            Ver casos prioritários
          </RouterLink>
          <RouterLink to="/area/governanca" class="crm-button-secondary shrink-0">
            Regras operacionais
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-3" aria-label="Indicadores de atenção">
      <article
        v-for="card in priorityCards"
        :key="card.id"
        :class="['rounded-[8px] border px-5 py-4', toneClass(card.tone)]"
      >
        <p class="text-xs font-semibold uppercase tracking-normal text-slate-600">{{ card.label }}</p>
        <p class="mt-3 text-3xl font-semibold leading-none text-slate-950">{{ card.value }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-700">{{ card.helper }}</p>
      </article>
    </section>

    <section class="crm-panel">
      <div class="border-b border-[var(--border-default)] px-5 py-4">
        <h2 class="text-lg font-semibold text-[var(--color-text)]">Decisões pendentes</h2>
        <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
          Ações gerenciais sugeridas por prazo, distribuição e gargalos da área.
        </p>
      </div>

      <div v-if="decisions.length" class="divide-y divide-[var(--border-default)]">
        <article v-for="item in decisions" :key="item.id" class="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-semibold text-[var(--color-text)]">{{ item.title }}</h3>
              <span class="crm-chip">{{ priorityLabel(item.priority) }}</span>
            </div>
            <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{{ item.description }}</p>
          </div>
          <RouterLink
            :to="queueRoute(item.routeQuery || {})"
            class="crm-button-secondary shrink-0 px-3 py-2 text-xs"
          >
            Abrir casos
          </RouterLink>
        </article>
      </div>

      <p v-else class="px-5 py-5 text-sm leading-6 text-[var(--color-text-muted)]">
        Nenhuma decisão urgente no momento. Continue acompanhando prazo e distribuição.
      </p>
    </section>

    <section class="crm-panel">
      <div class="border-b border-[var(--border-default)] px-5 py-4">
        <h2 class="text-lg font-semibold text-[var(--color-text)]">Onde está a pressão?</h2>
        <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
          Recortes para entender o problema antes de abrir um caso individual.
        </p>
      </div>

      <div v-if="pressurePoints.length" class="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="item in pressurePoints"
          :key="item.id"
          :class="['rounded-[8px] border px-4 py-4', toneClass(item.tone)]"
        >
          <p class="text-xs font-semibold uppercase tracking-normal text-slate-600">{{ item.question }}</p>
          <p class="mt-2 text-sm font-semibold text-slate-950">{{ item.headline }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.helper }}</p>
          <RouterLink
            :to="queueRoute(item.routeQuery || {})"
            class="mt-3 inline-flex text-xs font-semibold text-[#0b6e8c] hover:underline"
          >
            Abrir recorte
          </RouterLink>
        </article>
      </div>

      <p v-else class="px-5 py-5 text-sm leading-6 text-[var(--color-text-muted)]">
        Nenhum ponto de pressão foi identificado no recorte atual.
      </p>
    </section>

    <section class="grid gap-4 xl:grid-cols-2">
      <article class="crm-panel">
        <div class="border-b border-[var(--border-default)] px-5 py-4">
          <h2 class="text-lg font-semibold text-[var(--color-text)]">Carga da equipe</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Compare volume e risco para decidir se a distribuição precisa de ajuste.
          </p>
        </div>

        <div v-if="teamLoad.length" class="divide-y divide-[var(--border-default)]">
          <div v-for="item in teamLoad" :key="item.analystName" class="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center">
            <p class="text-sm font-semibold text-[var(--color-text)]">{{ item.analystName }}</p>
            <p class="text-xs text-[var(--color-text-muted)]">Ativos: <strong class="text-[var(--color-text)]">{{ item.activeCases }}</strong></p>
            <p class="text-xs text-[var(--color-text-muted)]">Vencidos: <strong class="text-[var(--color-text)]">{{ item.overdueCases }}</strong></p>
            <p class="text-xs text-[var(--color-text-muted)]">Em risco: <strong class="text-[var(--color-text)]">{{ item.riskCases }}</strong></p>
          </div>
        </div>

        <p v-else class="px-5 py-5 text-sm leading-6 text-[var(--color-text-muted)]">
          Não há dados de carga disponíveis no recorte atual.
        </p>
      </article>

      <article class="crm-panel">
        <div class="border-b border-[var(--border-default)] px-5 py-4">
          <h2 class="text-lg font-semibold text-[var(--color-text)]">Temas com maior fila</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Assuntos que concentram casos ativos, vencidos ou em risco.
          </p>
        </div>

        <div v-if="subjectBottlenecks.length" class="divide-y divide-[var(--border-default)]">
          <div v-for="item in subjectBottlenecks" :key="item.id" class="flex items-center justify-between gap-3 px-5 py-4">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-[var(--color-text)]">{{ item.subjectLabel }}</p>
              <p class="mt-1 text-xs text-[var(--color-text-muted)]">
                {{ item.openCases }} ativos · {{ item.overdueCases }} vencidos · {{ item.riskCases }} em risco
              </p>
            </div>
            <RouterLink
              :to="queueRoute({ subject: item.subjectLabel, bucket: 'all', sortField: 'sla', sortDirection: 'asc' })"
              class="crm-button-secondary shrink-0 px-3 py-2 text-xs"
            >
              Ver casos
            </RouterLink>
          </div>
        </div>

        <p v-else class="px-5 py-5 text-sm leading-6 text-[var(--color-text-muted)]">
          Nenhum gargalo por assunto foi encontrado no recorte atual.
        </p>
      </article>
    </section>

    <section class="grid gap-4 xl:grid-cols-2">
      <article class="crm-panel">
        <div class="border-b border-[var(--border-default)] px-5 py-4">
          <h2 class="text-lg font-semibold text-[var(--color-text)]">Regras que afetam o atendimento</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Verifique a configuração quando houver falta de responsável ou distribuição irregular.
          </p>
        </div>

        <div v-if="ruleHints.length" class="grid gap-3 px-5 py-4">
          <div v-for="item in ruleHints" :key="item.id" :class="['rounded-[8px] border px-4 py-4', toneClass(item.tone)]">
            <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.description }}</p>
          </div>
        </div>

        <p v-else class="px-5 py-5 text-sm leading-6 text-[var(--color-text-muted)]">
          Nenhum impacto forte de regra foi identificado no recorte atual.
        </p>

        <div class="border-t border-[var(--border-default)] px-5 py-4">
          <RouterLink to="/area/governanca" class="crm-button-secondary inline-flex">
            Abrir regras operacionais
          </RouterLink>
        </div>
      </article>

      <article class="crm-panel">
        <div class="border-b border-[var(--border-default)] px-5 py-4">
          <h2 class="text-lg font-semibold text-[var(--color-text)]">Sugestões pendentes</h2>
          <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Melhorias de orientação aguardando sua análise.
          </p>
        </div>

        <div v-if="pendingSuggestions.length" class="divide-y divide-[var(--border-default)]">
          <div v-for="item in pendingSuggestions" :key="item.id" class="px-5 py-4">
            <p class="text-sm font-semibold text-[var(--color-text)]">{{ item.subjectLabel }}</p>
            <p class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{{ item.title }}</p>
            <p class="mt-2 text-xs text-[var(--color-text-muted)]">{{ item.authorName }} · {{ item.createdAtLabel }}</p>
          </div>
        </div>

        <p v-else class="px-5 py-5 text-sm leading-6 text-[var(--color-text-muted)]">
          Nenhuma sugestão aguarda decisão.
        </p>

        <div class="border-t border-[var(--border-default)] px-5 py-4">
          <RouterLink to="/area/mudancas" class="crm-button-secondary inline-flex">
            Revisar sugestões
          </RouterLink>
        </div>
      </article>
    </section>
  </div>
</template>
