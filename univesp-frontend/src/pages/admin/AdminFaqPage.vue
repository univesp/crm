<script setup>
import { computed, reactive, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MarkerType, VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { buildFaqBuilderBackendReadiness, buildFaqBuilderUpsertPayload } from '@/contracts/faqBuilderContract'
import FaqCanvasNode from '@/components/admin/faq-builder/FaqCanvasNode.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  addFaqBuilderChildNode,
  buildAutoLayoutSnapshot,
  buildFaqBuilderDiff,
  buildFaqBuilderGraph,
  buildFaqBuilderPreviewJourney,
  connectFaqBuilderNodes,
  downloadFaqBuilderTemplateXlsx,
  getFaqBuilderBundleById,
  getFaqBuilderCatalogOptions,
  getFaqBuilderNode,
  loadFaqBuilderBundleLibraryLocal,
  moveFaqBuilderNode,
  publishFaqBuilderWorkspace,
  readFaqBuilderSpreadsheet,
  saveFaqBuilderBundleLibraryLocal,
  setFaqBuilderNodeField,
  setFaqBuilderNodeListField,
  syncCanvasSnapshotEdges,
  touchFaqBuilderWorkspace,
  transitionFaqBuilderWorkflow,
  updateCanvasSnapshotNodePosition,
  validateFaqBuilderBundle,
} from '@/services/faqBuilderHybridRuntime'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function decodeBundleParam(value = '') {
  try {
    return decodeURIComponent(String(value || ''))
  } catch {
    return String(value || '')
  }
}

const catalogs = getFaqBuilderCatalogOptions()
const backendReadiness = buildFaqBuilderBackendReadiness({
  hasServerUpsert: false,
  hasServerDryRun: false,
  hasServerLock: false,
})
const modeTabs = [
  { key: 'visual', label: 'Edicao' },
  { key: 'import', label: 'Importacao' },
  { key: 'governance', label: 'Governanca' },
]

const ui = reactive({ mode: String(route.query.mode || 'visual'), selectedNodeId: '', parentTargetId: '', governanceSummary: '' })
const feedback = reactive({ type: '', message: '' })
const importState = reactive({ fileName: '', isLoading: false, result: null })
const previewState = reactive({ activeNodeId: '' })
const responseEditorRef = ref(null)

const currentEditorName = computed(() => auth.displayName || auth.mockContext?.userName || 'Admin local')
const library = reactive(loadFaqBuilderBundleLibraryLocal(currentEditorName.value))
const bundleId = computed(() => decodeBundleParam(route.params.bundleId))
const currentBundleEntry = computed(() => getFaqBuilderBundleById(library, bundleId.value))
const workspace = computed(() => currentBundleEntry.value?.workspace || null)
const isMissingBundle = computed(() => !currentBundleEntry.value || !workspace.value)

const validation = computed(() =>
  workspace.value
    ? validateFaqBuilderBundle(workspace.value.draftBundle)
    : { issues: [], errors: [], warnings: [], nodeIssueSummary: new Map(), hasBlockingPublishError: false },
)
const graphRuntime = computed(() =>
  workspace.value
    ? buildFaqBuilderGraph(workspace.value.draftBundle, workspace.value.canvasSnapshot, validation.value)
    : { nodes: [], edges: [] },
)
const flowNodes = computed(() =>
  graphRuntime.value.nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onSelect: () => (ui.selectedNodeId = node.id),
      onQuickAddPath: () => quickAddChild(node.id, 'path'),
      onQuickAddFinal: () => quickAddChild(node.id, 'final'),
    },
  })),
)
const flowEdges = computed(() => graphRuntime.value.edges.map((edge) => ({ ...edge, markerEnd: MarkerType.ArrowClosed })))
const selectedNode = computed(() => (workspace.value ? getFaqBuilderNode(workspace.value.draftBundle, ui.selectedNodeId) : null))
const selectedNodeParentLink = computed(() =>
  workspace.value ? workspace.value.draftBundle.links.find((link) => link.ativo !== false && link.child_node_id === ui.selectedNodeId) || null : null,
)
const selectedNodeMode = computed(() => (selectedNode.value?.node_kind === 'leaf' ? 'final' : 'path'))
const parentOptions = computed(() =>
  workspace.value
    ? workspace.value.draftBundle.nodes.filter((node) => node.id !== ui.selectedNodeId).map((node) => ({ value: node.id, label: node.titulo_exibido || node.id }))
    : [],
)
const previewRuntime = computed(() =>
  workspace.value ? buildFaqBuilderPreviewJourney(workspace.value.draftBundle, previewState.activeNodeId) : { startId: '', nodeById: new Map(), outgoingMap: new Map() },
)
const previewNode = computed(() => previewRuntime.value.nodeById.get(previewState.activeNodeId || previewRuntime.value.startId) || null)
const previewChoices = computed(() =>
  previewNode.value
    ? (previewRuntime.value.outgoingMap.get(previewNode.value.id) || []).map((link) => previewRuntime.value.nodeById.get(link.child_node_id)).filter(Boolean)
    : [],
)
const bundleDiff = computed(() =>
  workspace.value ? buildFaqBuilderDiff({ draftBundle: workspace.value.draftBundle, publishedBundle: workspace.value.publishedBundle }) : { summary: { createdNodes: 0, removedNodes: 0, updatedNodes: 0, createdLinks: 0, removedLinks: 0 } },
)
const upsertPreview = computed(() =>
  workspace.value
    ? buildFaqBuilderUpsertPayload({
        bundleContext: { bundleId: currentBundleEntry.value.bundleId, faqType: currentBundleEntry.value.faqType, subjectKey: currentBundleEntry.value.subjectKey, title: currentBundleEntry.value.title },
        bundle: workspace.value.draftBundle,
        canvasSnapshot: workspace.value.canvasSnapshot,
        workflowStatus: workspace.value.workflowStatus,
        validation: validation.value,
        lockContext: workspace.value.lockContext,
        actorName: currentEditorName.value,
      })
    : null,
)

watchEffect(() => {
  if (workspace.value && !ui.selectedNodeId && workspace.value.draftBundle.nodes[0]) {
    ui.selectedNodeId = workspace.value.draftBundle.nodes[0].id
  }
})
watch(() => route.query.mode, (mode) => { if (mode && modeTabs.some((tab) => tab.key === mode)) ui.mode = mode })
watch(
  () => workspace.value,
  (value) => {
    if (!value || !currentBundleEntry.value) return
    currentBundleEntry.value.updatedAt = value.lockContext?.lastTouchedAt || new Date().toISOString()
    currentBundleEntry.value.updatedBy = value.lockContext?.editorName || currentEditorName.value
    saveFaqBuilderBundleLibraryLocal(library)
  },
  { deep: true },
)
watch(selectedNode, (node) => {
  ui.parentTargetId = selectedNodeParentLink.value?.parent_node_id || ''
  if (node && responseEditorRef.value) responseEditorRef.value.innerHTML = node.resposta || ''
})

function setFeedback(type = '', message = '') { feedback.type = type; feedback.message = message }
function goToLibrary() { router.push('/admin/faq') }
function switchMode(mode = 'visual') { ui.mode = mode; router.replace({ path: route.path, query: { ...route.query, mode } }) }
function touch() { if (workspace.value) touchFaqBuilderWorkspace(workspace.value, currentEditorName.value) }
function syncEdges() { if (workspace.value) syncCanvasSnapshotEdges(workspace.value.canvasSnapshot, workspace.value.draftBundle) }

function quickAddChild(parentNodeId, nodeMode) {
  if (!workspace.value) return
  const node = addFaqBuilderChildNode(workspace.value.draftBundle, parentNodeId, { nodeMode })
  if (!node) return setFeedback('error', 'Nao foi possivel criar o no filho.')
  const parent = workspace.value.canvasSnapshot.nodePositions?.[parentNodeId] || { x: 80, y: 80 }
  updateCanvasSnapshotNodePosition(workspace.value.canvasSnapshot, node.id, { x: parent.x + 340, y: parent.y + 160 })
  syncEdges(); touch(); ui.selectedNodeId = node.id
}
function onNodeDragStop(_, node) { if (workspace.value) { updateCanvasSnapshotNodePosition(workspace.value.canvasSnapshot, node.id, node.position); touch() } }
function onFlowConnect(connection) {
  if (!workspace.value) return
  const result = connectFaqBuilderNodes(workspace.value.draftBundle, { sourceId: connection.source, targetId: connection.target })
  if (!result.ok) return setFeedback('error', result.message)
  syncEdges(); touch()
}
function applyAutoLayout() { if (workspace.value) { workspace.value.canvasSnapshot = buildAutoLayoutSnapshot(workspace.value.draftBundle, workspace.value.canvasSnapshot); touch() } }
function updateNodeField(field, value) { if (selectedNode.value && workspace.value) { setFaqBuilderNodeField(workspace.value.draftBundle, selectedNode.value.id, field, value); touch() } }
function updateNodeTags(value) { if (selectedNode.value && workspace.value) { setFaqBuilderNodeListField(workspace.value.draftBundle, selectedNode.value.id, 'tags', value); touch() } }
function updateNodeMode(mode) { updateNodeField('node_kind', mode === 'final' ? 'leaf' : selectedNodeParentLink.value ? 'branch' : 'theme'); updateNodeField('acao', mode === 'final' ? 'mostrar_resposta' : 'ir_para_subniveis') }
function moveNodeParent() { if (selectedNode.value && workspace.value && ui.parentTargetId) { const result = moveFaqBuilderNode(workspace.value.draftBundle, selectedNode.value.id, ui.parentTargetId); if (!result.ok) return setFeedback('error', result.message); syncEdges(); touch() } }
function applyEditorCommand(command) {
  if (!responseEditorRef.value) return
  responseEditorRef.value.focus()
  if (command === 'link') {
    const url = window.prompt('Informe a URL do link:')
    if (!url) return
    document.execCommand('createLink', false, url)
  } else {
    document.execCommand(command, false, null)
  }
  if (selectedNode.value) updateNodeField('resposta', responseEditorRef.value.innerHTML)
}
async function onSpreadsheetSelected(event) {
  const file = event.target.files?.[0] || null
  if (!file || !workspace.value || !currentBundleEntry.value) return
  importState.fileName = file.name; importState.isLoading = true
  try {
    importState.result = await readFaqBuilderSpreadsheet(file, { faqType: currentBundleEntry.value.faqType, baseBundle: workspace.value.draftBundle })
  } catch (error) {
    setFeedback('error', error?.message || 'Falha no dry-run.')
  } finally {
    importState.isLoading = false
  }
}
function applySpreadsheetImport() { if (workspace.value && importState.result?.ok && importState.result.draftBundle && importState.result.canvasSnapshot) { workspace.value.draftBundle = importState.result.draftBundle; workspace.value.canvasSnapshot = importState.result.canvasSnapshot; workspace.value.workflowStatus = 'Draft'; touch() } }
async function downloadTemplate() { if (currentBundleEntry.value) await downloadFaqBuilderTemplateXlsx({ faqType: currentBundleEntry.value.faqType }) }
function workflowTransition(nextStatus) { if (workspace.value) { const result = transitionFaqBuilderWorkflow(workspace.value, { nextStatus, actorName: currentEditorName.value, summary: ui.governanceSummary }); if (!result.ok) return setFeedback('error', result.message); touch() } }
function publishWorkspace() { if (workspace.value) { const result = publishFaqBuilderWorkspace(workspace.value, { actorName: currentEditorName.value, summary: ui.governanceSummary || 'Publicacao via FAQ Builder.' }); if (!result.ok) return setFeedback('error', result.message); touch() } }
function startPreview() { previewState.activeNodeId = previewRuntime.value.startId }
function stepPreview(nodeId = '') { if (nodeId) previewState.activeNodeId = nodeId }
</script>

<template>
  <div class="grid gap-5">
    <SectionPanel
      eyebrow="Admin / FAQ Builder / Fluxo dedicado"
      :title="currentBundleEntry ? currentBundleEntry.title : 'Fluxo nao encontrado'"
      description="Editor focado em um unico fluxo. O canvas mostra somente o bundle selecionado."
    >
      <template v-if="currentBundleEntry">
        <div class="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-start">
          <div class="grid gap-2 text-xs text-slate-600 md:grid-cols-4">
            <p><strong>Bundle:</strong> {{ currentBundleEntry.bundleId }}</p>
            <p><strong>Tipo:</strong> {{ currentBundleEntry.faqType }}</p>
            <p><strong>Status:</strong> {{ workspace.workflowStatus }}</p>
            <p><strong>Ultima edicao:</strong> {{ workspace.lockContext.lastTouchedAt }}</p>
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="goToLibrary">Voltar biblioteca</button>
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="applyAutoLayout">Auto-layout</button>
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="startPreview">Testar fluxo</button>
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="workflowTransition('Draft')">Salvar rascunho</button>
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="workflowTransition('In Review')">Enviar revisao</button>
            <button type="button" class="rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="publishWorkspace">Publicar fluxo</button>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button v-for="tab in modeTabs" :key="tab.key" type="button" class="rounded-full border px-3 py-2 text-xs font-semibold transition" :class="ui.mode === tab.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'" @click="switchMode(tab.key)">
            {{ tab.label }}
          </button>
          <StatusBadge :label="`Workflow: ${workspace.workflowStatus}`" />
          <StatusBadge :label="validation.hasBlockingPublishError ? 'Com erros estruturais' : 'Apto para publicar'" />
        </div>
      </template>
    </SectionPanel>

    <section
      v-if="feedback.message"
      class="rounded-[14px] border px-4 py-3 text-sm"
      :class="feedback.type === 'error' ? 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]' : 'border-[rgba(26,111,67,0.22)] bg-[rgba(220,252,231,0.75)] text-[var(--color-success)]'"
    >
      {{ feedback.message }}
    </section>

    <section v-if="isMissingBundle" class="rounded-[18px] border border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] p-6">
      <h2 class="text-base font-semibold text-[var(--color-danger)]">Fluxo nao encontrado</h2>
      <button type="button" class="mt-4 rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="goToLibrary">Voltar para biblioteca</button>
    </section>

    <template v-else-if="ui.mode === 'visual'">
      <section class="grid gap-4 xl:grid-cols-[1fr_420px]">
        <article class="rounded-[18px] border border-slate-200 bg-white p-4">
          <div class="h-[760px] rounded-[14px] border border-slate-200 bg-slate-50">
            <VueFlow :nodes="flowNodes" :edges="flowEdges" :node-types="{ faqBuilderNode: FaqCanvasNode }" fit-view-on-init class="faq-builder-flow" @connect="onFlowConnect" @node-drag-stop="onNodeDragStop">
              <Background pattern-color="#d4dbe4" :gap="26" />
              <Controls />
            </VueFlow>
          </div>
        </article>
        <article class="grid gap-4">
          <section class="rounded-[18px] border border-slate-200 bg-white p-4">
            <p class="text-sm font-semibold text-slate-900">No selecionado</p>
            <div v-if="selectedNode" class="mt-3 grid gap-3">
              <input :value="selectedNode.titulo_exibido" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm" @input="updateNodeField('titulo_exibido', $event.target.value)" />
              <select :value="selectedNodeMode" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm" @change="updateNodeMode($event.target.value)">
                <option value="path">Caminho</option><option value="final">Resposta final</option>
              </select>
              <select v-model="ui.parentTargetId" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm">
                <option value="">Mover para...</option><option v-for="option in parentOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="moveNodeParent">Aplicar movimento</button>
              <select :value="selectedNode.acao" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm" @change="updateNodeField('acao', $event.target.value)">
                <option v-for="option in catalogs.actions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <div v-if="selectedNodeMode === 'final'" class="grid gap-2 rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <div class="flex gap-2">
                  <button type="button" class="rounded-[10px] border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700" @click="applyEditorCommand('bold')">Negrito</button>
                  <button type="button" class="rounded-[10px] border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700" @click="applyEditorCommand('insertUnorderedList')">Lista</button>
                  <button type="button" class="rounded-[10px] border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700" @click="applyEditorCommand('link')">Link</button>
                </div>
                <div ref="responseEditorRef" contenteditable="true" class="min-h-[130px] rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-700" @input="updateNodeField('resposta', $event.target.innerHTML)"></div>
              </div>
              <input :value="(selectedNode.tags || []).join(', ')" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm" @input="updateNodeTags($event.target.value)" />
            </div>
            <p v-else class="mt-3 text-sm text-slate-600">Selecione um no no canvas para abrir a edicao.</p>
          </section>

          <details class="rounded-[18px] border border-slate-200 bg-white p-4">
            <summary class="cursor-pointer text-sm font-semibold text-slate-900">Validacao estrutural ({{ validation.errors.length }} erro(s))</summary>
            <div class="mt-3 grid gap-2 max-h-[220px] overflow-auto">
              <div v-for="(issue, index) in validation.issues" :key="`${issue.code}-${index}`" class="rounded-[12px] border px-3 py-2 text-xs" :class="issue.severity === 'error' ? 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]' : 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.75)] text-[#8a5200]'">
                <strong>{{ issue.code }}</strong> | {{ issue.message }}
              </div>
            </div>
          </details>

          <details class="rounded-[18px] border border-slate-200 bg-white p-4">
            <summary class="cursor-pointer text-sm font-semibold text-slate-900">Preview da jornada</summary>
            <div class="mt-3 grid gap-2">
              <p class="text-sm font-semibold text-slate-900">{{ previewNode?.titulo_exibido || 'Sem no ativo' }}</p>
              <button v-for="choice in previewChoices" :key="choice.id" type="button" class="rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700" @click="stepPreview(choice.id)">
                {{ choice.titulo_exibido }}
              </button>
            </div>
          </details>
        </article>
      </section>
    </template>

    <template v-else-if="ui.mode === 'import'">
      <section class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article class="rounded-[18px] border border-slate-200 bg-white p-4">
          <p class="text-sm font-semibold text-slate-900">Importacao de planilha para este fluxo</p>
          <div class="mt-3 flex gap-2">
            <button type="button" class="rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="downloadTemplate">Baixar template</button>
          </div>
          <input type="file" accept=".xlsx,.xls" class="mt-4 rounded-[12px] border border-slate-300 px-3 py-2 text-sm" @change="onSpreadsheetSelected" />
          <p class="mt-2 text-xs text-slate-500">{{ importState.fileName || 'Nenhum arquivo selecionado' }}</p>
        </article>
        <article class="rounded-[18px] border border-slate-200 bg-white p-4">
          <p class="text-sm font-semibold text-slate-900">Resultado do dry-run</p>
          <p v-if="importState.isLoading" class="mt-2 text-sm text-slate-600">Processando...</p>
          <template v-else-if="importState.result">
            <p class="mt-2 text-xs text-slate-600">Linhas: {{ importState.result.summary?.totalRows || 0 }} | Nos: {{ importState.result.summary?.totalNodes || 0 }} | Links: {{ importState.result.summary?.totalLinks || 0 }}</p>
            <div class="mt-3 max-h-[280px] overflow-auto rounded-[12px] border border-slate-200">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-100 text-slate-600">
                  <tr>
                    <th class="px-2 py-2">Linha</th>
                    <th class="px-2 py-2">Campo</th>
                    <th class="px-2 py-2">Codigo</th>
                    <th class="px-2 py-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(error, index) in importState.result.errors" :key="`${error.code}-${index}`" class="border-t border-slate-200">
                    <td class="px-2 py-2">{{ error.row ?? '-' }}</td>
                    <td class="px-2 py-2">{{ error.field }}</td>
                    <td class="px-2 py-2">{{ error.code }}</td>
                    <td class="px-2 py-2">{{ error.message }}</td>
                  </tr>
                  <tr v-if="!importState.result.errors.length" class="border-t border-slate-200">
                    <td colspan="4" class="px-2 py-3 text-[var(--color-success)]">Sem erros bloqueadores.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" class="mt-3 rounded-[12px] border px-3 py-2 text-xs font-semibold" :class="importState.result.ok ? 'border-[rgba(26,111,67,0.25)] bg-[rgba(220,252,231,0.8)] text-[var(--color-success)]' : 'border-slate-300 bg-slate-100 text-slate-500'" :disabled="!importState.result.ok" @click="applySpreadsheetImport">Importar neste fluxo</button>
          </template>
        </article>
      </section>
    </template>

    <template v-else>
      <section class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article class="rounded-[18px] border border-slate-200 bg-white p-4">
          <p class="text-sm font-semibold text-slate-900">Governanca e publicacao do fluxo</p>
          <textarea v-model="ui.governanceSummary" rows="3" class="mt-3 rounded-[12px] border border-slate-300 px-3 py-2 text-sm"></textarea>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="workflowTransition('Draft')">Draft</button>
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="workflowTransition('In Review')">Review</button>
            <button type="button" class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="workflowTransition('Archived')">Arquivar</button>
            <button type="button" class="rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="publishWorkspace">Publicar</button>
          </div>
        </article>
        <article class="rounded-[18px] border border-slate-200 bg-white p-4">
          <p class="text-sm font-semibold text-slate-900">Diff do bundle atual</p>
          <div class="mt-3 grid gap-1 text-xs text-slate-600">
            <p>Nos criados: {{ bundleDiff.summary.createdNodes }}</p>
            <p>Nos removidos: {{ bundleDiff.summary.removedNodes }}</p>
            <p>Nos alterados: {{ bundleDiff.summary.updatedNodes }}</p>
          </div>
          <details class="mt-3 rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <summary class="cursor-pointer text-xs font-semibold text-slate-700">Preview do payload</summary>
            <pre class="mt-2 max-h-[220px] overflow-auto text-[11px] leading-5 text-slate-600">{{ JSON.stringify(upsertPreview, null, 2) }}</pre>
          </details>
        </article>
      </section>
      <section class="rounded-[18px] border border-slate-200 bg-white p-4">
        <p class="text-sm font-semibold text-slate-900">Readiness backend/Frappe</p>
        <p class="mt-1 text-xs text-slate-600">
          upsert: {{ backendReadiness.hasServerUpsert ? 'sim' : 'nao' }} | dry-run server: {{ backendReadiness.hasServerDryRun ? 'sim' : 'nao' }} | lock server: {{ backendReadiness.hasServerLock ? 'sim' : 'nao' }}
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.faq-builder-flow {
  --vf-node-bg: transparent;
  --vf-node-text: #0f172a;
  --vf-connection-path: #0b6e8c;
}
</style>
