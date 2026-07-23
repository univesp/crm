<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { buildFaqVigentRuleSummary } from '@/services/faqRulesRuntime'
import { resolveFaqMediaUrl } from '@/services/faqMedia'
import { buildStudentFaqHomeEntries, buildStudentFaqRuntime } from '@/services/faqRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const studentSupportStore = useStudentSupportStore()

const selectedNodeId = ref(String(route.query.node || studentSupportStore.currentFaqContext?.finalNode?.id || ''))

const faqRuntime = computed(() => buildStudentFaqRuntime())

const faqNodeIndex = computed(() => {
  const index = new Map()

  function walk(nodes) {
    for (const node of nodes) {
      index.set(node.id, node)
      walk(node.children || [])
    }
  }

  walk(faqRuntime.value.tree)
  return index
})

const rootEntries = computed(() => buildStudentFaqHomeEntries())

const activeNode = computed(() =>
  selectedNodeId.value ? faqNodeIndex.value.get(selectedNodeId.value) || null : null,
)

const activeLineage = computed(() =>
  activeNode.value
    ? activeNode.value.runtime.lineage.map((nodeId) => faqNodeIndex.value.get(nodeId)).filter(Boolean)
    : [],
)

const activeChildren = computed(() => activeNode.value?.children || [])
const activeNodeIsLeaf = computed(() => Boolean(activeNode.value) && activeChildren.value.length === 0)
const activeMedia = computed(() =>
  (Array.isArray(activeNode.value?.media) ? activeNode.value.media : [])
    .map((item) => ({ ...item, resolvedUrl: resolveFaqMediaUrl(item) }))
    .filter((item) => item.resolvedUrl),
)

const stageCopy = computed(() => {
  if (!activeNode.value) {
    return {
      eyebrow: 'Tenho uma duvida',
      title: 'Sobre o que e sua duvida?',
      description: 'Escolha o tema para continuar.',
      mobileLabel: 'Tenho uma duvida',
    }
  }

  if (!activeNodeIsLeaf.value) {
    return {
      eyebrow: activeNode.value.titulo_exibido,
      title:
        activeNode.value.pergunta_exibida ||
        'Qual assunto mais se aproxima da sua duvida?',
      description: 'Voce esta vendo apenas o nivel atual da escolha.',
      mobileLabel: activeNode.value.titulo_exibido,
    }
  }

  return {
    eyebrow: 'Orientacao oficial',
    title: activeNode.value.titulo_exibido,
    description: 'Leia a orientacao oficial e escolha como continuar.',
    mobileLabel: activeNode.value.titulo_exibido,
  }
})

const visibleOptions = computed(() => {
  if (!activeNode.value) {
    return rootEntries.value.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      badgeLabel: entry.badgeLabel,
      highlighted: entry.highlighted,
    }))
  }

  if (activeNodeIsLeaf.value) {
    return []
  }

  return activeChildren.value.map((child) => ({
    id: child.id,
    title: child.titulo_exibido,
    description:
      child.pergunta_exibida ||
      child.descricao_interna ||
      child.resposta ||
      'Continuar atendimento',
    badgeLabel: child.runtime.highlightLabel,
    highlighted: child.runtime.isHighlighted,
  }))
})

const currentHighlights = computed(() => {
  if (!activeNode.value) {
    return rootEntries.value
      .filter((entry) => entry.highlighted)
      .map((entry) => ({
        id: entry.id,
        label: entry.badgeLabel || 'Destaque do momento',
        title: entry.title,
        description: entry.description,
      }))
  }

  if (!activeNodeIsLeaf.value) {
    return activeChildren.value
      .filter((child) => child.runtime.isHighlighted)
      .map((child) => ({
        id: child.id,
        label: child.runtime.highlightLabel || 'Destaque do momento',
        title: child.titulo_exibido,
        description:
          child.pergunta_exibida ||
          child.descricao_interna ||
          'Este assunto aparece em destaque no momento.',
      }))
  }

  if (activeNode.value.runtime.highlightLabel) {
    return [
      {
        id: activeNode.value.id,
        label: activeNode.value.runtime.highlightLabel,
        title: activeNode.value.titulo_exibido,
        description: 'Este assunto esta em destaque e aparece antes das demais opcoes quando aplicavel.',
      },
    ]
  }

  return []
})

const trailItems = computed(() => {
  const baseItems = [
    { id: 'home', label: 'Inicio', action: 'home', current: false },
    { id: 'journey', label: 'Tenho uma duvida', action: 'restart', current: !activeNode.value },
  ]

  if (!activeNode.value) {
    return baseItems
  }

  return [
    ...baseItems,
    ...activeLineage.value.map((step, index) => ({
      id: step.id,
      label: step.titulo_exibido,
      action: 'node',
      nodeId: step.id,
      current: index === activeLineage.value.length - 1,
    })),
  ]
})

const supportNotes = computed(() => {
  if (!activeNode.value) {
    return [
      'Escolha um tema para seguir.',
      'Destaques do momento aparecem antes das opcoes quando estiverem ativos.',
    ]
  }

  if (!activeNodeIsLeaf.value) {
    return [
      'Voce esta vendo apenas o nivel atual da escolha.',
      'Clique em um item do caminho para voltar a uma etapa anterior.',
    ]
  }

  return [
    'Se esta orientacao resolver, o registro aparece em Minhas solicitacoes como Respondida no portal.',
    'Se ainda precisar de ajuda, o resumo desta navegacao segue preenchido para a solicitacao.',
  ]
})

const studentMeaning = computed(() => {
  if (!activeNode.value || !activeNodeIsLeaf.value) {
    return ''
  }

  if (activeNode.value.runtime.highlightLabel) {
    return 'Se este assunto estiver ligado a prazo ou calendario, confira o destaque antes de decidir continuar.'
  }

  if (activeNode.value.abre_atendimento) {
    return 'Se esta orientacao nao resolver, o portal continua o atendimento com o contexto desta navegacao.'
  }

  return 'Esta orientacao fica registrada no portal e voce pode decidir se precisa ou nao seguir para atendimento.'
})

const vigentRuleSummary = computed(() =>
  activeNodeIsLeaf.value ? buildFaqVigentRuleSummary(activeNode.value) : null,
)

function syncFaqContext(node) {
  if (!node) {
    return
  }

  const lineage = node.runtime.lineage.map((stepId) => faqNodeIndex.value.get(stepId)).filter(Boolean)

  studentSupportStore.setFaqContext({
    node,
    lineage,
  })
}

function openNode(nodeId) {
  selectedNodeId.value = nodeId
  router.replace({ path: '/aluno/duvida', query: { node: nodeId } })
  syncFaqContext(faqNodeIndex.value.get(nodeId))
}

function goHome() {
  studentSupportStore.resetFaqExperience()
  selectedNodeId.value = ''
  router.push('/aluno')
}

function restartJourney() {
  selectedNodeId.value = ''
  studentSupportStore.resetFaqExperience()
  router.replace({ path: '/aluno/duvida' })
}

function openTrailItem(item) {
  if (item.current) {
    return
  }

  if (item.action === 'home') {
    goHome()
    return
  }

  if (item.action === 'restart') {
    restartJourney()
    return
  }

  if (item.action === 'node' && item.nodeId) {
    openNode(item.nodeId)
  }
}

function goBack() {
  if (!activeLineage.value.length) {
    goHome()
    return
  }

  if (activeLineage.value.length === 1) {
    restartJourney()
    return
  }

  openNode(activeLineage.value.at(-2).id)
}

function markAsResolved() {
  if (!activeNode.value) {
    return
  }

  studentSupportStore.resolveFaq({
    node: activeNode.value,
    lineage: activeLineage.value,
  })
  router.push('/aluno/confirmacao/faq-resolvida')
}

function continueToProtocol() {
  if (!activeNode.value) {
    return
  }

  studentSupportStore.startProtocolFromFaq({
    node: activeNode.value,
    lineage: activeLineage.value,
  })
  router.push('/aluno/protocolo')
}

watch(
  () => route.query.node,
  (nodeId) => {
    const normalized = String(nodeId || '')

    if (!normalized) {
      selectedNodeId.value = ''
      return
    }

    if (faqNodeIndex.value.has(normalized)) {
      selectedNodeId.value = normalized
      syncFaqContext(faqNodeIndex.value.get(normalized))
    }
  },
  { immediate: true },
)
</script>

<template>
  <StudentStageLayout
    :eyebrow="stageCopy.eyebrow"
    :title="stageCopy.title"
    :description="stageCopy.description"
    :mobile-label="stageCopy.mobileLabel"
    :show-back="true"
    aside-title="Seu caminho"
    aside-description="No desktop, esta coluna ajuda a voltar para etapas anteriores sem competir com o conteudo principal."
    @back="goBack"
  >
    <div class="grid gap-4">
      <div
        v-if="currentHighlights.length"
        class="grid gap-3"
      >
        <article
          v-for="highlight in currentHighlights"
          :key="highlight.id"
          class="rounded-[24px] border border-[rgba(109,76,255,0.18)] bg-[rgba(109,76,255,0.08)] p-5"
        >
          <p class="student-section-label text-[var(--color-primary-dark)]">
            {{ highlight.label }}
          </p>
          <h3 class="mt-3 text-[1.45rem] font-semibold leading-tight text-slate-950">
            {{ highlight.title }}
          </h3>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            {{ highlight.description }}
          </p>
        </article>
      </div>

      <div
        v-if="!activeNode"
        class="grid max-w-2xl gap-3 sm:grid-cols-2"
      >
        <button
          v-for="option in visibleOptions"
          :key="option.id"
          type="button"
          :class="[
            'student-focus-ring flex min-h-[168px] flex-col justify-between rounded-[22px] border bg-white px-5 py-5 text-left hover:-translate-y-1 hover:bg-slate-50',
            option.highlighted
              ? 'border-[rgba(109,76,255,0.22)] bg-[rgba(109,76,255,0.06)]'
              : 'border-slate-200',
          ]"
          @click="openNode(option.id)"
        >
          <div>
            <p class="text-lg font-semibold text-slate-950">{{ option.title }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              {{ option.description }}
            </p>
          </div>
          <span aria-hidden="true" class="self-end text-lg font-semibold text-slate-400">&gt;</span>
        </button>
      </div>

      <div
        v-else-if="!activeNodeIsLeaf"
        class="grid max-w-2xl gap-3"
      >
        <button
          v-for="option in visibleOptions"
          :key="option.id"
          type="button"
          :class="[
            'student-focus-ring flex w-full items-start justify-between gap-4 rounded-[22px] border bg-white px-5 py-5 text-left hover:-translate-y-1 hover:bg-slate-50',
            option.highlighted
              ? 'border-[rgba(109,76,255,0.22)] bg-[rgba(109,76,255,0.06)]'
              : 'border-slate-200',
          ]"
          @click="openNode(option.id)"
        >
          <div>
            <p class="text-lg font-semibold text-slate-950">{{ option.title }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              {{ option.description }}
            </p>
          </div>
          <span aria-hidden="true" class="mt-1 text-lg font-semibold text-slate-400">&gt;</span>
        </button>
      </div>

      <div
        v-else
        class="max-w-2xl rounded-[26px] border border-[rgba(109,76,255,0.16)] bg-[linear-gradient(180deg,rgba(248,244,255,0.96),rgba(255,255,255,0.98))] p-5 md:p-6"
      >
        <div class="grid gap-4">
          <section class="rounded-[22px] border border-slate-200 bg-white/92 p-5">
            <p class="student-section-label text-[var(--color-primary-dark)]">
              Orientacao oficial
            </p>
            <h3 class="mt-3 text-[1.7rem] font-semibold leading-tight text-slate-950">
              {{ activeNode.titulo_exibido }}
            </h3>
            <p class="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">
              {{ activeNode.resposta }}
            </p>

            <div v-if="activeMedia.length" class="mt-5 grid gap-4">
              <figure
                v-for="(media, index) in activeMedia"
                :key="media.asset_id || media.resolvedUrl || `faq-media-${index}`"
                class="overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50"
              >
                <img
                  v-if="media.type === 'image'"
                  :src="media.resolvedUrl"
                  :alt="media.alt"
                  loading="lazy"
                  decoding="async"
                  class="h-auto max-h-[520px] w-full object-contain"
                />
                <video
                  v-else-if="media.type === 'video'"
                  :src="media.resolvedUrl"
                  :poster="media.thumbnail_url || undefined"
                  controls
                  playsinline
                  preload="metadata"
                  class="max-h-[520px] w-full bg-slate-950"
                ></video>
                <figcaption
                  v-if="media.caption"
                  class="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600"
                >
                  {{ media.caption }}
                </figcaption>
                <details
                  v-if="media.type === 'video' && media.transcript"
                  class="border-t border-slate-200 px-4 py-3 text-xs text-slate-600"
                >
                  <summary class="cursor-pointer font-semibold text-slate-700">
                    Ler transcricao do video
                  </summary>
                  <p class="mt-2 whitespace-pre-line leading-5">{{ media.transcript }}</p>
                </details>
              </figure>
            </div>
          </section>

          <section class="rounded-[22px] border border-slate-200 bg-white/92 p-5">
            <p class="student-section-label">O que isso significa para mim</p>
            <p class="mt-3 text-sm leading-7 text-slate-700">
              {{ studentMeaning }}
            </p>
          </section>

          <section
            v-if="vigentRuleSummary"
            class="rounded-[22px] border border-[rgba(0,95,153,0.18)] bg-[rgba(232,242,251,0.72)] p-5"
          >
            <p class="student-section-label text-[var(--color-info)]">
              {{ vigentRuleSummary.title }}
            </p>
            <p class="mt-3 text-sm leading-7 text-slate-700">
              {{ vigentRuleSummary.message }}
            </p>
            <div v-if="vigentRuleSummary.slaLabel || vigentRuleSummary.criticalityLabel" class="mt-4 flex flex-wrap gap-2">
              <SlaBadge v-if="vigentRuleSummary.slaLabel" :label="vigentRuleSummary.slaLabel" />
              <StatusBadge
                v-if="vigentRuleSummary.criticalityLabel"
                :label="`Criticidade ${vigentRuleSummary.criticalityLabel}`"
              />
            </div>
            <ul v-if="vigentRuleSummary.references.length" class="mt-4 grid gap-2 text-sm text-slate-700">
              <li
                v-for="reference in vigentRuleSummary.references"
                :key="reference.id"
                class="rounded-[16px] border border-slate-200 bg-white/90 px-4 py-3"
              >
                <p class="font-semibold text-slate-900">
                  {{ reference.targetLabel }}
                </p>
                <p v-if="reference.note" class="mt-1 text-xs text-slate-600">{{ reference.note }}</p>
              </li>
            </ul>
          </section>

          <section class="rounded-[22px] border border-slate-200 bg-white/92 p-5">
            <p class="student-section-label">Decisao final</p>
            <p class="mt-3 text-sm font-semibold text-slate-900">
              Essa resposta resolveu sua duvida?
            </p>

            <div class="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <button
                type="button"
                class="student-focus-ring min-w-0 rounded-[20px] bg-[var(--color-primary)] px-5 py-4 text-center text-sm font-semibold leading-5 text-white shadow-[0_18px_40px_rgba(109,76,255,0.16)] hover:-translate-y-1"
                @click="markAsResolved"
              >
                Sim, resolveu minha duvida
              </button>
              <button
                type="button"
                class="student-focus-ring min-w-0 rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold leading-5 text-slate-700 hover:-translate-y-1 hover:bg-slate-50"
                @click="continueToProtocol"
              >
                Nao, continuar atendimento
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <template #aside>
      <div class="grid gap-4">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="item in trailItems"
            :key="item.id"
            type="button"
            :class="[
              'student-focus-ring rounded-full border px-3 py-2 text-xs font-semibold transition',
              item.current
                ? 'border-[rgba(109,76,255,0.18)] bg-[rgba(109,76,255,0.08)] text-slate-950'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ]"
            :aria-current="item.current ? 'step' : null"
            @click="openTrailItem(item)"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="grid gap-3">
          <div
            v-for="note in supportNotes"
            :key="note"
            class="rounded-[18px] border border-slate-200 bg-slate-50/85 p-4 text-sm leading-6 text-slate-600"
          >
            {{ note }}
          </div>
        </div>
      </div>
    </template>
  </StudentStageLayout>
</template>
