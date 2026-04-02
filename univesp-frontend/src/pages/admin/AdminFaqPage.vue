<script setup>
import { computed, reactive, watchEffect } from 'vue'
import ActionTile from '@/components/ActionTile.vue'
import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  buildFaqManagementRuntime,
  cloneFaqManagementPackage,
  findFaqHighlightById,
  findFaqNodeById,
  formatArrayField,
  getFaqManagementCatalogOptions,
  updateFaqHighlightField,
  updateFaqNodeField,
  updateFaqNodeListField,
} from '@/services/adminFaqBuilderRuntime'

const catalogOptions = getFaqManagementCatalogOptions()
const currentDate = new Date('2026-03-25T12:00:00-03:00')

const faqDrafts = reactive({
  aluno: cloneFaqManagementPackage('aluno'),
  op: cloneFaqManagementPackage('op'),
})

const ui = reactive({
  faqType: 'aluno',
  selectedNodeId: null,
  selectedHighlightId: null,
})

const currentPackage = computed(() => faqDrafts[ui.faqType])
const runtime = computed(() =>
  buildFaqManagementRuntime(currentPackage.value, {
    currentDate,
  }),
)
const summaryMetrics = computed(() => [
  {
    label: 'Itens da arvore',
    value: runtime.value.summary.nodes,
    hint: 'Itens editaveis na arvore atual.',
  },
  {
    label: 'Relacoes',
    value: runtime.value.summary.links,
    hint: 'Conexoes entre temas e subtapas.',
  },
  {
    label: 'Destaques ativos',
    value: runtime.value.summary.activeHighlights,
    hint: 'Highlights vigentes em 25/03/2026 nesta simulacao.',
  },
  {
    label: 'Revisao',
    value: runtime.value.summary.validationErrors === 0 ? 'OK' : runtime.value.summary.validationErrors,
    hint:
      runtime.value.summary.validationErrors === 0
        ? 'Estrutura consistente para esta base.'
        : 'Existem inconsistencias na base atual.',
  },
])
const selectedNode = computed(() => findFaqNodeById(currentPackage.value, ui.selectedNodeId))
const selectedHighlight = computed(() =>
  findFaqHighlightById(currentPackage.value, ui.selectedHighlightId),
)
const selectedRuntimeNode = computed(
  () => runtime.value.flatNodes.find((node) => node.id === ui.selectedNodeId) || null,
)
const selectedNodeLinks = computed(() =>
  runtime.value.links.filter(
    (link) => link.parent_node_id === ui.selectedNodeId || link.child_node_id === ui.selectedNodeId,
  ),
)
const metadata = computed(() => currentPackage.value.metadata || {})
const versioning = computed(() => currentPackage.value.versioning || {})
const publication = computed(() => currentPackage.value.publication || {})
const validation = computed(() => runtime.value.validation)
const isOperatorFaq = computed(() => ui.faqType === 'op')

watchEffect(() => {
  if (!selectedNode.value && runtime.value.flatNodes[0]) {
    ui.selectedNodeId = runtime.value.flatNodes[0].id
  }

  if (!selectedHighlight.value && runtime.value.highlights[0]) {
    ui.selectedHighlightId = runtime.value.highlights[0].highlight_id
  }
})

function selectFaqType(faqType) {
  ui.faqType = faqType
  ui.selectedNodeId = null
  ui.selectedHighlightId = null
}

function selectNode(nodeId) {
  ui.selectedNodeId = nodeId
}

function selectHighlight(highlightId) {
  ui.selectedHighlightId = highlightId
}

function updateNodeValue(field, value) {
  updateFaqNodeField(currentPackage.value, ui.selectedNodeId, field, value)
}

function updateNodeListValue(field, value) {
  updateFaqNodeListField(currentPackage.value, ui.selectedNodeId, field, value)
}

function updateHighlightValue(field, value) {
  updateFaqHighlightField(currentPackage.value, ui.selectedHighlightId, field, value)
}

function readNodeListField(field) {
  return formatArrayField(selectedNode.value?.[field])
}
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Admin"
      title="Gestao visual da FAQ e dos playbooks"
      description="Base inicial da edicao visual da FAQ do aluno e dos playbooks operacionais."
    >
      <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div class="grid gap-4">
          <div class="flex flex-wrap gap-3">
            <button
              v-for="option in catalogOptions.faqTypes"
              :key="option.value"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.faqType === option.value }"
              @click="selectFaqType(option.value)"
            >
              <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {{ option.value === 'aluno' ? 'Base publica' : 'Base operacional' }}
              </span>
              <span class="mt-2 block text-lg font-semibold text-slate-950">
                {{ option.label }}
              </span>
            </button>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Responsavel</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ metadata.owner }}</p>
            </div>
            <div class="inner-panel p-5">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Edicao atual</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ versioning.draft_version }}</p>
            </div>
            <div class="inner-panel p-5">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Situacao</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ versioning.publication_status }}</p>
            </div>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <ActionTile
            title="Edicao visual futura"
            description="A base ja separa arvore, relacoes e destaques para evoluir depois para drag-and-drop, importacao por planilha e publicacao controlada."
            eyebrow="Futuro"
          />
          <ActionTile
            :title="isOperatorFaq ? 'Playbook operacional' : 'FAQ do aluno'"
            :description="isOperatorFaq ? 'Campos operacionais extras ficam editaveis no mesmo item terminal.' : 'A FAQ publica segue a mesma estrutura, com menos campos operacionais.'"
            eyebrow="Diferenciacao"
          />
        </div>
      </div>
    </SectionPanel>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="metric in summaryMetrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
      />
    </section>

    <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionPanel
        eyebrow="Arvore"
        title="Arvore e navegacao"
        description="A arvore abaixo suporta multiplos niveis e serve como base da navegacao publica e operacional."
      >
        <template #action>
          <span class="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200">
            {{ runtime.flatNodes.length }} itens em tela
          </span>
        </template>

        <div class="grid gap-4">
          <div class="flex flex-wrap gap-2 text-xs text-slate-600">
            <span class="rounded-full bg-slate-100 px-3 py-1">
              temas principais: {{ runtime.summary.highlightedRoots }}
            </span>
            <span class="rounded-full bg-slate-100 px-3 py-1">
              etapas finais: {{ runtime.summary.leafs }}
            </span>
            <span class="rounded-full bg-slate-100 px-3 py-1">
              ramos: {{ runtime.summary.branches }}
            </span>
          </div>

          <div class="grid gap-2">
            <button
              v-for="node in runtime.flatNodes"
              :key="node.id"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedNodeId === node.id }"
              :style="{ paddingLeft: `${1 + node.depth * 1.15}rem` }"
              @click="selectNode(node.id)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {{ node.nodeKind }} - nivel {{ node.depth + 1 }}
                  </p>
                  <p class="mt-2 text-base font-semibold text-slate-950">{{ node.title }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    {{ node.theme }} - {{ node.subtheme }}
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <StatusBadge
                    v-if="node.highlightLabel"
                    :label="node.highlightLabel"
                  />
                  <StatusBadge :label="node.active ? 'Ativo' : 'Inativo'" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Editor"
        title="Edicao do item selecionado"
        description="O painel abaixo altera a estrutura em memoria local e revalida a base automaticamente."
      >
        <div v-if="selectedNode" class="grid gap-5">
          <div class="flex flex-wrap gap-2">
            <StatusBadge :label="selectedRuntimeNode?.nodeKind || selectedNode.node_kind" />
            <StatusBadge :label="selectedNode.ativo ? 'Ativo' : 'Inativo'" />
            <StatusBadge
              v-if="selectedRuntimeNode?.highlightLabel"
              :label="selectedRuntimeNode.highlightLabel"
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tema</span>
              <input
                :value="selectedNode.tema"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @input="updateNodeValue('tema', $event.target.value)"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Subtema</span>
              <input
                :value="selectedNode.subtema"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @input="updateNodeValue('subtema', $event.target.value)"
              />
            </label>

            <label class="grid gap-2 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Titulo / pergunta</span>
              <input
                :value="selectedNode.titulo_exibido"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @input="updateNodeValue('titulo_exibido', $event.target.value)"
              />
            </label>

            <label class="grid gap-2 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pergunta exibida</span>
              <input
                :value="selectedNode.pergunta_exibida"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @input="updateNodeValue('pergunta_exibida', $event.target.value)"
              />
            </label>

            <label class="grid gap-2 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resposta</span>
              <textarea
                :value="selectedNode.resposta"
                rows="5"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                @input="updateNodeValue('resposta', $event.target.value)"
              ></textarea>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acao final</span>
              <select
                :value="selectedNode.acao"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @change="updateNodeValue('acao', $event.target.value)"
              >
                <option
                  v-for="option in catalogOptions.actions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fila destino</span>
              <select
                :value="selectedNode.fila_destino"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @change="updateNodeValue('fila_destino', $event.target.value)"
              >
                <option
                  v-for="option in catalogOptions.queues"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Criticidade</span>
              <select
                :value="selectedNode.criticidade_padrao"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @change="updateNodeValue('criticidade_padrao', $event.target.value)"
              >
                <option
                  v-for="option in catalogOptions.criticalities"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SLA</span>
              <select
                :value="selectedNode.sla_padrao"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                @change="updateNodeValue('sla_padrao', $event.target.value)"
              >
                <option
                  v-for="option in catalogOptions.slas"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <label class="inner-panel flex items-center justify-between gap-3 p-4">
              <span class="text-sm font-semibold text-slate-900">Item ativo</span>
              <input
                :checked="selectedNode.ativo"
                type="checkbox"
                @change="updateNodeValue('ativo', $event.target.checked)"
              />
            </label>

            <label class="inner-panel flex items-center justify-between gap-3 p-4">
              <span class="text-sm font-semibold text-slate-900">Permite anexo</span>
              <input
                :checked="selectedNode.permite_anexo"
                type="checkbox"
                @change="updateNodeValue('permite_anexo', $event.target.checked)"
              />
            </label>

            <label class="inner-panel flex items-center justify-between gap-3 p-4">
              <span class="text-sm font-semibold text-slate-900">Destaque home</span>
              <input
                :checked="selectedNode.destaque_home"
                type="checkbox"
                @change="updateNodeValue('destaque_home', $event.target.checked)"
              />
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Campos exigidos</span>
              <textarea
                :value="readNodeListField('campos_exigidos')"
                rows="4"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                @input="updateNodeListValue('campos_exigidos', $event.target.value)"
              ></textarea>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Palavras-chave</span>
              <textarea
                :value="readNodeListField('palavras_chave')"
                rows="4"
                class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                @input="updateNodeListValue('palavras_chave', $event.target.value)"
              ></textarea>
            </label>
          </div>

          <div v-if="isOperatorFaq" class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Playbook operacional</p>
              <h3 class="mt-2 text-xl font-semibold text-slate-950">
                Campos exclusivos do OP
              </h3>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist OP</span>
                <textarea
                  :value="readNodeListField('checklist_op')"
                  rows="4"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                  @input="updateNodeListValue('checklist_op', $event.target.value)"
                ></textarea>
              </label>

              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sistemas a consultar</span>
                <textarea
                  :value="readNodeListField('sistemas_a_consultar')"
                  rows="4"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                  @input="updateNodeListValue('sistemas_a_consultar', $event.target.value)"
                ></textarea>
              </label>

              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documentos a solicitar</span>
                <textarea
                  :value="readNodeListField('documentos_a_solicitar')"
                  rows="4"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                  @input="updateNodeListValue('documentos_a_solicitar', $event.target.value)"
                ></textarea>
              </label>

              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resposta padrao sugerida</span>
                <textarea
                  :value="selectedNode.resposta_padrao_sugerida"
                  rows="4"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                  @input="updateNodeValue('resposta_padrao_sugerida', $event.target.value)"
                ></textarea>
              </label>

              <label class="grid gap-2 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Criterio de escalonamento</span>
                <textarea
                  :value="selectedNode.criterio_de_escalonamento"
                  rows="3"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                  @input="updateNodeValue('criterio_de_escalonamento', $event.target.value)"
                ></textarea>
              </label>

              <label class="grid gap-2 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Motivo de escalonamento sugerido</span>
                <input
                  :value="selectedNode.motivo_escalonamento_sugerido"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  @input="updateNodeValue('motivo_escalonamento_sugerido', $event.target.value)"
                />
              </label>
            </div>
          </div>

          <div class="grid gap-3">
            <p class="text-sm font-semibold text-slate-500">Relacoes do item</p>
            <div
              v-for="link in selectedNodeLinks"
              :key="link.link_id"
              class="inner-panel p-4"
            >
              <p class="text-sm font-semibold text-slate-900">
                {{ link.parentTitle }} -> {{ link.childTitle }}
              </p>
              <p class="mt-2 text-sm text-slate-600">
                ordem {{ link.ordem }} - {{ link.childKind }}
              </p>
            </div>
          </div>
        </div>

        <div v-else class="inner-panel p-6">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Nenhum no selecionado
          </p>
          <h3 class="mt-3 text-2xl font-semibold text-slate-950">
            Selecione um item da arvore para editar.
          </h3>
        </div>
      </SectionPanel>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <SectionPanel
        eyebrow="Calendario"
        title="Destaques por calendario"
        description="Os destaques abaixo definem janela academica, prioridade dinamica e evidencias na home."
      >
        <div class="grid gap-4">
          <div class="grid gap-3">
            <button
              v-for="highlight in runtime.highlights"
              :key="highlight.highlight_id"
              type="button"
              class="option-button"
              :class="{ 'is-active': ui.selectedHighlightId === highlight.highlight_id }"
              @click="selectHighlight(highlight.highlight_id)"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {{ highlight.target_type }} - {{ highlight.regra_de_calendario }}
                  </p>
                  <p class="mt-2 text-base font-semibold text-slate-950">{{ highlight.targetLabel }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    {{ highlight.janela_inicio }} ate {{ highlight.janela_fim }}
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <StatusBadge :label="highlight.activeNow ? 'Ativo agora' : 'Fora da janela'" />
                  <StatusBadge :label="highlight.badge_label" />
                </div>
              </div>
            </button>
          </div>

          <div v-if="selectedHighlight" class="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
            <div class="flex flex-wrap gap-2">
              <StatusBadge :label="selectedHighlight.activeNow ? 'Ativo agora' : 'Fora da janela'" />
              <StatusBadge :label="selectedHighlight.target_type" />
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Janela inicio</span>
                <input
                  :value="selectedHighlight.janela_inicio"
                  type="date"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  @input="updateHighlightValue('janela_inicio', $event.target.value)"
                />
              </label>

              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Janela fim</span>
                <input
                  :value="selectedHighlight.janela_fim"
                  type="date"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  @input="updateHighlightValue('janela_fim', $event.target.value)"
                />
              </label>

              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Prioridade dinamica</span>
                <input
                  :value="selectedHighlight.prioridade_dinamica"
                  type="number"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  @input="updateHighlightValue('prioridade_dinamica', Number($event.target.value || 0))"
                />
              </label>

              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordem dinamica</span>
                <input
                  :value="selectedHighlight.ordem_dinamica"
                  type="number"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  @input="updateHighlightValue('ordem_dinamica', Number($event.target.value || 0))"
                />
              </label>

              <label class="grid gap-2 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Badge / destaque</span>
                <input
                  :value="selectedHighlight.badge_label"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  @input="updateHighlightValue('badge_label', $event.target.value)"
                />
              </label>

              <label class="grid gap-2 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Regra de calendario</span>
                <input
                  :value="selectedHighlight.regra_de_calendario"
                  class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  @input="updateHighlightValue('regra_de_calendario', $event.target.value)"
                />
              </label>
            </div>

            <label class="inner-panel flex items-center justify-between gap-3 p-4">
              <span class="text-sm font-semibold text-slate-900">Destacar na home</span>
              <input
                :checked="selectedHighlight.destaque_home"
                type="checkbox"
                @change="updateHighlightValue('destaque_home', $event.target.checked)"
              />
            </label>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Governanca"
        title="Relacoes, revisao e publicacao"
        description="Esta base mostra como a gestao pode controlar a arvore, revisar consistencia e preparar a publicacao."
      >
        <div class="grid gap-5">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Ultima publicacao</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ publication.last_published_at }}</p>
              <p class="mt-2 text-sm text-slate-600">por {{ publication.last_published_by }}</p>
            </div>
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Proxima revisao</p>
              <p class="mt-3 text-lg font-semibold text-slate-950">{{ publication.next_review_at }}</p>
              <p class="mt-2 text-sm text-slate-600">{{ versioning.change_summary }}</p>
            </div>
          </div>

          <div class="grid gap-3">
            <div
              v-for="link in runtime.links"
              :key="link.link_id"
              class="inner-panel p-4"
            >
              <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-900">
                    {{ link.parentTitle }} -> {{ link.childTitle }}
                  </p>
                  <p class="mt-2 text-sm text-slate-600">
                    ordem {{ link.ordem }} - tema {{ link.parentTheme }}
                  </p>
                </div>
                <StatusBadge :label="link.ativo ? 'Link ativo' : 'Link inativo'" />
              </div>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Inconsistencias</p>
              <p class="mt-3 text-3xl font-semibold text-slate-950">{{ validation.errors.length }}</p>
              <p class="mt-2 text-sm text-slate-600">
                {{ validation.errors[0] || 'Nenhuma inconsistencia encontrada nesta edicao.' }}
              </p>
            </div>

            <div class="inner-panel p-5">
              <p class="text-sm font-semibold text-slate-500">Alertas</p>
              <p class="mt-3 text-3xl font-semibold text-slate-950">{{ validation.warnings.length }}</p>
              <p class="mt-2 text-sm text-slate-600">
                {{ validation.warnings[0] || 'Sem warnings relevantes nesta leitura.' }}
              </p>
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>
