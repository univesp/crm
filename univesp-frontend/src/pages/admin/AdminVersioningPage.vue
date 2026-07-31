<script setup>
import { computed, reactive, watchEffect } from 'vue'

import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { findKnowledgeBundleRuntime } from '@/services/adminVersioningRuntime'
import { createRuntimeRepositories } from '@/repositories/runtimeRepositories'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const authStore = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const repositories = computed(() => createRuntimeRepositories(studentSupportStore))
const ui = reactive({
  bundleType: '',
  versionId: '',
  lastEventSummary: '',
})

const runtime = computed(() => ({
  bundles: repositories.value.knowledge.listBundles(),
  metrics: [
    {
      label: 'Fluxos FAQ',
      value: repositories.value.knowledge.listBundles().length,
      hint: 'Fluxos cadastrados para publicação e revisao.',
    },
    {
      label: 'Versoes ativas',
      value: repositories.value.knowledge
        .listFoundation()
        .bundleVersions.filter((item) => item.statusCode === 'Published').length,
      hint: 'Versoes publicadas disponiveis para uso.',
    },
    {
      label: 'Em revisao',
      value: repositories.value.knowledge
        .listFoundation()
        .bundleVersions.filter((item) => ['Draft', 'In Review', 'Approved'].includes(item.statusCode)).length,
      hint: 'Rascunhos, revisoes e versoes aprovadas aguardando ação.',
    },
    {
      label: 'Aguardando aprovação',
      value: repositories.value.knowledge
        .listSuggestions()
        .filter((item) => item.statusCode === 'Pending Review').length,
      hint: 'Itens aguardando decisao de publicação ou revisao.',
    },
  ],
}))

const currentBundle = computed(() => findKnowledgeBundleRuntime(runtime.value.bundles, ui.bundleType))
const selectedVersion = computed(() => currentBundle.value?.versions.find((item) => item.id === ui.versionId) || null)
const lastEventSummaryLabel = computed(() =>
  ui.lastEventSummary.replace('publicada como referencia canonica de', 'publicada para'),
)

const publicationRows = computed(() =>
  runtime.value.bundles.map((bundle) => {
    const actionVersion =
      bundle.versions.find((version) => ['Approved', 'In Review', 'Draft'].includes(version.statusCode)) ||
      bundle.publishedVersion ||
      bundle.versions[0] ||
      null
    const reviewVersion = bundle.versions.find((version) => ['Approved', 'In Review', 'Draft'].includes(version.statusCode))
    const updatedAt = actionVersion?.publishedAt || actionVersion?.approvedAt || bundle.publishedVersion?.publishedAt || ''

    return {
      bundleType: bundle.bundleType,
      bundleLabel: bundle.bundleLabel,
      stateLabel: resolveBundleStateLabel(bundle, reviewVersion),
      activeVersionLabel: bundle.publishedVersion?.versionNumber || 'Sem versao ativa',
      reviewVersionLabel: reviewVersion?.versionNumber || 'Sem rascunho/revisao',
      pendingLabel: resolvePendingLabel(reviewVersion),
      updatedAtLabel: formatDateLabel(updatedAt),
      actionLabel: reviewVersion ? 'Revisar publicação' : 'Abrir fluxo',
      versionId: actionVersion?.id || '',
    }
  }),
)

watchEffect(() => {
  if (!ui.bundleType && runtime.value.bundles[0]) {
    ui.bundleType = runtime.value.bundles[0].bundleType
  }

  if (!selectedVersion.value && currentBundle.value?.versions?.[0]) {
    ui.versionId = currentBundle.value.versions[0].id
  }
})

function selectBundle(bundleType) {
  ui.bundleType = bundleType
  ui.versionId = ''
  ui.lastEventSummary = ''
}

function selectVersion(versionId) {
  if (!versionId) {
    ui.lastEventSummary = ''
    return
  }

  ui.versionId = versionId
  ui.lastEventSummary = ''
}

function approveSelectedVersion() {
  if (!selectedVersion.value) {
    return
  }

  const updated = repositories.value.knowledge.approveVersion({
    bundleVersionId: selectedVersion.value.id,
    actorName: authStore.displayName || 'Admin central',
    currentDate: new Date(),
  })

  if (updated) {
    ui.lastEventSummary = `Versao ${updated.versionNumber} aprovada para ${currentBundle.value?.bundleLabel || 'o bundle selecionado'}.`
  }
}

function publishSelectedVersion() {
  if (!selectedVersion.value) {
    return
  }

  const updated = repositories.value.knowledge.publishVersion({
    bundleVersionId: selectedVersion.value.id,
    actorName: authStore.displayName || 'Admin central',
    currentDate: new Date(),
  })

  if (updated) {
    ui.lastEventSummary = `Versao ${updated.versionNumber} publicada como referencia canonica de ${currentBundle.value?.bundleLabel || 'conhecimento'}.`
  }
}

function statusLabel(statusCode) {
  const labels = {
    Published: 'Publicado',
    Approved: 'Aprovado',
    'In Review': 'Em revisao',
    Draft: 'Rascunho',
    Archived: 'Arquivado',
    'Pending Review': 'Aguardando revisao',
  }

  return labels[statusCode] || statusCode || 'Nao informado'
}

function resolveBundleStateLabel(bundle, reviewVersion) {
  if (reviewVersion?.statusCode === 'Approved') {
    return 'Aguardando publicação'
  }

  if (reviewVersion) {
    return statusLabel(reviewVersion.statusCode)
  }

  if (bundle.publishedVersion) {
    return 'Publicado'
  }

  return 'Sem versao'
}

function resolvePendingLabel(version) {
  if (!version) {
    return 'Sem pendencia'
  }

  const labels = {
    Approved: 'Aprovada para publicar',
    'In Review': 'Revisar antes de publicar',
    Draft: 'Rascunho aberto',
  }

  return labels[version.statusCode] || statusLabel(version.statusCode)
}

function formatDateLabel(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('pt-BR').format(date)
}
</script>

<template>
  <div class="grid gap-6">
    <div class="grid gap-1">
      <h1 class="text-[1.8rem] font-semibold text-slate-950">Publicação</h1>
      <p class="text-sm leading-6 text-slate-500">Governança das versões dos fluxos FAQ</p>
    </div>

    <section class="crm-filter-grid--dense">
      <MetricCard
        v-for="metric in runtime.metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <SectionPanel
      eyebrow="FAQ & Conhecimento"
      title="Governança de publicação"
      description="Acompanhe versões ativas, revisões e pendências dos fluxos FAQ."
    >
      <div class="crm-table-scroll rounded-[8px] border border-slate-200 bg-white">
        <div class="min-w-[920px]">
          <div class="grid grid-cols-[1.45fr_0.9fr_0.85fr_1fr_1.1fr_0.9fr_0.95fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-normal text-slate-500">
            <span>Fluxo</span>
            <span>Estado</span>
            <span>Versão ativa</span>
            <span>Rascunho/revisão</span>
            <span>Pendência</span>
            <span>Última atualização</span>
            <span>Ação</span>
          </div>

          <button
            v-for="row in publicationRows"
            :key="row.bundleType"
            type="button"
            class="grid w-full grid-cols-[1.45fr_0.9fr_0.85fr_1fr_1.1fr_0.9fr_0.95fr] gap-3 border-b border-slate-100 px-4 py-4 text-left text-sm transition last:border-b-0 hover:bg-slate-50"
            :class="{ 'bg-red-50/40': row.bundleType === ui.bundleType }"
            @click="selectBundle(row.bundleType); selectVersion(row.versionId)"
          >
            <span class="font-semibold text-slate-950">{{ row.bundleLabel }}</span>
            <span>
              <StatusBadge :label="row.stateLabel" />
            </span>
            <span class="text-slate-700">{{ row.activeVersionLabel }}</span>
            <span class="text-slate-700">{{ row.reviewVersionLabel }}</span>
            <span class="text-slate-600">{{ row.pendingLabel }}</span>
            <span class="text-slate-600">{{ row.updatedAtLabel }}</span>
            <span class="font-semibold text-[var(--color-primary)]">{{ row.actionLabel }}</span>
          </button>
        </div>
      </div>
    </SectionPanel>

    <div v-if="currentBundle" class="grid gap-6">
      <SectionPanel
        eyebrow="Fluxo selecionado"
        :title="currentBundle.bundleLabel"
      >
        <div v-if="selectedVersion" class="grid gap-5">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Revisar publicação</p>
              <h2 class="mt-2 text-xl font-semibold text-slate-950">{{ selectedVersion.versionNumber }}</h2>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="rounded-[8px] bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!selectedVersion.canApprove"
                @click="approveSelectedVersion"
              >
                Revisar publicação
              </button>
              <button
                type="button"
                class="rounded-[8px] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!selectedVersion.canPublish"
                @click="publishSelectedVersion"
              >
                Publicar versão
              </button>
            </div>
          </div>

          <div
            v-if="ui.lastEventSummary"
            class="rounded-[8px] bg-slate-100 px-4 py-3 text-sm text-slate-600"
          >
            {{ lastEventSummaryLabel }}
          </div>

          <div class="grid gap-4 lg:grid-cols-4">
            <div class="inner-panel p-4">
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Versão ativa</p>
              <p class="mt-2 text-lg font-semibold text-slate-950">
                {{ currentBundle.publishedVersion?.versionNumber || 'Sem versão ativa' }}
              </p>
            </div>
            <div class="inner-panel p-4">
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Selecionada</p>
              <p class="mt-2 text-lg font-semibold text-slate-950">{{ selectedVersion.versionNumber }}</p>
            </div>
            <div class="inner-panel p-4">
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Estado</p>
              <p class="mt-2 text-lg font-semibold text-slate-950">{{ statusLabel(selectedVersion.statusCode) }}</p>
            </div>
            <div class="inner-panel p-4">
              <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Publicação</p>
              <p class="mt-2 text-lg font-semibold text-slate-950">
                {{ selectedVersion.canPublish ? 'Disponível' : 'Sem ação' }}
              </p>
            </div>
          </div>

          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Resumo da mudança</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">{{ selectedVersion.changeSummary || 'Sem resumo informado.' }}</p>
          </div>

          <div class="inner-panel p-5">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-500">Versões do fluxo</p>
                <p class="mt-1 text-sm text-slate-600">Selecione outra versão para revisar sem sair da tela.</p>
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-for="version in currentBundle.versions"
                :key="version.id"
                type="button"
                class="rounded-full px-3 py-2 text-xs font-semibold ring-1 ring-slate-200 transition hover:bg-slate-50"
                :class="version.id === ui.versionId ? 'bg-[var(--color-primary)] text-white ring-transparent' : 'bg-white text-slate-700'"
                @click="selectVersion(version.id)"
              >
                {{ version.versionNumber }} · {{ statusLabel(version.statusCode) }}
              </button>
            </div>
          </div>

          <details class="inner-panel p-5">
            <summary class="cursor-pointer select-none text-sm font-semibold text-slate-500">
              Ver detalhes técnicos
            </summary>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p class="text-sm font-semibold text-slate-500">Composição</p>
                <p class="mt-2 text-lg font-semibold text-slate-950">
                  {{ selectedVersion.nodeCount }} nó(s) / {{ selectedVersion.linkCount }} conexão(ões)
                </p>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-500">Aprovação</p>
                <p class="mt-2 text-lg font-semibold text-slate-950">
                  {{ selectedVersion.approvedBy || 'Sem aprovação' }}
                </p>
                <p class="mt-1 text-sm text-slate-600">
                  {{ selectedVersion.approvedAt || 'Sem data registrada' }}
                </p>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-500">Publicação registrada</p>
                <p class="mt-2 text-lg font-semibold text-slate-950">
                  {{ selectedVersion.publishedBy || 'Sem ator registrado' }}
                </p>
                <p class="mt-1 text-sm text-slate-600">
                  {{ selectedVersion.publishedAt || 'Sem publicação registrada' }}
                </p>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-500">Autor/criador</p>
                <p class="mt-2 text-lg font-semibold text-slate-950">
                  {{ selectedVersion.createdBy || 'Não informado' }}
                </p>
                <p class="mt-1 text-sm text-slate-600">
                  Versão ativa: {{ currentBundle.publishedVersion?.versionNumber || 'Nenhuma' }}
                </p>
              </div>
            </div>
          </details>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-xs font-semibold text-slate-500">Nenhuma versão selecionada</p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            Selecione um fluxo FAQ para ver versões, pendências e publicação.
          </h3>
        </div>
      </SectionPanel>
    </div>

    <div v-else class="inner-panel p-6">
      <p class="text-xs font-semibold text-slate-500">Nenhum fluxo selecionado</p>
      <h3 class="mt-3 text-2xl font-semibold text-slate-950">
        Selecione um fluxo FAQ para ver versões, pendências e publicação.
      </h3>
    </div>
  </div>
</template>
