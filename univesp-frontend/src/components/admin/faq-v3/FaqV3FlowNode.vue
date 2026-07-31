<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  selected: {
    type: Boolean,
    default: false,
  },
})

const kindLabel = computed(() =>
  props.data?.nodeKind === 'final' ? 'Resposta final' : 'Etapa',
)

const statusLabel = computed(() => {
  if (props.data?.hasError) return 'Com erro'
  if (props.data?.hasWarning) return 'Com alerta'
  return kindLabel.value
})

const structureMenuOpen = ref(false)
const structureMenuRef = ref(null)
const structureTriggerRef = ref(null)

function selectNode() {
  props.data?.onSelect?.(props.data?.nodeId)
}

function toggleStructureMenu(event) {
  event.stopPropagation()
  structureMenuOpen.value = !structureMenuOpen.value
}

function runStructureAction(action, event) {
  event.stopPropagation()
  structureMenuOpen.value = false
  props.data?.onSelect?.(props.data?.nodeId)
  action()
}

function handleDocumentPointerDown(event) {
  if (!structureMenuOpen.value) return
  const panel = structureMenuRef.value
  const trigger = structureTriggerRef.value
  if (panel?.contains(event.target) || trigger?.contains(event.target)) return
  structureMenuOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown))
</script>

<template>
  <article
    class="faq-v3-flow-node"
    :class="{
      'is-selected': selected,
      'is-final': data.nodeKind === 'final',
      'has-error': data.hasError,
      'has-warning': data.hasWarning && !data.hasError,
    }"
    role="button"
    tabindex="0"
    :aria-current="selected ? 'true' : undefined"
    :aria-label="`${kindLabel}: ${data.title || 'Sem título'}`"
    @click.stop="selectNode"
    @keydown.enter.prevent="selectNode"
    @keydown.space.prevent="selectNode"
  >
    <Handle type="target" :position="Position.Top" class="faq-v3-flow-node__handle" />
    <div class="faq-v3-flow-node__meta">
      <span class="crm-chip">{{ kindLabel }}</span>
      <span v-if="data.hasError || data.hasWarning" class="crm-chip faq-v3-flow-node__status">
        {{ statusLabel }}
      </span>
      <div
        v-if="data.showStructureMenu && data.canEdit"
        class="faq-v3-flow-node__structure"
        @click.stop
      >
        <button
          ref="structureTriggerRef"
          type="button"
          class="faq-v3-flow-node__structure-trigger"
          aria-haspopup="menu"
          :aria-expanded="structureMenuOpen"
          aria-label="Ações estruturais da etapa"
          @click="toggleStructureMenu"
        >
          ⋯
        </button>
        <div
          v-if="structureMenuOpen"
          ref="structureMenuRef"
          class="faq-v3-flow-node__structure-menu"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            class="faq-v3-flow-node__structure-item"
            @click="runStructureAction(() => data.onAddChild?.('path'), $event)"
          >
            Adicionar etapa abaixo
          </button>
          <button
            type="button"
            role="menuitem"
            class="faq-v3-flow-node__structure-item"
            @click="runStructureAction(() => data.onAddChild?.('final'), $event)"
          >
            Adicionar resposta final
          </button>
          <button
            type="button"
            role="menuitem"
            class="faq-v3-flow-node__structure-item faq-v3-flow-node__structure-item--danger"
            :disabled="data.isRoot"
            @click="runStructureAction(() => data.onDelete?.(), $event)"
          >
            Excluir etapa
          </button>
        </div>
      </div>
    </div>
    <h3 class="faq-v3-flow-node__title">{{ data.title || 'Etapa sem título' }}</h3>
    <div class="faq-v3-flow-node__chips" aria-label="Disponibilidade">
      <span v-if="data.availableStudent" class="crm-chip">Aluno</span>
      <span v-if="data.availablePublic" class="crm-chip">Público</span>
      <span v-if="data.hasOpPlaybook" class="crm-chip">OP</span>
      <span v-if="data.hasBpoPlaybook" class="crm-chip">BPO</span>
      <span v-if="data.hasAnalystPlaybook" class="crm-chip">Analista</span>
    </div>
    <Handle type="source" :position="Position.Bottom" class="faq-v3-flow-node__handle" />
  </article>
</template>

<style scoped>
.faq-v3-flow-node {
  width: 16rem;
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: none;
  cursor: pointer;
  text-align: start;
}

.faq-v3-flow-node:focus-visible {
  outline: var(--focus-ring-width, 2px) solid var(--color-focus, var(--color-primary));
  outline-offset: 2px;
}

.faq-v3-flow-node.is-selected {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.faq-v3-flow-node.is-final {
  border-color: var(--color-primary-dark);
}

.faq-v3-flow-node.has-error {
  border-color: var(--color-danger);
  background: var(--color-danger-soft, var(--color-surface));
}

.faq-v3-flow-node.has-warning {
  border-color: var(--color-warning, var(--color-border));
}

.faq-v3-flow-node__meta,
.faq-v3-flow-node__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-block-end: var(--space-2);
}

.faq-v3-flow-node__meta {
  align-items: center;
  justify-content: space-between;
}

.faq-v3-flow-node__title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: 1.35;
}

.faq-v3-flow-node__handle {
  width: 0.5rem;
  height: 0.5rem;
  border: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
}

.faq-v3-flow-node__status {
  font-weight: 700;
}

.faq-v3-flow-node__structure {
  position: relative;
  margin-inline-start: auto;
}

.faq-v3-flow-node__structure-trigger {
  min-width: 1.75rem;
  min-height: 1.75rem;
  border-radius: var(--radius-sm);
  font-weight: 700;
  line-height: 1;
}

.faq-v3-flow-node__structure-trigger:hover {
  background: var(--color-surface-muted);
}

.faq-v3-flow-node__structure-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 5;
  display: grid;
  gap: var(--space-1);
  min-width: 11rem;
  padding: var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md, 0 0.5rem 1rem rgba(0, 0, 0, 0.12));
}

.faq-v3-flow-node__structure-item {
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  text-align: start;
  white-space: nowrap;
}

.faq-v3-flow-node__structure-item:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.faq-v3-flow-node__structure-item--danger {
  color: var(--color-danger);
}
</style>
