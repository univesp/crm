<script setup>
import { computed, ref, toRef, watch } from 'vue'

import { useDialogA11y } from '@/composables/useDialogA11y'

import {
  channelsFromPayload,
  childEdgesOf,
  resolveNodeContent,
} from '@/services/faqV3PayloadAdapter'

const props = defineProps({
  payload: { type: Object, required: true },
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const simulationChannel = ref('student')
const simulationCurrentNodeId = ref('')
const simulationPath = ref([])
const simulationStarted = ref(false)

const channelOptions = computed(() => {
  const flags = channelsFromPayload(props.payload)
  const options = []
  if (flags.availableStudent) options.push({ value: 'student', label: 'Aluno' })
  if (flags.availablePublic) options.push({ value: 'public', label: 'Público externo' })
  return options
})

const canSwitchChannel = computed(() => channelOptions.value.length > 1)

const rootId = computed(() => {
  const graph = props.payload?.graph || {}
  if (simulationChannel.value === 'public') {
    return String(graph.public_root_node_id || graph.student_root_node_id || '').trim()
  }
  return String(graph.student_root_node_id || graph.public_root_node_id || '').trim()
})

const currentNode = computed(
  () =>
    (props.payload?.nodes || []).find((node) => node.node_id === simulationCurrentNodeId.value) ||
    null,
)

const currentContent = computed(() =>
  currentNode.value ? resolveNodeContent(currentNode.value, simulationChannel.value) : null,
)

const contentBlocks = computed(() =>
  (currentContent.value?.blocks || []).filter((block) => {
    if (['text', 'notice'].includes(block?.type)) return Boolean(block.body?.trim())
    return Boolean(block?.url?.trim() || block?.body?.trim())
  }),
)

const childChoices = computed(() => {
  if (!currentNode.value || currentNode.value.node_kind === 'final') return []
  return childEdgesOf(props.payload, currentNode.value.node_id)
    .map((edge) => {
      const child = (props.payload.nodes || []).find((node) => node.node_id === edge.child_node_id)
      if (!child) return null
      if (!(child.audiences || []).includes(simulationChannel.value)) return null
      return {
        edgeId: edge.edge_id,
        nodeId: child.node_id,
        title: child.display?.title || 'Próxima etapa',
        label: edge.label || child.display?.title || 'Continuar',
      }
    })
    .filter(Boolean)
})

const pathNodes = computed(() =>
  simulationPath.value
    .map((nodeId) => (props.payload.nodes || []).find((node) => node.node_id === nodeId))
    .filter(Boolean),
)

const outcomeLabel = computed(() => {
  if (currentNode.value?.node_kind !== 'final') return ''
  const key = String(currentContent.value?.outcome_key || '').toLowerCase()
  if (!key) return 'Resposta final'
  if (key.includes('ticket') || key.includes('atendimento') || key.includes('open')) {
    return 'Abre atendimento'
  }
  if (key.includes('resol') || key.includes('ok')) return 'Resolve a dúvida'
  return `Desfecho: ${currentContent.value.outcome_key}`
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) restart()
  },
)

watch(simulationChannel, () => {
  if (props.open) restart()
})

function restart() {
  const start = rootId.value
  simulationCurrentNodeId.value = start
  simulationPath.value = start ? [start] : []
  simulationStarted.value = Boolean(start)
  if (!channelOptions.value.find((item) => item.value === simulationChannel.value)) {
    simulationChannel.value = channelOptions.value[0]?.value || 'student'
  }
}

function advance(nodeId) {
  simulationCurrentNodeId.value = nodeId
  simulationPath.value = [...simulationPath.value, nodeId]
}

function goBack() {
  if (simulationPath.value.length <= 1) return
  const nextPath = simulationPath.value.slice(0, -1)
  simulationPath.value = nextPath
  simulationCurrentNodeId.value = nextPath[nextPath.length - 1]
}

function close() {
  emit('close')
}

const panelRef = ref(null)

useDialogA11y(toRef(props, 'open'), panelRef, close)
</script>

<template>
  <div
    v-if="open"
    class="faq-v3-simulator"
    role="dialog"
    aria-modal="true"
    aria-labelledby="faq-v3-simulator-title"
  >
    <div class="faq-v3-simulator__backdrop" @click="close" />
    <section ref="panelRef" class="faq-v3-simulator__panel crm-panel" tabindex="-1">
      <header class="faq-v3-simulator__header">
        <div>
          <h2 id="faq-v3-simulator-title">Simular jornada</h2>
          <p>Percorra o fluxo como a pessoa verá no portal.</p>
        </div>
        <button type="button" class="crm-button-secondary" @click="close">Fechar</button>
      </header>

      <div v-if="canSwitchChannel" class="faq-v3-simulator__channel">
        <label class="crm-field-label">
          Canal
          <select v-model="simulationChannel" class="crm-field">
            <option v-for="option in channelOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <nav class="faq-v3-simulator__path" aria-label="Caminho percorrido">
        <ol>
          <li v-for="(node, index) in pathNodes" :key="`${node.node_id}-${index}`">
            {{ node.display?.title || 'Etapa' }}
          </li>
        </ol>
      </nav>

      <article v-if="currentNode" class="faq-v3-simulator__step crm-card-muted">
        <p class="crm-chip">
          {{ currentNode.node_kind === 'final' ? 'Resposta final' : 'Etapa' }}
        </p>
        <h3>{{ currentNode.display?.title || 'Sem título' }}</h3>
        <div v-if="contentBlocks.length" class="faq-v3-simulator__blocks">
          <template v-for="block in contentBlocks" :key="block.block_id">
            <p v-if="['text', 'notice'].includes(block.type)">{{ block.body }}</p>
            <p v-else-if="block.type === 'link'">
              <a :href="block.url" target="_blank" rel="noopener noreferrer">
                {{ block.body || block.url }}
              </a>
            </p>
            <p v-else>{{ block.body || block.url }}</p>
          </template>
        </div>
        <p v-else class="faq-v3-simulator__empty">Nenhuma orientação preenchida nesta etapa.</p>

        <p v-if="currentNode.node_kind === 'final'" class="faq-v3-simulator__outcome">
          <strong>{{ outcomeLabel }}</strong>
        </p>

        <div v-if="childChoices.length" class="faq-v3-simulator__choices" role="group" aria-label="Alternativas">
          <button
            v-for="choice in childChoices"
            :key="choice.edgeId"
            type="button"
            class="crm-button-secondary"
            @click="advance(choice.nodeId)"
          >
            {{ choice.label }}
          </button>
        </div>
      </article>

      <footer class="faq-v3-simulator__footer">
        <button
          type="button"
          class="crm-button-secondary"
          :disabled="simulationPath.length <= 1"
          @click="goBack"
        >
          Voltar
        </button>
        <button type="button" class="crm-button-secondary" @click="restart">Reiniciar</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.faq-v3-simulator {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
}

.faq-v3-simulator__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-text) 45%, transparent);
}

.faq-v3-simulator__panel {
  position: relative;
  z-index: 1;
  width: min(48rem, 100%);
  max-height: min(90vh, 52rem);
  overflow: auto;
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
}

.faq-v3-simulator__header,
.faq-v3-simulator__footer,
.faq-v3-simulator__choices {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.faq-v3-simulator__header h2,
.faq-v3-simulator__step h3 {
  margin: 0;
}

.faq-v3-simulator__path ol {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.faq-v3-simulator__path li {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted, var(--color-surface));
  font-size: var(--font-size-sm);
}

.faq-v3-simulator__step {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.faq-v3-simulator__empty,
.faq-v3-simulator__outcome {
  margin: 0;
  color: var(--color-text-muted);
}

.faq-v3-simulator__choices {
  justify-content: flex-start;
}
</style>
