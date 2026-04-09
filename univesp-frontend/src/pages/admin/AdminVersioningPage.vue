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
      label: 'Bundles canônicos',
      value: repositories.value.knowledge.listBundles().length,
      hint: 'Bases publicadas ou em edicao controlada pelo workflow canonico.',
    },
    {
      label: 'Versoes publicadas',
      value: repositories.value.knowledge
        .listFoundation()
        .bundleVersions.filter((item) => item.statusCode === 'Published').length,
      hint: 'Versoes ativas que podem ser usadas pelos protocolos.',
    },
    {
      label: 'Versoes em edicao',
      value: repositories.value.knowledge
        .listFoundation()
        .bundleVersions.filter((item) => ['Draft', 'In Review', 'Approved'].includes(item.statusCode)).length,
      hint: 'Rascunhos, revisoes e versoes aprovadas aguardando publicacao.',
    },
    {
      label: 'Sugestoes pendentes',
      value: repositories.value.knowledge
        .listSuggestions()
        .filter((item) => item.statusCode === 'Pending Review').length,
      hint: 'Sugestoes da operacao aguardando revisao ou decisao gerencial.',
    },
  ],
}))

const currentBundle = computed(() => findKnowledgeBundleRuntime(runtime.value.bundles, ui.bundleType))
const selectedVersion = computed(() => currentBundle.value?.versions.find((item) => item.id === ui.versionId) || null)

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
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="metric in runtime.metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <SectionPanel
      eyebrow="Bundles"
      title="Versionamento canônico"
      description="Cada bundle publicado referencia seus proprios snapshots de nos e links. Publicacao e historico usam a mesma trilha canonica da operacao."
    >
      <div class="grid gap-3 xl:grid-cols-2">
        <button
          v-for="bundle in runtime.bundles"
          :key="bundle.bundleType"
          type="button"
          class="option-button text-left"
          :class="{ 'is-active': bundle.bundleType === ui.bundleType }"
          @click="selectBundle(bundle.bundleType)"
        >
          <p class="text-xs font-semibold text-slate-500">{{ bundle.bundleType }}</p>
          <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ bundle.bundleLabel }}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {{ bundle.versions.length }} versao(oes) registradas na trilha canonica.
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <StatusBadge :label="bundle.publishedVersion ? `publicada ${bundle.publishedVersion.versionNumber}` : 'sem publicacao'" />
            <StatusBadge :label="`${bundle.publicationHistory.length} publicacao(oes)`" />
          </div>
        </button>
      </div>
    </SectionPanel>

    <div v-if="currentBundle" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <SectionPanel
        eyebrow="Versoes"
        :title="currentBundle.bundleLabel"
        description="A publicacao agora age sobre a mesma estrutura canônica usada por snapshots, auditoria e futuros recursos de backend."
      >
        <div class="grid gap-3">
          <button
            v-for="version in currentBundle.versions"
            :key="version.id"
            type="button"
            class="option-button text-left"
            :class="{ 'is-active': version.id === ui.versionId }"
            @click="selectVersion(version.id)"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-xs font-semibold text-slate-500">{{ version.bundleType }}</p>
                <h3 class="mt-2 text-lg font-semibold text-slate-950">{{ version.versionNumber }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ version.changeSummary }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="version.statusCode" />
                <StatusBadge :label="`${version.nodeCount} no(s)`" />
                <StatusBadge :label="`${version.linkCount} link(s)`" />
              </div>
            </div>
          </button>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Publicacao"
        title="Versao selecionada"
        description="Aprovacao e publicacao mudam a referencia ativa do bundle sem depender do runtime legado de versoes."
      >
        <div v-if="selectedVersion" class="grid gap-5">
          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Versao</p>
            <p class="mt-3 text-lg font-semibold text-slate-950">{{ selectedVersion.versionNumber }}</p>
            <p class="mt-2 text-sm text-slate-600">{{ selectedVersion.changeSummary }}</p>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Estado</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ selectedVersion.statusCode }}</p>
              <p class="mt-2 text-sm text-slate-600">Criada por {{ selectedVersion.createdBy }}</p>
            </div>

            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Snapshots congelados</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">
                {{ selectedVersion.nodeCount }} no(s) / {{ selectedVersion.linkCount }} link(s)
              </p>
              <p class="mt-2 text-sm text-slate-600">
                Cada versao aponta para seus proprios snapshots canônicos.
              </p>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Ultima aprovacao</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ selectedVersion.approvedBy || 'Sem aprovacao' }}</p>
              <p class="mt-2 text-sm text-slate-600">{{ selectedVersion.publishedAt || 'Sem publicacao registrada' }}</p>
            </div>

            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Publicacao ativa</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">
                {{ currentBundle.publishedVersion?.versionNumber || 'Nenhuma' }}
              </p>
              <p class="mt-2 text-sm text-slate-600">
                {{ currentBundle.publishedVersion?.publishedBy || 'Sem ator registrado' }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedVersion.canApprove"
              @click="approveSelectedVersion"
            >
              Aprovar versao
            </button>
            <button
              type="button"
              class="rounded-[18px] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(209,50,57,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedVersion.canPublish"
              @click="publishSelectedVersion"
            >
              Publicar versao
            </button>
            <span
              v-if="ui.lastEventSummary"
              class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
            >
              {{ ui.lastEventSummary }}
            </span>
          </div>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-xs font-semibold text-slate-500">Nenhuma versao selecionada</p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            Selecione um bundle para inspecionar sua publicacao canonica.
          </h3>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
