<script setup>
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const overview = computed(() => studentSupportStore.areaManagerOverview(auth.mockContext))

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

const healthCards = computed(() => [
  {
    id: 'waiting-complement',
    label: 'Aguardando complemento',
    value: overview.value.health.waitingComplement,
    helper: 'Casos que voltaram para o polo e ainda dependem de novo subsidio.',
  },
  {
    id: 'rerouted',
    label: 'Reencaminhados',
    value: overview.value.health.rerouted,
    helper: 'Casos que sairam do caminho inicial da area e pedem leitura de excecao.',
  },
  {
    id: 'pending-suggestions',
    label: 'Conhecimento pendente',
    value: overview.value.health.pendingSuggestions,
    helper: 'Sugestoes aguardando decisao antes de entrar na trilha oficial.',
  },
  {
    id: 'load-gap',
    label: 'Gap de carga',
    value: overview.value.health.overloadGap,
    helper: 'Diferenca entre quem esta mais e menos carregado no time.',
  },
])

const quickActions = computed(() => [
  {
    id: 'unassigned',
    title: 'Atacar casos sem responsavel',
    description: 'Abrir a fila com foco imediato nos casos sem dono definido.',
    route: buildQueueRoute({ scopeState: 'unassigned', bucket: 'all' }),
  },
  {
    id: 'needs-review',
    title: 'Atacar backlog da analise',
    description: 'Abrir os casos que ainda pedem leitura tecnica da area.',
    route: buildQueueRoute({ bucket: 'needs_review' }),
  },
  {
    id: 'knowledge',
    title: 'Decidir mudancas pendentes',
    description: 'Ir direto para sugestoes de conhecimento que aguardam decisao.',
    route: '/area/mudancas',
  },
  {
    id: 'governance',
    title: 'Ajustar regras operacionais',
    description: 'Abrir visibilidade por assunto e disponibilidade do time.',
    route: '/area/governanca',
  },
])

function recommendationToneClass(tone = '') {
  if (tone === 'danger') {
    return 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.72)]'
  }

  if (tone === 'warning') {
    return 'border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.72)]'
  }

  return 'border-[rgba(8,115,145,0.14)] bg-[rgba(224,242,254,0.62)]'
}
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[16px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-[760px]">
          <p class="text-sm font-semibold text-slate-900">
            Use esta visao para entender rapidamente a saude da area e agir sobre backlog, ownership vazio, conhecimento pendente e distribuicao desigual.
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            A fila continua disponivel para o caso a caso, mas esta precisa ser sua entrada principal de supervisao.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <RouterLink
            :to="buildQueueRoute({ bucket: 'needs_review' })"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Casos da area
          </RouterLink>
          <RouterLink
            to="/area/mudancas"
            class="rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Mudancas pendentes
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="grid gap-3 lg:grid-cols-4">
      <article
        v-for="item in overview.summary"
        :key="item.id"
        class="rounded-[16px] border border-slate-200 bg-white px-5 py-4"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{{ item.label }}</p>
        <p class="mt-3 text-[2rem] font-semibold leading-none text-slate-950">{{ item.value }}</p>
        <p class="mt-3 text-sm leading-6 text-slate-600">{{ item.helper }}</p>
      </article>
    </section>

    <section class="grid gap-3 lg:grid-cols-4">
      <article
        v-for="item in healthCards"
        :key="item.id"
        class="rounded-[16px] border border-slate-200 bg-white px-5 py-4"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{{ item.label }}</p>
        <p class="mt-3 text-[1.8rem] font-semibold leading-none text-slate-950">{{ item.value }}</p>
        <p class="mt-3 text-sm leading-6 text-slate-600">{{ item.helper }}</p>
      </article>
    </section>

    <section class="rounded-[16px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-5 py-4">
        <p class="text-base font-semibold text-slate-950">Agir agora</p>
        <p class="mt-1 text-sm leading-6 text-slate-600">
          Atalhos de intervencao para backlog, excecao, conhecimento e regra operacional.
        </p>
      </div>
      <div class="grid gap-3 px-5 py-5 xl:grid-cols-2">
        <RouterLink
          v-for="item in quickActions"
          :key="item.id"
          :to="item.route"
          class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:bg-slate-50"
        >
          <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.description }}</p>
        </RouterLink>
      </div>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <article class="rounded-[16px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Carga por analista</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Veja distribuicao, risco e quem ainda pode absorver casos sem responsavel.
          </p>
        </div>
        <div class="divide-y divide-slate-200">
          <div
            v-for="item in overview.loadByAnalyst"
            :key="item.analystName"
            class="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.7fr))]"
          >
            <div>
              <p class="text-sm font-semibold text-slate-950">{{ item.analystName }}</p>
              <p class="mt-1 text-xs text-slate-500">Carga ativa e risco no escopo atual.</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Ativos</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.activeCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Vencidos</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.overdueCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Em risco</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.riskCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Complemento</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.waitingComplementCases }}</p>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-[16px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Sugestoes de redistribuicao</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Apoios operacionais para agir sobre desequilibrio, ownership vazio, atraso e gargalo recorrente.
          </p>
        </div>
        <div class="grid gap-3 px-5 py-4">
          <div
            v-for="item in overview.redistributionSuggestions"
            :key="item.id"
            :class="['rounded-[14px] border px-4 py-4', recommendationToneClass(item.tone)]"
          >
            <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.description }}</p>
          </div>

          <p v-if="!overview.redistributionSuggestions.length" class="text-sm leading-6 text-slate-600">
            Nenhuma excecao forte foi encontrada no recorte atual. A operacao segue estavel nesta area.
          </p>
        </div>
      </article>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <article class="rounded-[16px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Gargalos por assunto</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Assuntos com maior concentracao de backlog, risco ou vencimento.
          </p>
        </div>
        <div class="divide-y divide-slate-200">
          <div
            v-for="item in overview.subjectBottlenecks"
            :key="item.id"
            class="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))]"
          >
            <div>
              <p class="text-sm font-semibold text-slate-950">{{ item.subjectLabel }}</p>
              <p class="mt-1 text-xs text-slate-500">
                {{ item.accessMode === 'restricted' ? 'Assunto restrito por analista' : 'Assunto aberto para o time' }}
              </p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Backlog</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.openCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Vencidos</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.overdueCases }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Em risco</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.riskCases }}</p>
            </div>
          </div>

          <div v-if="!overview.subjectBottlenecks.length" class="px-5 py-5 text-sm leading-6 text-slate-600">
            Nenhum gargalo por assunto foi encontrado no recorte atual.
          </div>
        </div>
      </article>

      <article class="rounded-[16px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Excecoes e conhecimento pendente</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Casos expostos e mudancas de conhecimento que precisam de decisao gerencial agora.
          </p>
        </div>
        <div class="grid gap-3 px-5 py-4">
          <RouterLink
            v-for="item in overview.attentionCases"
            :key="item.id"
            :to="buildCaseRoute(item)"
            class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:bg-slate-50"
          >
            <p class="text-sm font-semibold text-slate-950">{{ item.subject }}</p>
            <p class="mt-1 text-sm leading-6 text-slate-700">{{ item.currentAssigneeMeta }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ item.areaStatusLabel }} | {{ item.sla }}</p>
          </RouterLink>

          <div
            v-for="item in overview.pendingKnowledgeSuggestions"
            :key="item.id"
            class="rounded-[14px] border border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.52)] px-4 py-4"
          >
            <p class="text-sm font-semibold text-slate-950">{{ item.subjectLabel }}</p>
            <p class="mt-1 text-sm leading-6 text-slate-700">{{ item.title }}</p>
            <p class="mt-2 text-xs text-slate-500">
              {{ item.authorName }} | {{ item.createdAtLabel }}
            </p>
          </div>

          <RouterLink
            to="/area/mudancas"
            class="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Abrir mudancas pendentes
          </RouterLink>
        </div>
      </article>
    </section>
  </div>
</template>
