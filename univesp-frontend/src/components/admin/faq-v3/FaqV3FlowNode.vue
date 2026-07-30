<script setup>
import { computed } from 'vue'
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

function selectNode() {
  props.data?.onSelect?.(props.data?.nodeId)
}
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
</style>
