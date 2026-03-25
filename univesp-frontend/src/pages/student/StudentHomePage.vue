<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ActionTile from '@/components/ActionTile.vue'
import FaqTopicCard from '@/components/FaqTopicCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import { buildStudentFaqHomeEntries, buildStudentFaqRuntime } from '@/services/faqRuntime'
import { useStudentSupportStore } from '@/stores/studentSupport'
import { studentNotifications, studentProtocols, studentQuickActions } from '../../../mocks/operations'

const router = useRouter()
const studentSupportStore = useStudentSupportStore()

const calendarPresets = [
  {
    id: 'matricula',
    label: 'Matricula',
    date: '2026-03-24',
    supportLabel: 'Calendario mock 24/03/2026',
  },
  {
    id: 'atividades',
    label: 'Atividades',
    date: '2026-04-10',
    supportLabel: 'Calendario mock 10/04/2026',
  },
  {
    id: 'provas',
    label: 'Provas',
    date: '2026-04-24',
    supportLabel: 'Calendario mock 24/04/2026',
  },
]

const selectedCalendarPresetId = ref(calendarPresets[0].id)
const selectedNodeId = ref('')

const activeCalendarPreset = computed(
  () => calendarPresets.find((preset) => preset.id === selectedCalendarPresetId.value) || calendarPresets[0],
)

const faqRuntime = computed(() =>
  buildStudentFaqRuntime({
    currentDate: activeCalendarPreset.value.date,
  }),
)

const studentFaqHomeEntries = computed(() =>
  buildStudentFaqHomeEntries({
    currentDate: activeCalendarPreset.value.date,
  }),
)

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

const activeNode = computed(() =>
  selectedNodeId.value ? faqNodeIndex.value.get(selectedNodeId.value) || null : null,
)

const activeLineage = computed(() =>
  activeNode.value
    ? activeNode.value.runtime.lineage.map((nodeId) => faqNodeIndex.value.get(nodeId)).filter(Boolean)
    : [],
)

const activeRootId = computed(() => activeLineage.value[0]?.id || '')
const activeChildren = computed(() => activeNode.value?.children || [])
const activeNodeIsLeaf = computed(
  () => Boolean(activeNode.value) && activeChildren.value.length === 0,
)
const resolvedState = computed(() => studentSupportStore.resolvedState)

const seasonalThemes = computed(() =>
  studentFaqHomeEntries.value.filter((entry) => entry.highlighted),
)

const activeNodeSummary = computed(() => {
  if (!activeNode.value) {
    return ''
  }

  return activeNode.value.pergunta_exibida || activeNode.value.descricao_interna || ''
})

const leafOutcomeMessage = computed(() => {
  if (!activeNode.value) {
    return ''
  }

  if (activeNode.value.abre_atendimento) {
    return 'Este no final prepara a proxima etapa de abertura do protocolo, ainda em modo mock.'
  }

  return 'Mesmo quando a FAQ resolve o caso, o registro interno do atendimento continua previsto.'
})

const leafMetadata = computed(() => {
  if (!activeNode.value) {
    return []
  }

  return [
    {
      id: 'action',
      label: activeNode.value.runtime.actionLabel || activeNode.value.acao,
      tone: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
    },
    {
      id: 'queue',
      label: activeNode.value.runtime.queueLabel || activeNode.value.fila_destino,
      tone: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'sla',
      label: activeNode.value.runtime.slaLabel || activeNode.value.sla_padrao,
      tone: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    },
  ]
})

function selectCalendarPreset(presetId) {
  selectedCalendarPresetId.value = presetId

  if (selectedNodeId.value) {
    selectNode(selectedNodeId.value)
  }
}

function selectNode(nodeId) {
  selectedNodeId.value = nodeId
  const node = faqNodeIndex.value.get(nodeId)

  if (!node) {
    return
  }

  const lineage = node.runtime.lineage.map((stepId) => faqNodeIndex.value.get(stepId)).filter(Boolean)

  studentSupportStore.setFaqContext({
    node,
    lineage,
  })
}

function openTheme(themeId) {
  selectNode(themeId)
}

function openNode(nodeId) {
  selectNode(nodeId)
}

function resetFaqFlow() {
  selectedNodeId.value = ''
  studentSupportStore.resetFaqExperience()
}

function goBackOneLevel() {
  if (activeLineage.value.length <= 1) {
    resetFaqFlow()
    return
  }

  selectedNodeId.value = activeLineage.value.at(-2).id
}

function jumpToNode(nodeId) {
  selectNode(nodeId)
}

function childPreviewTopics(node) {
  return (node.children || []).map((child) => child.titulo_exibido)
}

function markFaqAsResolved() {
  if (!activeNode.value) {
    return
  }

  studentSupportStore.resolveFaq({
    node: activeNode.value,
    lineage: activeLineage.value,
  })
}

function startProtocol() {
  if (!activeNode.value) {
    return
  }

  studentSupportStore.startProtocolFromFaq({
    node: activeNode.value,
    lineage: activeLineage.value,
  })
  router.push('/aluno/protocolo')
}
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Aluno"
      title="Home do atendimento"
      description="Entrada principal do aluno no sistema: FAQ em arvore, registro sempre e protocolo quando o fluxo precisar continuar."
    >
      <template #action>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <span class="soft-chip">Calendario mock</span>
          <button
            v-for="preset in calendarPresets"
            :key="preset.id"
            type="button"
            :class="[
              'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
              preset.id === selectedCalendarPresetId
                ? 'bg-[var(--color-primary)] text-white shadow-[0_12px_28px_rgba(209,50,57,0.18)]'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            ]"
            @click="selectCalendarPreset(preset.id)"
          >
            {{ preset.label }}
          </button>
        </div>
      </template>

      <div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div
          class="rounded-[30px] bg-[linear-gradient(135deg,#3b0d11_0%,#7e1e24_45%,#d13239_100%)] p-7 text-white"
        >
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
            Fluxo guiado
          </p>
          <h3 class="mt-4 text-3xl font-semibold">
            FAQ primeiro, registro sempre, protocolo quando houver continuidade.
          </h3>
          <p class="mt-4 max-w-2xl text-sm leading-7 text-white/80">
            O aluno entra na area de atendimento, escolhe o tema principal e avanca pela arvore
            ate chegar a uma resposta final ou a um fluxo que prepara a abertura do protocolo.
          </p>
          <div class="mt-6 flex flex-wrap gap-2">
            <span class="rounded-full bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
              {{ activeCalendarPreset.supportLabel }}
            </span>
            <span class="rounded-full bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
              {{ seasonalThemes.length }} destaque(s) ativo(s)
            </span>
          </div>
        </div>

        <div class="grid gap-3">
          <ActionTile
            v-for="action in studentQuickActions"
            :key="action"
            eyebrow="Acao rapida"
            :title="action"
          />
        </div>
      </div>
    </SectionPanel>

    <div class="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <SectionPanel
        eyebrow="FAQ"
        title="Temas principais do atendimento"
        description="A home do aluno agora usa o runtime canonico da FAQ para mostrar temas, destaques sazonais e filhos reais do mock."
      >
        <div v-if="seasonalThemes.length" class="mb-4 flex flex-wrap gap-2">
          <span
            v-for="theme in seasonalThemes"
            :key="theme.id"
            class="rounded-full bg-[var(--color-primary-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-dark)]"
          >
            {{ theme.badgeLabel }}
          </span>
        </div>

        <div class="grid gap-3">
          <FaqTopicCard
            v-for="entry in studentFaqHomeEntries"
            :key="entry.id"
            eyebrow="Tema principal"
            :title="entry.title"
            :description="entry.description"
            :badge-label="entry.badgeLabel"
            :highlighted="entry.highlighted"
            :active="entry.id === activeRootId"
            :topics="entry.topics"
            @select="openTheme(entry.id)"
          />
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Navegacao"
        title="Fluxo guiado da arvore"
        description="Selecione um tema e avance pelos filhos ate chegar a resposta final do mock."
      >
        <template #action>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="activeNode"
              type="button"
              class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
              @click="goBackOneLevel"
            >
              Voltar um nivel
            </button>
            <button
              type="button"
              class="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
              @click="resetFaqFlow"
            >
              Reiniciar FAQ
            </button>
          </div>
        </template>

        <div v-if="!activeNode" class="inner-panel p-6">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Entrada do aluno
          </p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            Escolha um tema principal para iniciar o atendimento.
          </h3>
          <p class="mt-3 text-sm leading-7 text-slate-600">
            O fluxo permanece simples: o aluno entra na area de atendimento, seleciona o assunto e
            segue pelos proximos passos ate chegar a uma resposta final ou a preparacao do protocolo.
          </p>
          <div class="mt-5 flex flex-wrap gap-2">
            <span
              v-for="theme in seasonalThemes"
              :key="theme.id"
              class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {{ theme.title }}
            </span>
          </div>
        </div>

        <div v-else class="grid gap-4">
          <nav
            aria-label="Caminho da FAQ"
            class="flex flex-wrap items-center gap-2 rounded-[24px] border border-slate-200 bg-slate-50/80 p-3"
          >
            <button
              type="button"
              class="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
              @click="resetFaqFlow"
            >
              Home
            </button>
            <button
              v-for="step in activeLineage"
              :key="step.id"
              type="button"
              :aria-current="step.id === activeNode.id ? 'step' : undefined"
              :class="[
                'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
                step.id === activeNode.id
                  ? 'bg-[var(--color-primary)] text-white shadow-[0_12px_28px_rgba(209,50,57,0.18)]'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              ]"
              @click="jumpToNode(step.id)"
            >
              {{ step.titulo_exibido }}
            </button>
          </nav>

          <div class="inner-panel p-6">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {{ activeNodeIsLeaf ? 'Resposta final' : 'Proximo passo' }}
            </p>
            <h3 class="mt-3 text-2xl font-semibold text-slate-950">
              {{ activeNode.titulo_exibido }}
            </h3>
            <p class="mt-3 text-sm leading-7 text-slate-600">{{ activeNodeSummary }}</p>

            <div class="mt-5 flex flex-wrap gap-2">
              <span
                v-if="activeNode.runtime.highlightLabel"
                class="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-dark)]"
              >
                {{ activeNode.runtime.highlightLabel }}
              </span>
              <span
                class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700"
              >
                {{ activeNode.runtime.actionLabel || activeNode.acao }}
              </span>
            </div>
          </div>

          <div v-if="!activeNodeIsLeaf" class="grid gap-3">
            <FaqTopicCard
              v-for="child in activeChildren"
              :key="child.id"
              eyebrow="Proximo passo"
              :title="child.titulo_exibido"
              :description="child.pergunta_exibida || child.descricao_interna"
              :badge-label="child.runtime.highlightLabel || ''"
              :highlighted="child.runtime.isHighlighted"
              :topics="childPreviewTopics(child)"
              @select="openNode(child.id)"
            />
          </div>

          <div
            v-else
            class="rounded-[28px] border border-[rgba(209,50,57,0.16)] bg-[linear-gradient(180deg,rgba(252,233,235,0.55),rgba(255,255,255,0.98))] p-6 shadow-[0_18px_40px_rgba(209,50,57,0.08)]"
          >
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-primary-dark)]">
              Resposta oficial
            </p>
            <h3 class="mt-3 text-2xl font-semibold text-slate-950">
              {{ activeNode.titulo_exibido }}
            </h3>
            <p class="mt-4 text-sm leading-7 text-slate-700">{{ activeNode.resposta }}</p>

            <div class="mt-5 flex flex-wrap gap-2">
              <span
                v-for="item in leafMetadata"
                :key="item.id"
                :class="[
                  'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                  item.tone,
                ]"
              >
                {{ item.label }}
              </span>
            </div>

            <p class="mt-5 text-sm leading-7 text-slate-600">
              {{ leafOutcomeMessage }}
            </p>

            <div class="mt-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                class="rounded-[22px] bg-[var(--color-primary)] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(209,50,57,0.18)] transition hover:-translate-y-1"
                @click="markFaqAsResolved"
              >
                Isso resolveu minha duvida
              </button>
              <button
                type="button"
                class="rounded-[22px] border border-[rgba(209,50,57,0.2)] bg-white px-5 py-4 text-sm font-semibold text-[var(--color-primary-dark)] transition hover:-translate-y-1 hover:bg-[var(--color-primary-soft)]"
                @click="startProtocol"
              >
                Ainda preciso de atendimento
              </button>
            </div>

            <div
              v-if="resolvedState"
              class="mt-6 rounded-[22px] border border-[rgba(26,111,67,0.18)] bg-[var(--color-success-soft)] p-5"
            >
              <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-success)]">
                Atendimento encerrado
              </p>
              <h4 class="mt-3 text-xl font-semibold text-slate-950">{{ resolvedState.title }}</h4>
              <p class="mt-3 text-sm leading-7 text-slate-700">{{ resolvedState.message }}</p>
              <p class="mt-3 text-sm leading-7 text-slate-600">{{ resolvedState.helper }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {{ resolvedState.recordId }}
                </span>
                <button
                  type="button"
                  class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-success)] ring-1 ring-[rgba(26,111,67,0.14)] transition hover:bg-[var(--color-success-soft)]"
                  @click="resetFaqFlow"
                >
                  Voltar aos temas
                </button>
              </div>
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <SectionPanel
        eyebrow="Notificacoes"
        title="Pendencias e retornos"
        description="O portal concentra a resposta oficial; o e-mail entra apenas como notificacao."
      >
        <div class="grid gap-3">
          <ActionTile
            v-for="notification in studentNotifications"
            :key="notification.id"
            :title="notification.title"
            :description="notification.message"
            :eyebrow="notification.type"
          />
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Protocolos"
        title="Solicitacoes recentes"
        description="Resumo da area que depois alimenta 'Minhas solicitacoes'."
      >
        <div class="grid gap-3">
          <ActionTile
            v-for="protocol in studentProtocols.slice(0, 2)"
            :key="protocol.id"
            :title="protocol.subject"
            :description="`${protocol.id} - ${protocol.status}`"
            eyebrow="Registro"
          />
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
