<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import StudentStageLayout from '@/components/student/StudentStageLayout.vue'
import { buildStudentFaqHomeEntries, buildStudentFaqRuntime } from '@/services/faqRuntime'
import {
  clearActiveFaqSession,
  ensureFaqSessionForNode,
  recordFaqJourneyEvent,
} from '@/services/faqSessionRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const studentSupportStore = useStudentSupportStore()

const selectedNodeId = ref(String(route.query.node || studentSupportStore.currentFaqContext?.finalNode?.id || ''))
const sessionError = ref('')
const sessionPending = ref(false)

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

const stageCopy = computed(() => {
  if (!activeNode.value) {
    return {
      eyebrow: 'Tenho uma dúvida',
      title: 'Sobre o que e sua dúvida?',
      description: 'Escolha o tema para continuar.',
      mobileLabel: 'Tenho uma dúvida',
    }
  }

  if (!activeNodeIsLeaf.value) {
    return {
      eyebrow: activeNode.value.titulo_exibido,
      title:
        activeNode.value.pergunta_exibida ||
        'Qual assunto mais se aaproxima da sua dúvida?',
      description: 'Você esta vendo apenas o nivel atual da escolha.',
      mobileLabel: activeNode.value.titulo_exibido,
    }
  }

  return {
    eyebrow: 'Orientação oficial',
    title: activeNode.value.titulo_exibido,
    description: 'Leia a orientação oficial e escolha como continuar.',
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
    { id: 'home', label: 'Início', action: 'home', current: false },
    { id: 'journey', label: 'Tenho uma dúvida', action: 'restart', current: !activeNode.value },
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
      'Você esta vendo apenas o nivel atual da escolha.',
      'Clique em um item do caminho para voltar a uma etapa anterior.',
    ]
  }

  return [
    'Se esta orientação resolver, o registro aparece em Minhas solicitações como Respondida no portal.',
    'Se ainda precisar de ajuda, o resumo desta navegação segue preenchido para a solicitação.',
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
    return 'Se esta orientação não resolver, o portal continua o atendimento com o contexto desta navegação.'
  }

  return 'Esta orientação fica registrada no portal e você pode decidir se precisa ou não seguir para atendimento.'
})

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

async function syncStickyContext(node, { recordView = true } = {}) {
  if (!node) return null
  sessionPending.value = true
  sessionError.value = ''
  const lineage = node.runtime.lineage.map((stepId) => faqNodeIndex.value.get(stepId)).filter(Boolean)
  try {
    const session = await ensureFaqSessionForNode(node, lineage, 'student')
    if (session?.faq_session_id) {
      studentSupportStore.activeFaqSessionId = session.faq_session_id
    }
    syncFaqContext(node)
    if (recordView) {
      await recordFaqJourneyEvent('faq.node_viewed', node)
    }
    return session
  } catch (error) {
    sessionError.value =
      error?.message || 'Não foi possível fixar esta versão da FAQ. Tente reiniciar a jornada.'
    return null
  } finally {
    sessionPending.value = false
  }
}

async function openNode(nodeId) {
  selectedNodeId.value = nodeId
  await syncStickyContext(faqNodeIndex.value.get(nodeId))
  router.replace({ path: '/aluno/duvida', query: { node: nodeId } })
}

function goHome() {
  clearActiveFaqSession()
  studentSupportStore.resetFaqExperience()
  selectedNodeId.value = ''
  router.push('/aluno')
}

function restartJourney() {
  clearActiveFaqSession()
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

async function markAsResolved() {
  if (!activeNode.value) {
    return
  }

  const session = await syncStickyContext(activeNode.value, { recordView: false })
  if (activeNode.value.runtime_schema_version?.startsWith('3.0.0') && !session) return
  await recordFaqJourneyEvent('faq.resolved_without_ticket', activeNode.value, {
    outcome_key: 'resolved',
  })
  studentSupportStore.resolveFaq({
    node: activeNode.value,
    lineage: activeLineage.value,
  })
  router.push('/aluno/confirmacao/faq-resolvida')
}

async function continueToProtocol() {
  if (!activeNode.value) {
    return
  }

  const session = await syncStickyContext(activeNode.value, { recordView: false })
  if (activeNode.value.runtime_schema_version?.startsWith('3.0.0') && !session) return
  await recordFaqJourneyEvent('faq.ticket_open_started', activeNode.value, {
    outcome_key: 'open_ticket',
  })
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
      if (
        selectedNodeId.value === normalized &&
        studentSupportStore.currentFaqContext?.finalNode?.id === normalized
      ) {
        return
      }
      selectedNodeId.value = normalized
      syncStickyContext(faqNodeIndex.value.get(normalized))
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
    @back="goBack"
  >
    <div class="grid gap-4">
      <div
        v-if="sessionError"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {{ sessionError }}
      </div>
      <div
        v-if="currentHighlights.length"
        class="grid gap-3"
      >
        <article
          v-for="highlight in currentHighlights"
          :key="highlight.id"
          class="rounded-[8px] border border-[rgba(209,50,57,0.18)] bg-[rgba(209,50,57,0.08)] p-5"
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
            'student-focus-ring flex min-h-[168px] flex-col justify-between rounded-[8px] border bg-white px-5 py-5 text-left hover:bg-slate-50',
            option.highlighted
              ? 'border-[rgba(209,50,57,0.22)] bg-[rgba(209,50,57,0.06)]'
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
            'student-focus-ring flex w-full items-start justify-between gap-4 rounded-[8px] border bg-white px-5 py-5 text-left hover:bg-slate-50',
            option.highlighted
              ? 'border-[rgba(209,50,57,0.22)] bg-[rgba(209,50,57,0.06)]'
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
        class="max-w-2xl rounded-[8px] border border-[rgba(209,50,57,0.16)] bg-white p-5 md:p-6"
      >
        <div class="grid gap-4">
          <section class="rounded-[8px] border border-slate-200 bg-white/92 p-5">
            <p class="student-section-label text-[var(--color-primary-dark)]">
              Orientação oficial
            </p>
            <h3 class="mt-3 text-[1.7rem] font-semibold leading-tight text-slate-950">
              {{ activeNode.titulo_exibido }}
            </h3>
            <p class="mt-4 text-sm leading-7 text-slate-700">
              {{ activeNode.resposta }}
            </p>
          </section>

          <section class="rounded-[8px] border border-slate-200 bg-white/92 p-5">
            <p class="student-section-label">O que isso significa para mim</p>
            <p class="mt-3 text-sm leading-7 text-slate-700">
              {{ studentMeaning }}
            </p>
          </section>

          <section class="rounded-[8px] border border-slate-200 bg-white/92 p-5">
            <p class="student-section-label">Decisao final</p>
            <p class="mt-3 text-sm font-semibold text-slate-900">
              Essa resposta resolveu sua dúvida?
            </p>

            <div class="crm-split-grid mt-4 gap-3">
              <button
                type="button"
                class="student-focus-ring min-w-0 rounded-[8px] bg-[var(--color-primary)] px-5 py-4 text-center text-sm font-semibold leading-5 text-white shadow-sm hover:bg-slate-50"
                @click="markAsResolved"
              >
                Sim, resolveu minha dúvida
              </button>
              <button
                type="button"
                class="student-focus-ring min-w-0 rounded-[8px] border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold leading-5 text-slate-700 hover:bg-slate-50"
                @click="continueToProtocol"
              >
                Não, continuar atendimento
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
                ? 'border-[rgba(209,50,57,0.18)] bg-[rgba(209,50,57,0.08)] text-slate-950'
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
            class="rounded-[8px] border border-slate-200 bg-slate-50/85 p-4 text-sm leading-6 text-slate-600"
          >
            {{ note }}
          </div>
        </div>
      </div>
    </template>
  </StudentStageLayout>
</template>
