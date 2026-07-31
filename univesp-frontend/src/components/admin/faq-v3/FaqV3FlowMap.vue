<script setup>
import { computed, markRaw, nextTick, ref, watch } from 'vue'
import { MarkerType, VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import dagre from 'dagre'

import FaqV3FlowNode from './FaqV3FlowNode.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const props = defineProps({
  payload: { type: Object, required: true },
  selectedNodeId: { type: String, default: '' },
  nodeIssues: { type: Object, default: () => ({}) },
  canEdit: { type: Boolean, default: false },
  showStructureMenu: { type: Boolean, default: false },
})

const emit = defineEmits(['select-node', 'add-node', 'remove-node'])

const FLOW_ID = 'faq-v3-flow-map'
const NODE_WIDTH = 256
const NODE_HEIGHT = 128
const nodeTypes = { faqV3: markRaw(FaqV3FlowNode) }

const {
  fitView,
  setCenter,
  setViewport,
  findNode,
  viewport,
} = useVueFlow({ id: FLOW_ID })

const flowReady = ref(false)

const rootNodeId = computed(
  () =>
    props.payload?.graph?.student_root_node_id ||
    props.payload?.graph?.public_root_node_id ||
    props.payload?.nodes?.[0]?.node_id ||
    '',
)

const graphNodes = computed(() => {
  const nodes = props.payload?.nodes || []
  const layout = layoutWithDagre(props.payload)
  return nodes.map((node) => {
    const issues = props.nodeIssues?.[node.node_id] || []
    const hasError = issues.some((item) => item.severity === 'error')
    const hasWarning = issues.some((item) => item.severity === 'warning')
    const position = layout[node.node_id] || { x: 40, y: 40 }
    return {
      id: node.node_id,
      type: 'faqV3',
      position,
      selected: node.node_id === props.selectedNodeId,
      draggable: false,
      connectable: false,
      data: {
        nodeId: node.node_id,
        title: node.display?.title || 'Etapa sem título',
        nodeKind: node.node_kind,
        availableStudent: (node.audiences || []).includes('student'),
        availablePublic: (node.audiences || []).includes('public'),
        hasOpPlaybook: Boolean(node.playbooks?.op),
        hasBpoPlaybook: node.playbooks?.bpo != null,
        hasAnalystPlaybook: Boolean(node.playbooks?.analyst),
        hasError,
        hasWarning,
        isRoot: node.node_id === rootNodeId.value,
        canEdit: props.canEdit,
        showStructureMenu: props.showStructureMenu,
        onSelect: (nodeId) => emit('select-node', nodeId),
        onAddChild: (kind) => emit('add-node', kind, node.node_id),
        onDelete: () => emit('remove-node', node.node_id),
      },
    }
  })
})

const graphEdges = computed(() =>
  (props.payload?.edges || [])
    .filter((edge) => edge.active !== false)
    .map((edge) => ({
      id: edge.edge_id,
      source: edge.parent_node_id,
      target: edge.child_node_id,
      type: 'smoothstep',
      selectable: false,
      focusable: false,
      markerEnd: MarkerType.ArrowClosed,
    })),
)

function layoutWithDagre(payload) {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', ranksep: 72, nodesep: 40, marginx: 24, marginy: 24 })
  for (const node of payload?.nodes || []) {
    graph.setNode(node.node_id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of payload?.edges || []) {
    if (edge.active === false) continue
    if (!graph.hasNode(edge.parent_node_id) || !graph.hasNode(edge.child_node_id)) continue
    graph.setEdge(edge.parent_node_id, edge.child_node_id)
  }
  dagre.layout(graph)
  const positions = {}
  for (const node of payload?.nodes || []) {
    const laid = graph.node(node.node_id)
    positions[node.node_id] = laid
      ? { x: Math.round(laid.x - NODE_WIDTH / 2), y: Math.round(laid.y - NODE_HEIGHT / 2) }
      : { x: 40, y: 40 }
  }
  return positions
}

function zoomInMap() {
  setViewport({
    x: viewport.value.x,
    y: viewport.value.y,
    zoom: Math.min(viewport.value.zoom * 1.2, 2.5),
  })
}

function zoomOutMap() {
  setViewport({
    x: viewport.value.x,
    y: viewport.value.y,
    zoom: Math.max(viewport.value.zoom / 1.2, 0.2),
  })
}

async function fitToScreen() {
  await nextTick()
  fitView({ padding: 0.22, duration: 200 })
}

function centerSelected() {
  const node = findNode(props.selectedNodeId)
  if (!node) return
  setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
    zoom: viewport.value.zoom,
    duration: 200,
  })
}

function goToRoot() {
  const rootId = rootNodeId.value
  if (!rootId) return
  emit('select-node', rootId)
  nextTick(() => {
    const node = findNode(rootId)
    if (!node) return
    setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
      zoom: viewport.value.zoom,
      duration: 200,
    })
  })
}

watch(
  () => [props.payload?.nodes?.length, props.payload?.edges?.length],
  async () => {
    if (!flowReady.value) return
    await fitToScreen()
  },
)

function onInit() {
  flowReady.value = true
  fitToScreen()
}

defineExpose({ fitToScreen, centerSelected, goToRoot, zoomIn: zoomInMap, zoomOut: zoomOutMap })
</script>

<template>
  <section class="faq-v3-flow-map crm-panel" aria-labelledby="faq-v3-map-title">
    <div class="faq-v3-flow-map__toolbar">
      <div>
        <h2 id="faq-v3-map-title">Mapa do fluxo</h2>
        <p>Representação visual da árvore. Clique em uma etapa para editar.</p>
      </div>
    </div>

    <div class="faq-v3-flow-map__canvas" role="application" aria-label="Mapa gráfico do fluxo">
      <VueFlow
        :id="FLOW_ID"
        :nodes="graphNodes"
        :edges="graphEdges"
        :node-types="nodeTypes"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="true"
        :pan-on-drag="true"
        :zoom-on-scroll="true"
        fit-view-on-init
        @nodes-initialized="onInit"
        @node-click="(_, node) => emit('select-node', node.id)"
      >
        <Background pattern-color="var(--color-border)" :gap="28" />
      </VueFlow>

      <div class="faq-v3-flow-map__floating-controls" role="toolbar" aria-label="Controles do mapa">
        <button
          type="button"
          class="faq-v3-flow-map__control"
          aria-label="Ajustar à tela"
          title="Ajustar à tela"
          @click="fitToScreen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
        <button
          type="button"
          class="faq-v3-flow-map__control"
          aria-label="Ampliar"
          title="Ampliar"
          @click="zoomInMap"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
        <button
          type="button"
          class="faq-v3-flow-map__control"
          aria-label="Reduzir"
          title="Reduzir"
          @click="zoomOutMap"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
        <button
          type="button"
          class="faq-v3-flow-map__control"
          aria-label="Centralizar etapa selecionada"
          title="Centralizar etapa selecionada"
          @click="centerSelected"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
        <button
          type="button"
          class="faq-v3-flow-map__control"
          aria-label="Voltar à raiz"
          title="Voltar à raiz"
          @click="goToRoot"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>

    <footer class="faq-v3-flow-map__legend" aria-label="Legenda">
      <span class="crm-chip">Etapa</span>
      <span class="crm-chip">Resposta final</span>
      <span class="crm-chip">Aluno / Público</span>
      <span class="crm-chip">OP / BPO / Analista</span>
      <span class="crm-chip">Erro ou alerta de validação</span>
    </footer>

    <p class="faq-v3-flow-map__a11y-hint">
      Para navegação com leitor de tela, use a lista de etapas.
    </p>
  </section>
</template>

<style scoped>
.faq-v3-flow-map {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  min-height: 28rem;
}

.faq-v3-flow-map__toolbar,
.faq-v3-flow-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.faq-v3-flow-map__toolbar h2 {
  margin: 0;
  font-size: var(--font-size-md);
}

.faq-v3-flow-map__toolbar p,
.faq-v3-flow-map__a11y-hint {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-v3-flow-map__canvas {
  position: relative;
  height: 28rem;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted, var(--color-surface));
  overflow: hidden;
}

.faq-v3-flow-map__canvas :deep(.vue-flow) {
  background: transparent;
}

.faq-v3-flow-map__canvas :deep(.vue-flow__edge-path) {
  stroke: #64748b;
  stroke-width: 2px;
}

.faq-v3-flow-map__canvas :deep(.vue-flow__arrowhead) {
  fill: #64748b;
}

.faq-v3-flow-map__canvas :deep(.vue-flow__handle) {
  width: 0.5rem;
  height: 0.5rem;
  border: 1px solid #64748b;
  background: var(--color-surface);
  opacity: 0;
}

.faq-v3-flow-map__floating-controls {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  z-index: 6;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md, 0 0.25rem 0.75rem rgba(0, 0, 0, 0.12));
}

.faq-v3-flow-map__control {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  color: var(--color-text);
}

.faq-v3-flow-map__control:hover {
  background: var(--color-surface-muted);
}

.faq-v3-flow-map__control svg {
  width: 1.125rem;
  height: 1.125rem;
}

.faq-v3-flow-map__legend {
  justify-content: flex-start;
}
</style>
