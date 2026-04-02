<script setup>
import { computed, reactive, watchEffect } from 'vue'

import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  applyDomainApproval,
  applyDomainPublication,
  buildAdminVersioningRuntime,
  cloneAdminVersioningState,
  findDiffItem,
  findVersioningDomain,
} from '@/services/adminVersioningRuntime'

const versioningState = reactive(cloneAdminVersioningState())
const ui = reactive({
  domainKey: 'faq',
  selectedDiffId: null,
  lastEventSummary: '',
})

const runtime = computed(() =>
  buildAdminVersioningRuntime({
    state: versioningState,
  }),
)

const currentDomain = computed(() => findVersioningDomain(runtime.value.domains, ui.domainKey))
const selectedDiffItem = computed(() =>
  findDiffItem(currentDomain.value?.diffItems || [], ui.selectedDiffId),
)
const selectedDomainEvents = computed(() =>
  runtime.value.publicationEvents.filter((event) => event.domainKey === ui.domainKey),
)

watchEffect(() => {
  if (!currentDomain.value && runtime.value.domains[0]) {
    ui.domainKey = runtime.value.domains[0].key
  }

  if (!selectedDiffItem.value && currentDomain.value?.diffItems?.[0]) {
    ui.selectedDiffId = currentDomain.value.diffItems[0].id
  }

  if (!currentDomain.value?.diffItems?.length) {
    ui.selectedDiffId = null
  }
})

function selectDomain(domainKey) {
  ui.domainKey = domainKey
  ui.selectedDiffId = null
  ui.lastEventSummary = ''
}

function selectDiff(diffId) {
  ui.selectedDiffId = diffId
}

function buildActionTypeLabel(actionType) {
  return actionType === 'approve' ? 'Aprovacao' : 'Publicacao'
}

function buildChangeTypeLabel(changeType) {
  if (changeType === 'new') {
    return 'Novo'
  }

  if (changeType === 'removed') {
    return 'Removido'
  }

  return 'Alterado'
}

function approveDraft() {
  const event = applyDomainApproval({
    state: versioningState,
    domainKey: ui.domainKey,
    actor: versioningState.currentActor,
    currentDate: new Date(),
  })

  ui.lastEventSummary = event?.summary || ''
}

function publishDraft() {
  const event = applyDomainPublication({
    state: versioningState,
    domainKey: ui.domainKey,
    actor: versioningState.currentActor,
    currentDate: new Date(),
  })

  ui.lastEventSummary = event?.summary || ''
}
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Admin"
      title="Publicacao e versionamento"
      description="Compare a edicao atual com a versao publicada antes de aprovar ou publicar mudancas."
    >
      <div class="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Ator atual</p>
            <p class="mt-3 text-lg font-semibold text-slate-950">{{ runtime.currentActor?.name }}</p>
            <p class="mt-2 text-sm text-slate-600">{{ runtime.currentActor?.role }}</p>
          </div>
          <div class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-500">Dominios governados</p>
            <p class="mt-3 text-lg font-semibold text-slate-950">{{ runtime.domains.length }} dominios</p>
            <p class="mt-2 text-sm text-slate-600">
              FAQ, parametros e permissoes seguem o mesmo fluxo de aprovacao e publicacao.
            </p>
          </div>
        </div>

        <div class="inner-panel p-5">
          <p class="text-sm font-semibold text-slate-500">Leitura comparativa</p>
          <p class="mt-3 text-lg font-semibold text-slate-950">Mudancas reunidas por dominio</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            O painel destaca o que foi alterado antes da versao nova seguir para aprovacao e
            publicacao.
          </p>
        </div>
      </div>
    </SectionPanel>

    <SectionPanel
      eyebrow="Dominios"
      title="Selecione o dominio"
      description="Cada dominio mostra a edicao atual, a versao publicada e o volume de mudancas pendentes."
    >
      <div class="grid gap-3 xl:grid-cols-3">
        <button
          v-for="domain in runtime.domains"
          :key="domain.key"
          type="button"
          class="option-button text-left"
          :class="{ 'is-active': ui.domainKey === domain.key }"
          @click="selectDomain(domain.key)"
        >
          <p class="text-xs font-semibold text-slate-500">{{ domain.key }}</p>
          <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ domain.label }}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ domain.description }}</p>

          <div class="mt-4 flex flex-wrap gap-2">
            <StatusBadge :label="`edicao ${domain.draft.version}`" />
            <StatusBadge :label="`publicada ${domain.published.version}`" />
            <StatusBadge :label="`${domain.diffSummary.total} mudanca(s)`" />
          </div>
        </button>
      </div>
    </SectionPanel>

    <section v-if="currentDomain" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="metric in currentDomain.metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <div v-if="currentDomain" class="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <SectionPanel
        eyebrow="Versoes"
        title="Edicao atual e versao publicada"
        description="Compare o estado atual com a versao em vigor e siga para aprovacao ou publicacao."
      >
        <div class="grid gap-5">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Edicao atual</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ currentDomain.draft.version }}</p>
              <p class="mt-2 text-sm text-slate-600">
                {{ currentDomain.draft.updatedAt }} - {{ currentDomain.draft.updatedBy }}
              </p>
              <p class="mt-3 text-sm leading-6 text-slate-600">{{ currentDomain.draft.summary }}</p>
            </div>

            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Versao publicada</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ currentDomain.published.version }}</p>
              <p class="mt-2 text-sm text-slate-600">
                {{ currentDomain.published.updatedAt }} - {{ currentDomain.published.updatedBy }}
              </p>
              <p class="mt-3 text-sm leading-6 text-slate-600">{{ currentDomain.published.summary }}</p>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Aprovacao</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ currentDomain.approval.status }}</p>
              <p class="mt-2 text-sm text-slate-600">
                {{ currentDomain.approval.approvedAt || 'Sem aprovacao registrada' }}
              </p>
              <p class="mt-2 text-sm text-slate-600">
                {{ currentDomain.approval.approvedBy || 'Aguardando aprovacao' }}
              </p>
            </div>

            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Resumo das mudancas</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ currentDomain.diffHeadline }}</p>
              <p class="mt-2 text-sm text-slate-600">
                Fila, prazo, criticidade, calendario e permissoes aparecem reunidos no mesmo
                painel.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              @click="approveDraft"
            >
              Aprovar edicao
            </button>
            <button
              type="button"
              class="rounded-[18px] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(209,50,57,0.18)]"
              @click="publishDraft"
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
      </SectionPanel>

      <SectionPanel
        eyebrow="Mudancas"
        title="Itens em comparacao"
        description="Cada item representa um tema, regra, nivel, destaque de calendario ou politica alterada, nova ou removida."
      >
        <div v-if="currentDomain.diffItems.length" class="grid gap-3">
          <button
            v-for="item in currentDomain.diffItems"
            :key="item.id"
            type="button"
            class="option-button text-left"
            :class="{ 'is-active': ui.selectedDiffId === item.id }"
            @click="selectDiff(item.id)"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-xs font-semibold text-slate-500">
                  {{ item.groupLabel }} - {{ item.itemTypeLabel }}
                </p>
                <h3 class="mt-2 text-base font-semibold text-slate-950">{{ item.title }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.subtitle }}</p>
                <p v-if="item.description" class="mt-2 text-sm leading-6 text-slate-500">
                  {{ item.description }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="buildChangeTypeLabel(item.changeType)" />
                <StatusBadge :label="item.summary" />
              </div>
            </div>
          </button>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-xs font-semibold text-slate-500">Sem diferencas</p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            Edicao atual e versao publicada estao alinhadas.
          </h3>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            A proxima mudanca deste dominio aparecera aqui automaticamente.
          </p>
        </div>
      </SectionPanel>
    </div>

    <div v-if="currentDomain" class="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
      <SectionPanel
        eyebrow="Detalhe"
        title="Campos alterados"
        description="Veja o que mudou em cada campo para apoiar a decisao de aprovar ou publicar."
      >
        <div v-if="selectedDiffItem" class="grid gap-5">
          <div class="flex flex-wrap gap-2">
            <StatusBadge :label="selectedDiffItem.groupLabel" />
            <StatusBadge :label="buildChangeTypeLabel(selectedDiffItem.changeType)" />
          </div>

          <div class="inner-panel p-5">
            <p class="text-xs font-semibold text-slate-500">{{ selectedDiffItem.itemTypeLabel }}</p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">{{ selectedDiffItem.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-slate-600">{{ selectedDiffItem.subtitle }}</p>
            <p v-if="selectedDiffItem.description" class="mt-3 text-sm leading-6 text-slate-500">
              {{ selectedDiffItem.description }}
            </p>
          </div>

          <div v-if="selectedDiffItem.fieldChanges.length" class="grid gap-3">
            <article
              v-for="fieldChange in selectedDiffItem.fieldChanges"
              :key="fieldChange.key"
              class="inner-panel p-5"
            >
              <p class="text-xs font-semibold text-slate-500">{{ fieldChange.label }}</p>
              <div class="mt-4 grid gap-3 md:grid-cols-2">
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-sm font-semibold text-slate-500">Versao publicada</p>
                  <p class="mt-2 text-sm font-semibold text-slate-900">{{ fieldChange.from }}</p>
                </div>
                <div class="rounded-[18px] bg-slate-50 px-4 py-3">
                  <p class="text-sm font-semibold text-slate-500">Edicao atual</p>
                  <p class="mt-2 text-sm font-semibold text-slate-900">{{ fieldChange.to }}</p>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="inner-panel p-5">
            <p class="text-sm font-semibold text-slate-900">Este item e novo ou removido.</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              A comparacao nao mostra campos individuais porque a mudanca ocorreu no item inteiro.
            </p>
          </div>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-xs font-semibold text-slate-500">Nenhuma mudanca selecionada</p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            Selecione um item para ver a comparacao.
          </h3>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Auditoria"
        title="Aprovacoes e publicacoes"
        description="Eventos administrativos separados por aprovacao e publicacao, com dominio, ator, versao anterior, versao nova e resumo."
      >
        <div class="grid gap-3">
          <article
            v-for="event in selectedDomainEvents"
            :key="event.id"
            class="inner-panel p-5"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-xs font-semibold text-slate-500">
                  {{ buildActionTypeLabel(event.actionType) }}
                </p>
                <h3 class="mt-3 text-lg font-semibold text-slate-950">{{ event.summary }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  {{ event.actorName }} - {{ event.actorRole }} - {{ event.changedAtLabel }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="event.previousVersion" />
                <StatusBadge :label="event.nextVersion" />
              </div>
            </div>
          </article>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
