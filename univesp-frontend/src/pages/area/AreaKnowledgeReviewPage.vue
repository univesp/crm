<script setup>
import { computed, reactive } from 'vue'

import {
  AREA_MANAGER_OPERATIONAL_SERVER_PARITY_NOTE,
  buildAreaManagerBackendReadiness,
} from '@/contracts/areaManagerOperationalContract'
import { createRuntimeRepositories } from '@/repositories/runtimeRepositories'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const repositories = computed(() => createRuntimeRepositories(studentSupportStore))
const backendReadiness = buildAreaManagerBackendReadiness({ hasServerOverview: false })
const backendImpactFields = computed(() => backendReadiness.governanceImpactFields || [])

const reviewNotes = reactive({})
const feedback = reactive({
  review: '',
})

const bundleLabelMap = Object.freeze({
  faq_aluno: 'FAQ do aluno',
  orientacao_op: 'Orientacao do OP',
  orientacao_operacional: 'Orientacao operacional',
  playbook_area: 'Playbook da area',
})

function formatSuggestionStatusLabel(statusCode = '') {
  if (statusCode === 'Pending Review') {
    return 'Aguardando decisao'
  }

  if (statusCode === 'Approved') {
    return 'Aprovada'
  }

  if (statusCode === 'Implemented') {
    return 'Implementada'
  }

  if (statusCode === 'Superseded') {
    return 'Substituida'
  }

  return 'Rejeitada'
}

function contentTypeLabel(contentType = '') {
  return bundleLabelMap[contentType] || 'Conteudo operacional'
}

function impactToneClass(level = '') {
  if (level === 'critical') {
    return 'border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.72)] text-[var(--color-danger)]'
  }

  if (level === 'high') {
    return 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.72)] text-[#8a5200]'
  }

  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function buildQueueImpactRoute(suggestion = {}) {
  return {
    path: '/area/fila',
    query: {
      subject:
        operationalImpactBySubject.value.get(buildSubjectKey(suggestion.themeKey, suggestion.subsubjectKey))
          ?.subjectLabel ||
        suggestion.subjectLabel,
      bucket: 'all',
      sortField: 'sla',
      sortDirection: 'asc',
    },
  }
}

function buildGuidanceRoute(suggestion = {}) {
  return {
    path: '/area/orientacao',
    query: {
      theme: suggestion.themeKey,
      subsubject: suggestion.subsubjectKey,
    },
  }
}

const areaSuggestions = computed(() =>
  repositories.value.knowledge
    .listSuggestions()
    .filter((item) => item.areaLabel === auth.mockContext.currentArea)
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()),
)

const pendingSuggestions = computed(() =>
  areaSuggestions.value.filter((item) => item.statusCode === 'Pending Review'),
)

const pendingSuggestionsRanked = computed(() =>
  pendingSuggestions.value
    .map((suggestion) => ({
      ...suggestion,
      impact: resolveSuggestionImpact(suggestion),
    }))
    .sort((left, right) => {
      const priority = {
        critical: 3,
        high: 2,
        moderate: 1,
      }

      return (priority[right.impact.level] || 0) - (priority[left.impact.level] || 0)
    }),
)

const approvedSuggestions = computed(() =>
  areaSuggestions.value.filter((item) => item.statusCode === 'Approved'),
)

const runtimeBundles = computed(() => repositories.value.knowledge.listBundles())
const governanceRows = computed(() => studentSupportStore.areaGovernanceRows(auth.mockContext))
const areaEntries = computed(() => studentSupportStore.areaQueueEntries(auth.mockContext))

function buildSubjectKey(themeKey = '', subsubjectKey = '') {
  return `${String(themeKey || '').trim().toLowerCase()}::${String(subsubjectKey || '').trim().toLowerCase()}`
}

const operationalImpactBySubject = computed(() => {
  const map = new Map()

  for (const row of governanceRows.value) {
    map.set(buildSubjectKey(row.themeKey, row.subsubjectKey), {
      subjectLabel: row.subjectLabel,
      openCases: row.openCases || 0,
      overdueCases: row.overdueCases || 0,
      riskCases: row.riskCases || 0,
      accessMode: row.accessMode || 'team',
      allowedCount: Array.isArray(row.allowedAnalysts) ? row.allowedAnalysts.length : 0,
    })
  }

  for (const entry of areaEntries.value) {
    const key = buildSubjectKey(entry.themeKey, entry.subsubjectKey)
    const current = map.get(key) || {
      subjectLabel: entry.subjectScopeLabel || `${entry.theme || entry.themeKey} / ${entry.subsubject || entry.subsubjectKey}`,
      openCases: 0,
      overdueCases: 0,
      riskCases: 0,
      accessMode: entry.subjectScopeRule?.accessMode || 'team',
      allowedCount: Array.isArray(entry.subjectScopeRule?.allowedAnalysts) ? entry.subjectScopeRule.allowedAnalysts.length : 0,
    }

    if (entry.areaBucket !== 'completed') {
      current.openCases += 1
    }

    if (entry.isOverdue) {
      current.overdueCases += 1
    }

    if (entry.isAtRisk) {
      current.riskCases += 1
    }

    map.set(key, current)
  }

  return map
})

function resolveSuggestionImpact(suggestion = {}) {
  const impact =
    operationalImpactBySubject.value.get(buildSubjectKey(suggestion.themeKey, suggestion.subsubjectKey)) || null

  const unassignedCount = areaEntries.value.filter(
    (entry) =>
      buildSubjectKey(entry.themeKey, entry.subsubjectKey) === buildSubjectKey(suggestion.themeKey, suggestion.subsubjectKey) &&
      entry.isUnassigned,
  ).length

  const restrictedWithLowCoverage =
    impact?.accessMode === 'restricted' && Number(impact.allowedCount || 0) <= 1 && Number(impact.openCases || 0) > 0

  if ((impact?.overdueCases || 0) > 0 || unassignedCount > 0) {
    return {
      level: 'critical',
      label: 'Impacto alto',
      helper: `Ha ${impact?.overdueCases || 0} vencido(s) e ${unassignedCount} sem responsavel neste assunto.`,
    }
  }

  if ((impact?.riskCases || 0) > 0 || restrictedWithLowCoverage) {
    return {
      level: 'high',
      label: 'Impacto relevante',
      helper: restrictedWithLowCoverage
        ? 'Escopo restrito com cobertura baixa pode criar gargalo.'
        : `Ha ${impact?.riskCases || 0} caso(s) em risco neste assunto.`,
    }
  }

  return {
    level: 'moderate',
    label: 'Impacto moderado',
    helper: 'Mudanca importante, sem urgencia critica na fila.',
  }
}

const summaryCards = computed(() => [
  {
    id: 'pending',
    label: 'Pendentes',
    value: pendingSuggestions.value.length,
    helper: 'Sugestoes aguardando decisao gerencial.',
  },
  {
    id: 'approved',
    label: 'Aprovadas',
    value: approvedSuggestions.value.length,
    helper: 'Mudancas aceitas e aguardando publicacao na trilha canonica.',
  },
  {
    id: 'published',
    label: 'Bases vigentes',
    value: runtimeBundles.value.filter((bundle) => bundle.publishedVersion).length,
    helper: 'Bundles com versao publicada e disponivel para uso.',
  },
  {
    id: 'editing',
    label: 'Versoes em edicao',
    value: runtimeBundles.value.reduce(
      (total, bundle) => total + bundle.versions.filter((version) => ['Draft', 'In Review', 'Approved'].includes(version.statusCode)).length,
      0,
    ),
    helper: 'Versoes em rascunho, revisao ou aprovadas aguardando publicacao.',
  },
  {
    id: 'critical-impact',
    label: 'Impacto alto',
    value: pendingSuggestionsRanked.value.filter((item) => item.impact.level === 'critical').length,
    helper: 'Sugestoes que hoje ja afetam SLA ou ownership.',
  },
])

function reviewSuggestion(suggestion, decision) {
  repositories.value.knowledge.reviewSuggestion({
    suggestionId: suggestion.id,
    decision,
    reviewerName: auth.mockContext.userName,
    decisionNote: String(reviewNotes[suggestion.id] || '').trim(),
  })

  reviewNotes[suggestion.id] = ''
  feedback.review =
    decision === 'approved'
      ? `Sugestao aprovada para ${suggestion.subjectLabel}.`
      : `Sugestao rejeitada para ${suggestion.subjectLabel}.`
}
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-[760px]">
          <p class="text-sm font-semibold text-slate-900">
            Use esta camada para decidir o que entra na trilha oficial da area. O objetivo aqui nao e consultar caso, e sim revisar mudancas, preservar a base vigente e encaminhar o que precisa de publicacao.
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Conteudo vigente, aprovacao e regra operacional agora ficam separados para reduzir mistura e tornar a governanca mais objetiva.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <RouterLink
            to="/area/orientacao"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Abrir conteudo vigente
          </RouterLink>
          <RouterLink
            to="/area/governanca"
            class="rounded-[8px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Regras operacionais
          </RouterLink>
        </div>
      </div>
      <p class="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
        {{ AREA_MANAGER_OPERATIONAL_SERVER_PARITY_NOTE }}
      </p>
    </section>

    <section class="crm-stat-grid">
      <article
        v-for="item in summaryCards"
        :key="item.id"
        class="rounded-[8px] border border-slate-200 bg-white px-5 py-4"
      >
        <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">{{ item.label }}</p>
        <p class="mt-3 text-[2rem] font-semibold leading-none text-slate-950">{{ item.value }}</p>
        <p class="mt-3 text-sm leading-6 text-slate-600">{{ item.helper }}</p>
      </article>
    </section>

    <section class="rounded-[8px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-5 py-4">
        <p class="text-base font-semibold text-slate-950">Sugestoes aguardando decisao</p>
        <p class="mt-1 text-sm leading-6 text-slate-600">
          Aqui voce revisa o que a operacao sugeriu mudar, sem alterar automaticamente o conteudo vigente.
        </p>
      </div>

      <div
        v-if="feedback.review"
        class="border-b border-slate-200 bg-[rgba(26,111,67,0.06)] px-5 py-3 text-sm font-medium text-[var(--color-success)]"
      >
        {{ feedback.review }}
      </div>

      <div v-if="pendingSuggestionsRanked.length" class="grid gap-4 px-5 py-5">
        <article
          v-for="suggestion in pendingSuggestionsRanked"
          :key="suggestion.id"
          class="rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-4"
        >
          <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">
                {{ contentTypeLabel(suggestion.contentType) }}
              </p>
              <p class="mt-2 text-sm font-semibold text-slate-950">{{ suggestion.subjectLabel }}</p>
              <p class="mt-1 text-sm leading-6 text-slate-700">{{ suggestion.title }}</p>
            </div>
            <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {{ formatSuggestionStatusLabel(suggestion.statusCode) }}
            </span>
          </div>

          <div :class="['mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5', impactToneClass(suggestion.impact.level)]">
            <p class="font-semibold">{{ suggestion.impact.label }}</p>
            <p class="mt-1">{{ suggestion.impact.helper }}</p>
            <RouterLink
              :to="buildQueueImpactRoute(suggestion)"
              class="mt-2 inline-flex items-center font-semibold transition hover:underline"
            >
              Ver casos impactados na fila
            </RouterLink>
          </div>

          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            <div class="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Conteudo vigente</p>
              <p class="mt-2 text-sm leading-6 text-slate-700">{{ suggestion.currentContent || 'Sem conteudo vigente registrado.' }}</p>
            </div>
            <div class="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Proposta</p>
              <p class="mt-2 text-sm leading-6 text-slate-700">{{ suggestion.proposalText }}</p>
            </div>
          </div>

          <div class="mt-3 rounded-[8px] border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Justificativa operacional</p>
            <p class="mt-2 text-sm leading-6 text-slate-700">{{ suggestion.rationale }}</p>
            <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{{ suggestion.authorName }} | {{ suggestion.createdAtLabel }}</span>
              <RouterLink :to="buildGuidanceRoute(suggestion)" class="font-semibold text-[#0b6e8c] transition hover:underline">
                Abrir assunto no conteudo vigente
              </RouterLink>
            </div>
          </div>

          <label class="mt-4 grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Parecer gerencial</span>
            <textarea
              v-model="reviewNotes[suggestion.id]"
              rows="3"
              class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
              placeholder="Registre por que a sugestao deve ser aprovada ou rejeitada."
            ></textarea>
          </label>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-[8px] bg-[var(--color-success)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              @click="reviewSuggestion(suggestion, 'approved')"
            >
              Aprovar sugestao
            </button>
            <button
              type="button"
              class="rounded-[8px] border border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.76)] px-4 py-2.5 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[rgba(253,236,237,0.92)]"
              @click="reviewSuggestion(suggestion, 'rejected')"
            >
              Rejeitar sugestao
            </button>
          </div>
        </article>
      </div>

      <div v-else class="px-5 py-5 text-sm leading-6 text-slate-600">
        Nenhuma sugestao pendente de decisao nesta area.
      </div>
    </section>

    <section class="crm-split-grid gap-4">
      <article class="rounded-[8px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Aprovadas aguardando publicacao</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Mudancas ja aceitas pela gestao, mas que ainda dependem da trilha de publicacao vigente.
          </p>
        </div>

        <div v-if="approvedSuggestions.length" class="grid gap-3 px-5 py-5">
          <div
            v-for="item in approvedSuggestions"
            :key="item.id"
            class="rounded-[8px] border border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.42)] px-4 py-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-950">{{ item.subjectLabel }}</p>
                <p class="mt-1 text-sm leading-6 text-slate-700">{{ item.title }}</p>
              </div>
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {{ formatSuggestionStatusLabel(item.statusCode) }}
              </span>
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-700">{{ item.decisionNote || 'Aguardando consolidacao na proxima publicacao.' }}</p>
            <p class="mt-2 text-xs text-slate-500">{{ item.reviewerName || 'Gestao da area' }} | {{ item.reviewedAtLabel || 'Sem data de revisao' }}</p>
          </div>
        </div>

        <div v-else class="px-5 py-5 text-sm leading-6 text-slate-600">
          Nenhuma sugestao aprovada aguardando publicacao neste recorte.
        </div>
      </article>

      <article class="rounded-[8px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Trilha vigente de publicacao</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Leitura rapida do que esta publicado hoje e do que ainda esta em edicao controlada.
          </p>
        </div>

        <div class="grid gap-3 px-5 py-5">
          <div
            v-for="bundle in runtimeBundles"
            :key="bundle.bundleType"
            class="rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-950">{{ bundle.bundleLabel }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ bundle.bundleType }}</p>
              </div>
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {{ bundle.publishedVersion?.versionNumber || 'Sem versao publicada' }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Publicada</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ bundle.publishedVersion?.statusCode || 'Sem publicacao' }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ bundle.publishedVersion?.publishedAt || 'Sem data registrada' }}</p>
              </div>
              <div class="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Em edicao</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">
                  {{ bundle.versions.filter((version) => ['Draft', 'In Review', 'Approved'].includes(version.statusCode)).length }}
                </p>
                <p class="mt-1 text-xs text-slate-500">Versoes em rascunho, revisao ou aprovadas.</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-4">
      <details>
        <summary class="cursor-pointer list-none text-sm font-semibold text-slate-900">
          Campos de impacto que o backend deve entregar para decisao de mudancas
        </summary>
        <ul class="mt-3 grid gap-1 text-xs leading-5 text-slate-600">
          <li v-for="field in backendImpactFields" :key="field">
            <strong>{{ field }}</strong>
          </li>
        </ul>
      </details>
    </section>
  </div>
</template>
