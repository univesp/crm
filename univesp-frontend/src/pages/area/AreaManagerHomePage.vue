<script setup>
import { computed } from 'vue'

import {
  buildAreaManagerBackendReadiness,
} from '@/contracts/areaManagerOperationalContract'
import OperationalCockpitPanel from '@/components/operational/OperationalCockpitPanel.vue'
import { buildOperationalCockpitFromAreaOverview } from '@/services/operationalCockpitRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const overview = computed(() => studentSupportStore.areaManagerOverview(auth.mockContext))
const operationalCockpit = computed(() =>
  buildOperationalCockpitFromAreaOverview(overview.value, auth.mockContext?.profileKey || 'gestor_area', {
    scopeLabel: overview.value.areaLabel || auth.mockContext?.currentArea || '',
  }),
)
const backendReadiness = buildAreaManagerBackendReadiness({ hasServerOverview: false })
const backendFieldEntries = computed(() => Object.entries(backendReadiness.minimalOverviewPayload || {}))

function buildCaseRoute(caseEntry = {}) {
  const caseId = typeof caseEntry === 'string' ? caseEntry : caseEntry?.id || ''
  const areaLabel =
    typeof caseEntry === 'string'
      ? ''
      : caseEntry?.currentAreaLabel || caseEntry?.resolvedAreaLabel || caseEntry?.lastMileAreaLabel || ''

  return {
    path: `/area/fila/${caseId}`,
    query: areaLabel
      ? {
          area: areaLabel,
        }
      : {},
  }
}

function buildQueueRoute(query = {}) {
  return {
    path: '/area/fila',
    query,
  }
}

const kpiCards = computed(() => [
  {
    id: 'backlog',
    label: 'Backlog',
    value: overview.value.kpis.backlogTotal,
    helper: 'Casos ativos da área.',
  },
  {
    id: 'overdue',
    label: 'Vencidos',
    value: overview.value.kpis.overdue,
    helper: 'Risco imediato de prazo.',
  },
  {
    id: 'risk',
    label: 'Em risco',
    value: overview.value.kpis.atRisk,
    helper: 'Podem vencer ainda neste turno.',
  },
  {
    id: 'owner_missing',
    label: 'Sem responsável temático',
    value: overview.value.kpis.ownerMissing,
    helper: 'Caso sem responsável temático efetivo.',
  },
  {
    id: 'unassigned',
    label: 'Sem responsável',
    value: overview.value.kpis.unassigned,
    helper: 'Exigem intervenção de distribuição.',
  },
  {
    id: 'exceptions',
    label: 'Exceções',
    value: overview.value.kpis.exceptionCount,
    helper: 'Casos fora do caminho padrão.',
  },
  {
    id: 'knowledge',
    label: 'Mudanças pendentes',
    value: overview.value.kpis.pendingKnowledgeChanges,
    helper: 'Sugestões aguardando decisão.',
  },
])

const quickActions = computed(() => [
  {
    id: 'owner_missing',
    title: 'Corrigir responsáveis temáticos',
    description: 'Abrir a fila com casos sem responsável temático efetivo.',
    route: buildQueueRoute({ scopeState: 'owner_missing', bucket: 'all', owner: 'todos' }),
  },
  {
    id: 'unassigned',
    title: 'Distribuir casos sem responsável',
    description: 'Abrir a fila de casos com responsável temático, mas sem analista definido.',
    route: buildQueueRoute({ owner: 'Sem responsavel', bucket: 'all' }),
  },
  {
    id: 'sla',
    title: 'Tratar risco de prazo',
    description: 'Abrir a fila priorizada por casos vencidos e em risco.',
    route: buildQueueRoute({ bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' }),
  },
  {
    id: 'knowledge',
    title: 'Decidir mudanças pendentes',
    description: 'Revisar propostas de melhoria da orientação operacional.',
    route: '/area/mudancas',
  },
  {
    id: 'governance',
    title: 'Ajustar regras operacionais',
    description: 'Revisar visibilidade por assunto e disponibilidade.',
    route: '/area/governanca',
  },
])

function questionToneClass(tone = '') {
  if (tone === 'danger') {
    return 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.72)]'
  }

  if (tone === 'warning') {
    return 'border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.72)]'
  }

  if (tone === 'info') {
    return 'border-[rgba(8,115,145,0.14)] bg-[rgba(224,242,254,0.62)]'
  }

  return 'border-[rgba(26,111,67,0.16)] bg-[rgba(220,252,231,0.58)]'
}

function recommendationToneClass(tone = '') {
  if (tone === 'danger') {
    return 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.72)]'
  }

  if (tone === 'warning') {
    return 'border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.72)]'
  }

  return 'border-[rgba(8,115,145,0.14)] bg-[rgba(224,242,254,0.62)]'
}

function recommendationPriorityLabel(priority = '') {
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
    <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-[780px]">
          <p class="text-sm font-semibold text-slate-900">
            Priorize risco, gargalo e necessidade de intervenção antes de abrir caso a caso.
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            O objetivo desta tela é orientar a próxima decisão. A fila, as mudanças e a governança são desdobramentos.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <RouterLink
            :to="buildQueueRoute({ bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' })"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Abrir fila priorizada
          </RouterLink>
          <RouterLink
            to="/area/mudancas"
            class="rounded-[8px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Decidir mudanças
          </RouterLink>
        </div>
      </div>
    </section>

    <OperationalCockpitPanel :cockpit="operationalCockpit" compact title="Cockpit da área" />

    <section class="grid gap-3 xl:grid-cols-4">
      <article
        v-for="item in overview.operationalQuestions"
        :key="item.id"
        :class="['rounded-[8px] border px-5 py-4', questionToneClass(item.tone)]"
      >
        <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">{{ item.question }}</p>
        <p class="mt-3 text-2xl font-semibold leading-none text-slate-950">{{ item.value }}</p>
        <p class="mt-3 text-sm font-semibold text-slate-900">{{ item.headline }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.helper }}</p>
        <RouterLink
          :to="buildQueueRoute(item.routeQuery || {})"
          class="mt-3 inline-flex items-center text-xs font-semibold text-[#0b6e8c] transition hover:underline"
        >
          Abrir recorte
        </RouterLink>
      </article>
    </section>

    <section class="rounded-[8px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-5 py-4">
        <p class="text-base font-semibold text-slate-950">Intervenção recomendada agora</p>
        <p class="mt-1 text-sm leading-6 text-slate-600">
          Ação gerencial sugerida com base em risco de prazo, distribuição e desequilíbrio da fila.
        </p>
      </div>
      <div class="grid gap-3 px-5 py-4">
        <article
          v-for="item in overview.interventionQueue"
          :key="item.id"
          :class="['rounded-[8px] border px-4 py-4', recommendationToneClass(item.tone)]"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
            <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {{ recommendationPriorityLabel(item.priority) }}
            </span>
          </div>
          <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.description }}</p>
          <RouterLink
            :to="buildQueueRoute(item.routeQuery || {})"
            class="mt-3 inline-flex items-center text-xs font-semibold text-[#0b6e8c] transition hover:underline"
          >
            Ir para fila com este recorte
          </RouterLink>
        </article>

        <p v-if="!overview.interventionQueue.length" class="text-sm leading-6 text-slate-600">
          Nenhuma exceção forte no momento. Mantenha o monitoramento de prazo e distribuição.
        </p>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
      <article
        v-for="item in kpiCards"
        :key="item.id"
        class="rounded-[8px] border border-slate-200 bg-white px-5 py-4"
      >
        <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">{{ item.label }}</p>
        <p class="mt-3 text-[1.8rem] font-semibold leading-none text-slate-950">{{ item.value }}</p>
        <p class="mt-2 text-xs leading-5 text-slate-600">{{ item.helper }}</p>
      </article>
    </section>

    <section class="rounded-[8px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-5 py-4">
        <p class="text-base font-semibold text-slate-950">Atalhos de ação gerencial</p>
        <p class="mt-1 text-sm leading-6 text-slate-600">
          Caminhos curtos para intervir na fila e ajustar a governança com menos esforço.
        </p>
      </div>
      <div class="grid gap-3 px-5 py-5 xl:grid-cols-2">
        <RouterLink
          v-for="item in quickActions"
          :key="item.id"
          :to="item.route"
          class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:bg-slate-50"
        >
          <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.description }}</p>
        </RouterLink>
      </div>
    </section>

    <section class="crm-split-grid gap-4">
      <article class="rounded-[8px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Carga por analista</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Compare distribuição, risco e fila de complemento para decidir redistribuição.
          </p>
        </div>
        <div class="divide-y divide-slate-200">
          <div
            v-for="item in overview.loadByAnalyst"
            :key="item.analystName"
            class="crm-table-scroll grid min-w-[42rem] gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.7fr))]"
          >
            <div>
              <p class="text-sm font-semibold text-slate-950">{{ item.analystName }}</p>
              <p class="mt-1 text-xs text-slate-500">Leitura de carga no escopo atual.</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Ativos</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.activeCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Vencidos</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.overdueCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Em risco</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.riskCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Complemento</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.waitingComplementCases }}</p>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-[8px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Impacto de regra na operação</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Sinais de configuração local que podem gerar gargalo, falta de responsável ou atraso.
          </p>
        </div>
        <div class="grid gap-3 px-5 py-4">
          <div
            v-for="item in overview.ruleImpactHints"
            :key="item.id"
            :class="['rounded-[8px] border px-4 py-4', recommendationToneClass(item.tone)]"
          >
            <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.description }}</p>
            <RouterLink
              to="/area/governanca"
              class="mt-3 inline-flex items-center text-xs font-semibold text-[#0b6e8c] transition hover:underline"
            >
              Abrir regras operacionais
            </RouterLink>
          </div>

          <p v-if="!overview.ruleImpactHints.length" class="text-sm leading-6 text-slate-600">
            Nenhum impacto forte de regra foi identificado no recorte atual.
          </p>
        </div>
      </article>
    </section>

    <section class="crm-split-grid gap-4">
      <article class="rounded-[8px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Gargalos por assunto</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Assuntos com maior concentração de casos ativos, vencidos ou em risco de prazo.
          </p>
        </div>
        <div class="divide-y divide-slate-200">
          <div
            v-for="item in overview.subjectBottlenecks"
            :key="item.id"
            class="crm-table-scroll grid min-w-[36rem] gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))]"
          >
            <div>
              <p class="text-sm font-semibold text-slate-950">{{ item.subjectLabel }}</p>
              <p class="mt-1 text-xs text-slate-500">
                {{ item.accessMode === 'restricted' ? 'Escopo restrito por analista' : 'Escopo aberto no time' }}
              </p>
              <RouterLink
                :to="buildQueueRoute({ subject: item.subjectLabel, bucket: 'all', sortField: 'sla', sortDirection: 'asc' })"
                class="mt-2 inline-flex items-center text-xs font-semibold text-[#0b6e8c] transition hover:underline"
              >
                Abrir casos deste assunto
              </RouterLink>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Backlog</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.openCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Vencidos</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.overdueCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Em risco</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.riskCases }}</p>
            </div>
          </div>

          <div v-if="!overview.subjectBottlenecks.length" class="px-5 py-5 text-sm leading-6 text-slate-600">
            Nenhum gargalo por assunto foi encontrado no recorte atual.
          </div>
        </div>
      </article>

      <article class="rounded-[8px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Casos expostos e mudanças pendentes</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Priorize os casos mais sensíveis e as sugestões de conhecimento que afetam a fila.
          </p>
        </div>
        <div class="grid gap-3 px-5 py-4">
          <RouterLink
            v-for="item in overview.attentionCases"
            :key="item.id"
            :to="buildCaseRoute(item)"
            class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:bg-slate-50"
          >
            <p class="text-sm font-semibold text-slate-950">{{ item.subject }}</p>
            <p class="mt-1 text-sm leading-6 text-slate-700">{{ item.currentAssigneeMeta }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ item.areaStatusLabel }} | {{ item.sla }}</p>
          </RouterLink>

          <div
            v-for="item in overview.pendingKnowledgeSuggestions"
            :key="item.id"
            class="rounded-[8px] border border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.52)] px-4 py-4"
          >
            <p class="text-sm font-semibold text-slate-950">{{ item.subjectLabel }}</p>
            <p class="mt-1 text-sm leading-6 text-slate-700">{{ item.title }}</p>
            <p class="mt-2 text-xs text-slate-500">
              {{ item.authorName }} | {{ item.createdAtLabel }}
            </p>
          </div>

          <RouterLink
            to="/area/mudancas"
            class="inline-flex items-center justify-center rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Abrir mudanças pendentes
          </RouterLink>
        </div>
      </article>
    </section>

    <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-4">
      <details>
        <summary class="cursor-pointer list-none text-sm font-semibold text-slate-900">
          Contrato mínimo esperado para a home gerencial
        </summary>
        <ul class="mt-3 grid gap-1 text-xs leading-5 text-slate-600">
          <li v-for="[field, type] in backendFieldEntries" :key="field">
            <strong>{{ field }}:</strong> {{ type }}
          </li>
        </ul>
      </details>
    </section>
  </div>
</template>
