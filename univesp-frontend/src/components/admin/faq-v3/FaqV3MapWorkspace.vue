<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import FaqV3FlowMap from './FaqV3FlowMap.vue'
import FaqV3NodeEditorPanel from './FaqV3NodeEditorPanel.vue'

const props = defineProps({
  payload: { type: Object, required: true },
  selectedNodeId: { type: String, default: '' },
  nodeIssues: { type: Object, default: () => ({}) },
  canEdit: { type: Boolean, default: false },
  drawerOpen: { type: Boolean, default: false },
  selectedNode: { type: Object, default: null },
  isRootNode: { type: Function, default: () => false },
})

const emit = defineEmits([
  'select-node',
  'close-drawer',
  'add-node',
  'remove-node',
])

const flowMapRef = ref(null)
const drawerRef = ref(null)

function handleSelectNode(nodeId) {
  emit('select-node', nodeId)
}

function handleDrawerKeydown(event) {
  if (event.key === 'Escape' && props.drawerOpen) {
    event.stopPropagation()
    emit('close-drawer')
  }
}

function centerSelected() {
  flowMapRef.value?.centerSelected()
}

function fitToScreen() {
  flowMapRef.value?.fitToScreen()
}

async function reflowMap() {
  await nextTick()
  requestAnimationFrame(() => flowMapRef.value?.fitToScreen())
}

watch(
  () => props.selectedNodeId,
  async () => {
    await reflowMap()
  },
)

watch(
  () => props.drawerOpen,
  async (open) => {
    await reflowMap()
    if (!open) return
    await nextTick()
    drawerRef.value?.focus?.()
  },
)

onMounted(() => {
  reflowMap()
  document.addEventListener('keydown', handleDrawerKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDrawerKeydown)
})

defineExpose({ centerSelected, fitToScreen })
</script>

<template>
  <div
    class="faq-v3-map-workspace"
    :class="{ 'is-drawer-open': drawerOpen && selectedNode }"
  >
    <div class="faq-v3-map-workspace__map-pane">
      <FaqV3FlowMap
        ref="flowMapRef"
        class="faq-v3-map-workspace__map"
        :payload="payload"
        :selected-node-id="selectedNodeId"
        :node-issues="nodeIssues"
        :can-edit="canEdit"
        :show-structure-menu="canEdit"
        @select-node="handleSelectNode"
        @add-node="(kind, parentId) => emit('add-node', kind, parentId)"
        @remove-node="(nodeId) => emit('remove-node', nodeId)"
      />
    </div>

    <aside
      v-if="drawerOpen && selectedNode"
      ref="drawerRef"
      class="faq-v3-map-workspace__drawer crm-panel faq-node-editor"
      tabindex="-1"
      aria-labelledby="node-editor-title"
    >
      <div class="faq-v3-map-workspace__drawer-header">
        <h2 id="node-editor-title" class="faq-v3-map-workspace__drawer-title">Editar etapa</h2>
        <button type="button" class="crm-button-secondary" @click="emit('close-drawer')">
          Fechar painel
        </button>
      </div>
      <div class="faq-v3-map-workspace__drawer-body">
        <FaqV3NodeEditorPanel />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.faq-v3-map-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  min-height: 32rem;
}

.faq-v3-map-workspace.is-drawer-open {
  grid-template-columns: minmax(0, 1fr) min(100%, 28rem);
}

.faq-v3-map-workspace__map-pane {
  min-width: 0;
}

.faq-v3-map-workspace__map {
  min-height: 32rem;
  height: 100%;
}

.faq-v3-map-workspace__map :deep(.faq-v3-flow-map) {
  min-height: 32rem;
  height: 100%;
}

.faq-v3-map-workspace__map :deep(.faq-v3-flow-map__canvas) {
  height: min(56vh, 40rem);
  min-height: 24rem;
}

.faq-v3-map-workspace__drawer {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-3);
  min-width: 0;
  max-height: min(56vh, 40rem);
  overflow: hidden;
  padding: var(--space-4);
  border-left: 1px solid var(--border-default);
  background: var(--color-surface);
}

.faq-v3-map-workspace__drawer-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.faq-v3-map-workspace__drawer-title {
  margin: 0;
  font-size: var(--font-size-md);
}

.faq-v3-map-workspace__drawer-body {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

@media (max-width: 48rem) {
  .faq-v3-map-workspace.is-drawer-open {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(18rem, 1fr) auto;
  }

  .faq-v3-map-workspace__drawer {
    max-height: none;
    border-left: 0;
    border-top: 1px solid var(--border-default);
  }
}
</style>
