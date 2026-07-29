<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  approveKnowledgeV3Bundle,
  forkKnowledgeV3Draft,
  getKnowledgeV3Bundle,
  getKnowledgeV3Catalogs,
  listKnowledgeV3Versions,
  publishKnowledgeV3Version,
  saveKnowledgeV3Draft,
  submitKnowledgeV3Approval,
} from '@/services/appApi'
import {
  downloadKnowledgeV3Template,
  readKnowledgeV3Import,
  resolveImportConflict,
  resolveImportOrphan,
} from '@/services/faqV3Import'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const bundleKey = computed(() => String(route.params.bundleId || '').trim())
const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const bundle = ref(null)
const payload = ref(null)
const versions = ref([])
const etag = ref('')
const selectedNodeId = ref('')
const treeAudience = ref('student')
const activeTab = ref('student')
const previewPersona = ref('student')
const previewVisible = ref(true)
const previewHeading = ref(null)
const changeSummary = ref('')
const importOpen = ref(false)
const importBusy = ref(false)
const importDiff = ref(null)
const validity = reactive({ valid_from: '', valid_until: '' })
const catalogs = reactive({ themes: [], routing_patterns: [] })

const tabs = [
  { key: 'student', label: 'Aluno' },
  { key: 'public', label: 'Público externo' },
  { key: 'op', label: 'OP' },
  { key: 'bpo', label: 'BPO' },
  { key: 'analyst', label: 'Analista' },
  { key: 'routing', label: 'Encaminhamento' },
  { key: 'document', label: 'Documento' },
  { key: 'media', label: 'Mídia' },
]
const personaLabels = {
  student: 'Aluno',
  public: 'Público externo',
  op: 'OP',
  bpo: 'BPO',
  analyst: 'Analista',
}
const lifecycleLabels = {
  draft: 'Rascunho',
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovado',
  published: 'Publicado',
  superseded: 'Substituído',
  rejected: 'Ajustes solicitados',
}
const importStatusLabels = {
  new: 'Nova',
  changed: 'Alterada',
  moved: 'Movida',
  unchanged: 'Sem alteração',
  missing_in_import: 'Ausente na planilha',
  conflict: 'Conflito',
}

const draft = computed(() => bundle.value?.draft || null)
const currentState = computed(() => draft.value?.lifecycle_state || 'published')
const selectedNode = computed(
  () => payload.value?.nodes?.find((node) => node.node_id === selectedNodeId.value) || null,
)
const selectedPattern = computed(() =>
  catalogs.routing_patterns.find(
    (pattern) => pattern.pattern_key === payload.value?.routing_policy?.pattern_key,
  ),
)
const allowedRoutingKeys = computed(() => selectedPattern.value?.allowed_routing_keys || [])
const approvedVersion = computed(() =>
  versions.value.find((version) => version.lifecycle_state === 'approved'),
)
const allowedActions = computed(() => new Set(auth.mockContext.allowedActions || []))
const canEdit = computed(
  () =>
    currentState.value === 'draft' &&
    Boolean(draft.value) &&
    allowedActions.value.has('edit_knowledge_draft'),
)
const canApprove = computed(
  () =>
    currentState.value === 'pending_approval' &&
    allowedActions.value.has('approve_knowledge'),
)
const canPublish = computed(
  () =>
    Boolean(approvedVersion.value) &&
    allowedActions.value.has('publish_knowledge_version'),
)
const isAreaEditor = computed(() =>
  ['analista_area', 'gestor_area'].includes(auth.mockContext.profileKey),
)

const treeNodes = computed(() => flattenTree(treeAudience.value))
const blockers = computed(() => validateDraft())
const previewContent = computed(() => buildPreview(previewPersona.value))

onMounted(loadEditor)

watch(
  payload,
  () => {
    if (!loading.value && payload.value) dirty.value = true
  },
  { deep: true },
)

watch(selectedNodeId, () => {
  if (activeTab.value === 'document' && selectedNode.value?.node_kind !== 'final') {
    activeTab.value = 'student'
  }
})

async function loadEditor() {
  loading.value = true
  errorMessage.value = ''
  dirty.value = false
  try {
    const [bundleResponse, versionsResponse, catalogsResponse] = await Promise.all([
      getKnowledgeV3Bundle(bundleKey.value),
      listKnowledgeV3Versions(bundleKey.value, { page_size: 100 }),
      getKnowledgeV3Catalogs(),
    ])
    bundle.value = bundleResponse.data
    versions.value = versionsResponse.data || []
    Object.assign(catalogs, catalogsResponse.data || {})
    etag.value = bundleResponse.meta?.etag || bundle.value?.draft?.etag || ''
    const editablePayload = bundle.value?.draft?.payload
    payload.value = editablePayload ? cloneJson(editablePayload) : null
    changeSummary.value = bundle.value?.draft?.change_summary || ''
    validity.valid_from = toInputDate(bundle.value?.draft?.valid_from)
    validity.valid_until = toInputDate(bundle.value?.draft?.valid_until)
    selectedNodeId.value = payload.value?.nodes?.[0]?.node_id || ''
    dirty.value = false
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível abrir o fluxo.'
  } finally {
    loading.value = false
  }
}

async function saveDraft({ silent = false } = {}) {
  if (!canEdit.value || !payload.value || saving.value) return false
  saving.value = true
  errorMessage.value = ''
  try {
    const response = await saveKnowledgeV3Draft(
      bundleKey.value,
      {
        payload: payload.value,
        change_summary: changeSummary.value,
        valid_from: validity.valid_from || null,
        valid_until: validity.valid_until || null,
      },
      etag.value,
    )
    bundle.value.draft = response.data
    etag.value = response.meta?.etag || response.data.etag
    dirty.value = false
    if (!silent) successMessage.value = 'Rascunho salvo.'
    await refreshVersions()
    return true
  } catch (error) {
    errorMessage.value =
      error?.status === 409
        ? 'Outra pessoa alterou este rascunho. Recarregue antes de continuar.'
        : error?.message || 'Não foi possível salvar o rascunho.'
    return false
  } finally {
    saving.value = false
  }
}

async function submitApproval() {
  if (blockers.value.length) {
    errorMessage.value = 'Corrija os bloqueios indicados antes de enviar para aprovação.'
    return
  }
  if (changeSummary.value.trim().length < 20) {
    errorMessage.value = 'Explique as mudanças em pelo menos 20 caracteres.'
    return
  }
  if (dirty.value && !(await saveDraft({ silent: true }))) return
  saving.value = true
  try {
    const response = await submitKnowledgeV3Approval(
      bundleKey.value,
      { change_summary: changeSummary.value, if_match: etag.value },
      etag.value,
    )
    bundle.value.draft = response.data
    etag.value = response.meta?.etag || response.data.etag
    successMessage.value = 'Fluxo enviado ao grupo gestor responsável pelo tema.'
    await refreshVersions()
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível enviar para aprovação.'
  } finally {
    saving.value = false
  }
}

async function approveDraft() {
  saving.value = true
  errorMessage.value = ''
  try {
    await approveKnowledgeV3Bundle(bundleKey.value)
    successMessage.value = 'Versão aprovada. Um Admin diferente do autor pode publicá-la.'
    await loadEditor()
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível aprovar a versão.'
  } finally {
    saving.value = false
  }
}

async function publishApproved() {
  if (!approvedVersion.value || saving.value) return
  if (!window.confirm('Publicar esta versão para os públicos configurados?')) return
  saving.value = true
  errorMessage.value = ''
  try {
    await publishKnowledgeV3Version(approvedVersion.value.version_id)
    successMessage.value = 'Versão publicada.'
    await loadEditor()
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível publicar a versão.'
  } finally {
    saving.value = false
  }
}

async function createDraftFromPublished() {
  saving.value = true
  errorMessage.value = ''
  try {
    await forkKnowledgeV3Draft(bundleKey.value)
    await loadEditor()
    successMessage.value = 'Novo rascunho criado a partir da versão publicada.'
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível criar um novo rascunho.'
  } finally {
    saving.value = false
  }
}

async function refreshVersions() {
  versions.value = (
    await listKnowledgeV3Versions(bundleKey.value, { page_size: 100 })
  ).data
}

async function inspectImport(event) {
  const file = event.target.files?.[0]
  if (!file || !payload.value) return
  importBusy.value = true
  errorMessage.value = ''
  try {
    importDiff.value = await readKnowledgeV3Import(file, payload.value)
    if (importDiff.value.errors?.length) {
      errorMessage.value = importDiff.value.errors.join(' ')
    }
  } finally {
    importBusy.value = false
    event.target.value = ''
  }
}

function resolveConflict(stableKey, resolution) {
  try {
    importDiff.value = resolveImportConflict(importDiff.value, stableKey, resolution)
  } catch (error) {
    errorMessage.value = error.message
  }
}

function resolveOrphan(stableKey, resolution, remapStableKey = '') {
  try {
    importDiff.value = resolveImportOrphan(
      importDiff.value,
      stableKey,
      resolution,
      remapStableKey,
    )
  } catch (error) {
    errorMessage.value = error.message
  }
}

function handleOrphanChoice(stableKey, value) {
  const [resolution, remapStableKey = ''] = String(value || '').split(':')
  if (resolution) resolveOrphan(stableKey, resolution, remapStableKey)
}

function goBack() {
  return router.push({ name: isAreaEditor.value ? 'area-knowledge-review' : 'admin-faq' })
}

function applyImport() {
  if (!importDiff.value?.payload || importDiff.value.summary?.blockers) {
    errorMessage.value = 'Resolva conflitos e etapas ausentes que ainda bloqueiam a importação.'
    return
  }
  payload.value = cloneJson(importDiff.value.payload)
  selectedNodeId.value = payload.value.nodes?.[0]?.node_id || ''
  changeSummary.value = `Importação ${importDiff.value.meta?.source_schema || 'FAQ'} revisada com diff.`
  dirty.value = true
  importOpen.value = false
  successMessage.value = 'Importação aplicada ao rascunho. Revise e salve para persistir.'
}

async function downloadTemplate() {
  if (!payload.value || importBusy.value) return
  importBusy.value = true
  try {
    await downloadKnowledgeV3Template(payload.value)
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível gerar a planilha.'
  } finally {
    importBusy.value = false
  }
}

function addNode(kind) {
  if (!canEdit.value || !selectedNode.value) return
  const id = `${bundleKey.value}-${kind}-${Date.now().toString(36)}`
  const audiences =
    treeAudience.value === 'internal'
      ? ['internal']
      : [...new Set(selectedNode.value.audiences || [treeAudience.value])]
  payload.value.nodes.push({
    node_id: id,
    stable_key: id,
    node_kind: kind,
    audiences,
    display: { title: kind === 'final' ? 'Nova resposta final' : 'Nova etapa' },
    content: {
      student: audiences.includes('student') ? emptyContent() : null,
      public: audiences.includes('public') ? emptyContent() : null,
    },
    playbooks: { op: null, bpo: null, analyst: null },
    operational: {
      routing_override: null,
      criticidade: null,
      sla_policy_key: null,
    },
    document_policy: kind === 'final' ? { mode: 'disabled' } : null,
    media_refs: [],
  })
  payload.value.edges.push({
    edge_id: `${selectedNode.value.node_id}-${id}`,
    parent_node_id: selectedNode.value.node_id,
    child_node_id: id,
    order: childEdges(selectedNode.value.node_id).length + 1,
    active: true,
    audiences,
  })
  selectedNodeId.value = id
}

function removeSelectedNode() {
  const node = selectedNode.value
  if (!node || isRoot(node.node_id) || childEdges(node.node_id).length) {
    errorMessage.value =
      'Só é possível excluir uma etapa sem ramificações e que não seja a raiz.'
    return
  }
  if (!window.confirm(`Excluir a etapa “${node.display?.title || node.node_id}”?`)) return
  payload.value.nodes = payload.value.nodes.filter((item) => item.node_id !== node.node_id)
  const parentEdge = payload.value.edges.find((edge) => edge.child_node_id === node.node_id)
  payload.value.edges = payload.value.edges.filter(
    (edge) => edge.parent_node_id !== node.node_id && edge.child_node_id !== node.node_id,
  )
  selectedNodeId.value = parentEdge?.parent_node_id || payload.value.nodes[0]?.node_id || ''
}

function setContentText(layer, value) {
  if (!selectedNode.value.content) selectedNode.value.content = {}
  if (!selectedNode.value.content[layer]) selectedNode.value.content[layer] = emptyContent()
  const blocks = selectedNode.value.content[layer].blocks
  const textBlock = blocks.find((block) => block.type === 'text')
  if (textBlock) textBlock.body = value
  else blocks.push({ block_id: `${selectedNode.value.node_id}-${layer}-texto`, type: 'text', body: value })
}

function setOutcome(layer, value) {
  if (!selectedNode.value.content) selectedNode.value.content = {}
  if (!selectedNode.value.content[layer]) selectedNode.value.content[layer] = emptyContent()
  selectedNode.value.content[layer].outcome_key = value
}

function contentText(layer) {
  return (
    selectedNode.value?.content?.[layer]?.blocks?.find((block) => block.type === 'text')
      ?.body || ''
  )
}

function ensurePlaybook(layer) {
  if (!selectedNode.value.playbooks) {
    selectedNode.value.playbooks = { op: null, bpo: null, analyst: null }
  }
  if (!selectedNode.value.playbooks[layer]) {
    const inherited =
      layer === 'bpo' && selectedNode.value.playbooks.op
        ? cloneJson(selectedNode.value.playbooks.op)
        : emptyPlaybook()
    selectedNode.value.playbooks[layer] = inherited
  }
}

function useOpPlaybook() {
  selectedNode.value.playbooks.bpo = null
}

function effectivePlaybook(layer) {
  if (layer === 'bpo' && !selectedNode.value?.playbooks?.bpo) {
    return selectedNode.value?.playbooks?.op || emptyPlaybook()
  }
  return selectedNode.value?.playbooks?.[layer] || emptyPlaybook()
}

function updatePlaybookField(layer, field, value) {
  ensurePlaybook(layer)
  selectedNode.value.playbooks[layer][field] = value
}

function updatePlaybookList(layer, field, value) {
  const current = effectivePlaybook(layer)[field] || []
  const config = {
    checklist: ['checklist_item_id', 'text'],
    systems: ['system_ref_id', 'system_key'],
    documents_to_request: ['document_ref_id', 'document_type_key'],
    allowed_actions: ['action_id', 'action_key'],
    possible_outcomes: ['outcome_id', 'outcome_key'],
  }[field]
  const lines = String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  updatePlaybookField(
    layer,
    field,
    config
      ? lines.map((line, index) => {
          const [idField, valueField] = config
          const existing = current.find((item) => playbookItemLabel(item) === line)
          return {
            [idField]:
              existing?.[idField] ||
              `${selectedNode.value.node_id}-${layer}-${field}-${Date.now().toString(36)}-${index}`,
            [valueField]: line,
            label: line,
          }
        })
      : lines,
  )
}

function playbookList(layer, field) {
  return (effectivePlaybook(layer)[field] || []).map(playbookItemLabel).join('\n')
}

function setMediaUrls(value) {
  const current = selectedNode.value.media_refs || []
  selectedNode.value.media_refs = String(value || '')
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url, index) => {
      const existing = current.find((item) => item.url === url)
      return {
        asset_id:
          existing?.asset_id ||
          `${selectedNode.value.node_id}-media-${Date.now().toString(36)}-${index}`,
        type: /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'image',
        url,
      }
    })
}

function mediaUrls() {
  return (selectedNode.value?.media_refs || []).map((item) => item.url).join('\n')
}

function playbookItemLabel(item) {
  if (typeof item === 'string') return item
  return String(
    item?.text ||
      item?.label ||
      item?.system_key ||
      item?.document_type_key ||
      item?.action_key ||
      item?.outcome_key ||
      '',
  )
}

function showPreview() {
  previewVisible.value = true
  nextTick(() => previewHeading.value?.focus())
}

function flattenTree(audience) {
  if (!payload.value) return []
  const rootId =
    audience === 'student'
      ? payload.value.graph?.student_root_node_id
      : audience === 'public'
        ? payload.value.graph?.public_root_node_id
        : payload.value.graph?.internal_root_node_id || payload.value.nodes?.[0]?.node_id
  if (!rootId) return []
  const result = []
  const visit = (nodeId, depth) => {
    const node = payload.value.nodes.find((item) => item.node_id === nodeId)
    if (!node) return
    if (
      audience === 'internal' ||
      (node.audiences || []).includes(audience)
    ) {
      result.push({ ...node, depth })
    }
    childEdges(nodeId)
      .filter(
        (edge) =>
          audience === 'internal' ||
          !edge.audiences?.length ||
          edge.audiences.includes(audience),
      )
      .forEach((edge) => visit(edge.child_node_id, depth + 1))
  }
  visit(rootId, 0)
  return result
}

function childEdges(nodeId) {
  return (payload.value?.edges || [])
    .filter((edge) => edge.active !== false && edge.parent_node_id === nodeId)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
}

function isRoot(nodeId) {
  return Object.values(payload.value?.graph || {}).includes(nodeId)
}

function validateDraft() {
  if (!payload.value) return ['Crie ou abra um rascunho para editar.']
  const issues = []
  const nodeIds = new Set(payload.value.nodes.map((node) => node.node_id))
  for (const [field, label] of [
    ['student_root_node_id', 'Aluno'],
    ['public_root_node_id', 'Público externo'],
    ['internal_root_node_id', 'Interno'],
  ]) {
    const root = payload.value.graph?.[field]
    if (root && !nodeIds.has(root)) issues.push(`A raiz de ${label} não existe.`)
  }
  const patternHasOp = selectedPattern.value?.steps?.includes('op')
  payload.value.nodes.forEach((node) => {
    if (!node.display?.title?.trim()) issues.push(`A etapa ${node.node_id} está sem título.`)
    if (node.node_kind === 'final') {
      for (const audience of node.audiences || []) {
        if (
          ['student', 'public'].includes(audience) &&
          !node.content?.[audience]?.blocks?.some((block) => block.body?.trim())
        ) {
          issues.push(`A resposta final “${node.display?.title}” está vazia para ${personaLabels[audience]}.`)
        }
      }
      if (
        patternHasOp &&
        (node.audiences || []).includes('student') &&
        !node.playbooks?.op?.objective?.trim()
      ) {
        issues.push(`Defina o objetivo do playbook OP em “${node.display?.title}”.`)
      }
    } else if (node.document_policy?.mode && node.document_policy.mode !== 'disabled') {
      issues.push(`Documento só pode ser solicitado em resposta final: “${node.display?.title}”.`)
    }
  })
  return [...new Set(issues)]
}

function buildPreview(persona) {
  const node = selectedNode.value
  if (!node) return null
  if (persona === 'student' || persona === 'public') {
    return {
      title: node.display?.title,
      body: contentText(persona),
      lines: [],
      inherited: false,
    }
  }
  const playbook = effectivePlaybook(persona)
  return {
    title: playbook.objective || node.display?.title,
    body: playbook.suggested_reply || '',
    lines: playbook.checklist || [],
    inherited: persona === 'bpo' && !node.playbooks?.bpo,
  }
}

function emptyContent() {
  return { blocks: [], outcome_key: '' }
}

function emptyPlaybook() {
  return {
    objective: '',
    checklist: [],
    systems: [],
    documents_to_request: [],
    suggested_reply: '',
    allowed_actions: [],
    escalation_criteria: '',
    escalation_reason_template: '',
    possible_outcomes: [],
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
}

function toInputDate(value) {
  return value ? String(value).slice(0, 16) : ''
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}
</script>

<template>
  <main class="faq-editor-v3 crm-page-wide" aria-labelledby="faq-editor-title">
    <header class="crm-page-header faq-editor-v3__header">
      <div>
        <button type="button" class="faq-back-link" @click="goBack">
          {{ isAreaEditor ? 'Voltar para sugestões' : 'Voltar para a Biblioteca' }}
        </button>
        <h1 id="faq-editor-title" class="crm-page-title">
          {{ bundle?.title || 'Editor do fluxo' }}
        </h1>
        <p class="crm-page-description">
          Conteúdo para o aluno e orientações da operação, no mesmo fluxo.
        </p>
      </div>
      <div class="faq-editor-v3__header-actions">
        <span class="crm-chip">
          {{ lifecycleLabels[currentState] || currentState }}
        </span>
        <button
          v-if="canEdit"
          type="button"
          class="crm-button-secondary"
          @click="importOpen = !importOpen"
        >
          Importar ou atualizar
        </button>
        <button type="button" class="crm-button-secondary" @click="showPreview">
          Ver como a jornada funciona
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="faq-alert faq-alert--danger" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="faq-alert faq-alert--success" role="status">
      {{ successMessage }}
    </p>
    <p v-if="loading" role="status">Carregando Editor…</p>

    <section v-else-if="!payload" class="crm-panel faq-empty-state">
      <h2>{{ approvedVersion ? 'A versão está aprovada' : 'Este fluxo não tem rascunho em edição' }}</h2>
      <p v-if="approvedVersion">
        {{
          canPublish
            ? 'O conteúdo já passou pela aprovação e está pronto para publicação.'
            : 'O conteúdo já passou pela aprovação e aguarda publicação pelo Admin.'
        }}
      </p>
      <p v-else>Crie um novo rascunho a partir da versão publicada para fazer alterações.</p>
      <button
        v-if="canPublish"
        type="button"
        class="crm-button-primary"
        :disabled="saving"
        @click="publishApproved"
      >
        Publicar versão aprovada
      </button>
      <button
        v-else-if="!approvedVersion"
        type="button"
        class="crm-button-primary"
        :disabled="saving"
        @click="createDraftFromPublished"
      >
        Criar novo rascunho
      </button>
    </section>

    <template v-else>
      <section class="crm-panel faq-governance-strip" aria-labelledby="governance-title">
        <div>
          <h2 id="governance-title">Vigência e aprovação</h2>
          <p>Salvar mantém o rascunho. Enviar para aprovação avisa o grupo gestor deste tema.</p>
        </div>
        <label class="crm-field-label">
          Início da vigência
          <input
            v-model="validity.valid_from"
            type="datetime-local"
            class="crm-field"
            :disabled="!canEdit"
          />
        </label>
        <label class="crm-field-label">
          Fim da vigência
          <input
            v-model="validity.valid_until"
            type="datetime-local"
            class="crm-field"
            :disabled="!canEdit"
          />
        </label>
      </section>

      <section
        v-if="importOpen"
        class="crm-panel faq-import"
        aria-labelledby="faq-import-title"
      >
        <div class="faq-import__header">
          <div>
            <h2 id="faq-import-title">Importar e comparar</h2>
            <p>
              Aceita XLSX v3, JSON v2/v3 e procedure-capture-v1. Nada é salvo antes da
              sua confirmação.
            </p>
          </div>
          <button
            type="button"
            class="crm-button-secondary"
            :disabled="importBusy"
            @click="downloadTemplate"
          >
            Baixar planilha deste fluxo
          </button>
        </div>
        <label class="crm-field-label faq-import__file">
          Arquivo para comparar
          <input
            type="file"
            accept=".xlsx,.json,application/json"
            class="crm-field"
            :disabled="importBusy"
            @change="inspectImport"
          />
        </label>
        <p v-if="importBusy" role="status">Analisando arquivo…</p>

        <template v-if="importDiff?.summary">
          <div class="faq-import__summary" aria-label="Resumo da comparação">
            <span>Novas: {{ importDiff.summary.new }}</span>
            <span>Alteradas: {{ importDiff.summary.changed }}</span>
            <span>Movidas: {{ importDiff.summary.moved }}</span>
            <span>Ausentes: {{ importDiff.summary.missing_in_import }}</span>
            <span>Conflitos: {{ importDiff.summary.conflict }}</span>
          </div>
          <div class="faq-import__table-wrap">
            <table class="faq-import__table">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Situação</th>
                  <th>Decisão necessária</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in importDiff.rows" :key="row.stable_key">
                  <td>
                    <strong>{{ row.title }}</strong>
                    <small>{{ row.stable_key }}</small>
                  </td>
                  <td>{{ importStatusLabels[row.status] || row.status }}</td>
                  <td>
                    <div v-if="row.status === 'conflict' && !row.resolution" class="faq-import__choices">
                      <button
                        type="button"
                        class="crm-button-secondary"
                        @click="resolveConflict(row.stable_key, 'current')"
                      >
                        Manter atual
                      </button>
                      <button
                        type="button"
                        class="crm-button-secondary"
                        @click="resolveConflict(row.stable_key, 'imported')"
                      >
                        Usar importado
                      </button>
                    </div>
                    <select
                      v-else-if="row.status === 'missing_in_import' && !row.resolution"
                      class="crm-field"
                      aria-label="Resolver etapa ausente"
                      @change="handleOrphanChoice(row.stable_key, $event.target.value)"
                    >
                      <option value="">Escolha uma ação</option>
                      <option value="keep">Manter no fluxo</option>
                      <option value="archive">Arquivar esta etapa</option>
                      <option
                        v-for="target in importDiff.payload.nodes.filter(
                          (node) => node.stable_key !== row.stable_key,
                        )"
                        :key="target.stable_key"
                        :value="`remap:${target.stable_key}`"
                      >
                        Remapear para {{ target.display?.title || target.stable_key }}
                      </option>
                    </select>
                    <span v-else>{{ row.resolution ? 'Resolvido' : 'Nenhuma' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="faq-import__footer">
            <p v-if="importDiff.summary.blockers" class="faq-alert--danger">
              {{ importDiff.summary.blockers }} decisão(ões) bloqueiam a aplicação.
            </p>
            <p v-else class="faq-ok">Comparação pronta para aplicar ao rascunho.</p>
            <button
              type="button"
              class="crm-button-primary"
              :disabled="Boolean(importDiff.summary.blockers)"
              @click="applyImport"
            >
              Aplicar ao rascunho
            </button>
          </div>
        </template>
      </section>

      <div class="faq-editor-v3__workspace">
        <aside class="crm-panel faq-tree" aria-labelledby="flow-tree-title">
          <div class="crm-panel-header__copy">
            <h2 id="flow-tree-title">Etapas do fluxo</h2>
            <p>Escolha o público e depois a etapa que deseja editar.</p>
          </div>
          <label class="crm-field-label">
            Árvore para
            <select v-model="treeAudience" class="crm-field">
              <option value="student">Aluno</option>
              <option value="public">Público externo</option>
              <option value="internal">Operação interna</option>
            </select>
          </label>
          <ol class="faq-tree__list">
            <li v-for="node in treeNodes" :key="node.node_id">
              <button
                type="button"
                class="faq-tree__node"
                :class="{ 'is-active': node.node_id === selectedNodeId }"
                :style="{ paddingInlineStart: `${0.75 + node.depth * 1.1}rem` }"
                @click="selectedNodeId = node.node_id"
              >
                <span>{{ node.display?.title || 'Etapa sem título' }}</span>
                <small>{{ node.node_kind === 'final' ? 'Resposta final' : 'Etapa' }}</small>
              </button>
            </li>
          </ol>
          <div class="faq-tree__actions">
            <button
              type="button"
              class="crm-button-secondary"
              :disabled="!canEdit || !selectedNode"
              @click="addNode('path')"
            >
              Adicionar etapa
            </button>
            <button
              type="button"
              class="crm-button-secondary"
              :disabled="!canEdit || !selectedNode"
              @click="addNode('final')"
            >
              Adicionar resposta final
            </button>
          </div>
        </aside>

        <section class="crm-panel faq-node-editor" aria-labelledby="node-editor-title">
          <template v-if="selectedNode">
            <div class="faq-node-editor__title">
              <label class="crm-field-label">
                Nome da etapa
                <input
                  v-model="selectedNode.display.title"
                  class="crm-field"
                  :disabled="!canEdit"
                />
              </label>
              <button
                type="button"
                class="crm-button-secondary"
                :disabled="!canEdit || isRoot(selectedNode.node_id)"
                @click="removeSelectedNode"
              >
                Excluir etapa
              </button>
            </div>

            <nav class="faq-tabs" aria-label="Camadas da etapa">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="faq-tabs__button"
                :class="{ 'is-active': activeTab === tab.key }"
                :disabled="tab.key === 'document' && selectedNode.node_kind !== 'final'"
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </nav>

            <div v-if="['student', 'public'].includes(activeTab)" class="faq-form-stack">
              <p>
                Escreva a orientação que a pessoa verá nesta etapa. Use linguagem direta e indique
                o próximo passo.
              </p>
              <label class="crm-field-label">
                Orientação
                <textarea
                  class="crm-field faq-textarea"
                  :value="contentText(activeTab)"
                  :disabled="!canEdit"
                  @input="setContentText(activeTab, $event.target.value)"
                />
              </label>
              <label v-if="selectedNode.node_kind === 'final'" class="crm-field-label">
                Resultado esperado
                <input
                  class="crm-field"
                  :value="selectedNode.content?.[activeTab]?.outcome_key || ''"
                  :disabled="!canEdit"
                  placeholder="Ex.: resolveu ou abrir_atendimento"
                  @input="setOutcome(activeTab, $event.target.value)"
                />
              </label>
            </div>

            <div v-else-if="['op', 'bpo', 'analyst'].includes(activeTab)" class="faq-form-stack">
              <div v-if="activeTab === 'bpo' && !selectedNode.playbooks?.bpo" class="faq-inheritance">
                <strong>Herdado do OP</strong>
                <p>O BPO usa a orientação do OP enquanto não houver uma personalização.</p>
                <button
                  type="button"
                  class="crm-button-secondary"
                  :disabled="!canEdit"
                  @click="ensurePlaybook('bpo')"
                >
                  Personalizar para BPO
                </button>
              </div>
              <button
                v-if="activeTab === 'bpo' && selectedNode.playbooks?.bpo"
                type="button"
                class="crm-button-secondary"
                :disabled="!canEdit"
                @click="useOpPlaybook"
              >
                Usar orientação do OP
              </button>
              <label class="crm-field-label">
                Objetivo
                <textarea
                  class="crm-field"
                  :value="effectivePlaybook(activeTab).objective"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookField(activeTab, 'objective', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Checklist, um item por linha
                <textarea
                  class="crm-field faq-textarea"
                  :value="playbookList(activeTab, 'checklist')"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookList(activeTab, 'checklist', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Sistemas a consultar, um por linha
                <textarea
                  class="crm-field"
                  :value="playbookList(activeTab, 'systems')"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookList(activeTab, 'systems', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Documentos a solicitar, um por linha
                <textarea
                  class="crm-field"
                  :value="playbookList(activeTab, 'documents_to_request')"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookList(activeTab, 'documents_to_request', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Resposta sugerida
                <textarea
                  class="crm-field faq-textarea"
                  :value="effectivePlaybook(activeTab).suggested_reply"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookField(activeTab, 'suggested_reply', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Ações permitidas, uma por linha
                <textarea
                  class="crm-field"
                  :value="playbookList(activeTab, 'allowed_actions')"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookList(activeTab, 'allowed_actions', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Quando escalar
                <textarea
                  class="crm-field"
                  :value="effectivePlaybook(activeTab).escalation_criteria"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookField(activeTab, 'escalation_criteria', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Modelo do motivo do escalonamento
                <textarea
                  class="crm-field"
                  :value="effectivePlaybook(activeTab).escalation_reason_template"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookField(activeTab, 'escalation_reason_template', $event.target.value)"
                />
              </label>
              <label class="crm-field-label">
                Resultados possíveis, um por linha
                <textarea
                  class="crm-field"
                  :value="playbookList(activeTab, 'possible_outcomes')"
                  :disabled="!canEdit || (activeTab === 'bpo' && !selectedNode.playbooks?.bpo)"
                  @input="updatePlaybookList(activeTab, 'possible_outcomes', $event.target.value)"
                />
              </label>
            </div>

            <div v-else-if="activeTab === 'routing'" class="faq-form-stack">
              <label class="crm-field-label">
                Caminho operacional
                <select
                  v-model="payload.routing_policy.pattern_key"
                  class="crm-field"
                  :disabled="!canEdit"
                >
                  <option
                    v-for="pattern in catalogs.routing_patterns"
                    :key="pattern.pattern_key"
                    :value="pattern.pattern_key"
                  >
                    {{ pattern.label }}
                  </option>
                </select>
              </label>
              <p>
                {{ selectedPattern?.steps?.join(' → ') || 'Selecione um caminho.' }}
                O servidor confirma a fila real ao abrir o protocolo.
              </p>
              <label class="crm-field-label">
                Exceção para esta etapa
                <select
                  v-model="selectedNode.operational.routing_override"
                  class="crm-field"
                  :disabled="!canEdit"
                >
                  <option :value="null">Usar regra do fluxo</option>
                  <option v-for="key in allowedRoutingKeys" :key="key" :value="key">
                    {{ key }}
                  </option>
                </select>
              </label>
            </div>

            <div v-else-if="activeTab === 'document'" class="faq-form-stack">
              <p>O upload aparece somente nesta resposta final.</p>
              <label class="crm-field-label">
                Envio de documento pelo aluno
                <select
                  v-model="selectedNode.document_policy.mode"
                  class="crm-field"
                  :disabled="!canEdit"
                >
                  <option value="disabled">Desabilitado</option>
                  <option value="optional">Opcional</option>
                  <option value="required">Obrigatório</option>
                </select>
              </label>
            </div>

            <div v-else-if="activeTab === 'media'" class="faq-form-stack">
              <p>Nesta fase, use URLs institucionais de imagem ou vídeo. Upload entra na Fase 5.</p>
              <label class="crm-field-label">
                URLs, uma por linha
                <textarea
                  class="crm-field faq-textarea"
                  :value="mediaUrls()"
                  :disabled="!canEdit"
                  @input="setMediaUrls($event.target.value)"
                />
              </label>
            </div>
          </template>
        </section>

        <aside v-if="previewVisible" class="faq-side-stack">
          <section class="crm-panel faq-preview" aria-labelledby="preview-title">
            <h2 id="preview-title" ref="previewHeading" tabindex="-1">Prévia da jornada</h2>
            <label class="crm-field-label">
              Ver como
              <select v-model="previewPersona" class="crm-field">
                <option v-for="(label, value) in personaLabels" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </label>
            <article v-if="previewContent" class="crm-card-muted">
              <p v-if="previewContent.inherited" class="crm-chip">Herdado do OP</p>
              <h3>{{ previewContent.title || 'Sem conteúdo' }}</h3>
              <p>{{ previewContent.body || 'Nenhuma orientação preenchida nesta camada.' }}</p>
              <ol v-if="previewContent.lines.length">
                <li v-for="line in previewContent.lines" :key="line">{{ line }}</li>
              </ol>
            </article>
          </section>

          <section class="crm-panel faq-validation" aria-labelledby="validation-title">
            <h2 id="validation-title">Pronto para aprovação?</h2>
            <p v-if="!blockers.length" class="faq-ok" role="status">
              Nenhum bloqueio encontrado.
            </p>
            <ul v-else>
              <li v-for="issue in blockers" :key="issue">{{ issue }}</li>
            </ul>
          </section>

          <section class="crm-panel faq-history" aria-labelledby="history-title">
            <h2 id="history-title">Histórico</h2>
            <ol>
              <li v-for="version in versions.slice(0, 6)" :key="version.version_id">
                <strong>{{ lifecycleLabels[version.lifecycle_state] || version.lifecycle_state }}</strong>
                <span>{{ formatDate(version.published_at || version.approved_at) }}</span>
              </li>
            </ol>
          </section>
        </aside>
      </div>

      <section class="crm-panel faq-action-bar" aria-labelledby="next-step-title">
        <div>
          <h2 id="next-step-title">Resumo das mudanças</h2>
          <textarea
            v-model="changeSummary"
            class="crm-field"
            :disabled="!canEdit"
            placeholder="Explique o que mudou e por quê."
          />
          <small>Mínimo de 20 caracteres para enviar à aprovação.</small>
        </div>
        <div class="faq-action-bar__buttons">
          <button
            v-if="canEdit"
            type="button"
            class="crm-button-secondary"
            :disabled="saving || !dirty"
            @click="saveDraft()"
          >
            Salvar rascunho
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="crm-button-primary"
            :disabled="saving || blockers.length > 0"
            @click="submitApproval"
          >
            Enviar para aprovação
          </button>
          <button
            v-if="canApprove"
            type="button"
            class="crm-button-primary"
            :disabled="saving"
            @click="approveDraft"
          >
            Aprovar conteúdo
          </button>
          <button
            v-if="canPublish"
            type="button"
            class="crm-button-primary"
            :disabled="saving"
            @click="publishApproved"
          >
            Publicar versão aprovada
          </button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.faq-editor-v3 {
  display: grid;
  gap: var(--space-4);
}

.faq-editor-v3__header,
.faq-editor-v3__header-actions,
.faq-node-editor__title,
.faq-governance-strip,
.faq-action-bar,
.faq-action-bar__buttons,
.faq-tree__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: end;
  justify-content: space-between;
}

.faq-back-link {
  color: var(--color-primary-dark);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.faq-alert,
.faq-empty-state,
.faq-governance-strip,
.faq-import,
.faq-tree,
.faq-node-editor,
.faq-preview,
.faq-validation,
.faq-history,
.faq-action-bar {
  padding: var(--space-4);
}

.faq-import,
.faq-import__table td:first-child {
  display: grid;
  gap: var(--space-2);
}

.faq-import__header,
.faq-import__footer,
.faq-import__choices,
.faq-import__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.faq-import__file {
  max-width: 40rem;
}

.faq-import__summary span {
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.faq-import__table-wrap {
  overflow-x: auto;
}

.faq-import__table {
  width: 100%;
  min-width: 48rem;
  border-collapse: collapse;
}

.faq-import__table th,
.faq-import__table td {
  border-bottom: 1px solid var(--border-default);
  padding: var(--space-2);
  text-align: left;
  vertical-align: middle;
}

.faq-import__table small {
  color: var(--color-text-muted);
}

.faq-alert {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.faq-alert--danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.faq-alert--success,
.faq-ok {
  color: var(--color-success);
}

.faq-editor-v3__workspace {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: minmax(14rem, 0.8fr) minmax(24rem, 1.6fr) minmax(16rem, 0.9fr);
}

.faq-tree,
.faq-node-editor,
.faq-side-stack {
  min-width: 0;
}

.faq-tree__list,
.faq-history ol {
  display: grid;
  gap: var(--space-1);
  margin-block: var(--space-3);
}

.faq-tree__node {
  display: grid;
  width: 100%;
  gap: var(--space-1);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding-block: var(--space-2);
  padding-inline-end: var(--space-2);
  text-align: left;
}

.faq-tree__node:hover,
.faq-tree__node.is-active {
  border-color: var(--color-primary);
  background: var(--color-surface-muted);
}

.faq-tree__node small {
  color: var(--color-text-muted);
}

.faq-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-block: var(--space-3);
  border-bottom: 1px solid var(--border-default);
}

.faq-tabs__button {
  min-height: 2.75rem;
  border-bottom: 3px solid transparent;
  padding-inline: var(--space-3);
  white-space: nowrap;
}

.faq-tabs__button.is-active {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary-dark);
  font-weight: 700;
}

.faq-form-stack,
.faq-side-stack {
  display: grid;
  gap: var(--space-3);
}

.faq-textarea {
  min-height: 8rem;
}

.faq-inheritance {
  border-left: 4px solid var(--color-primary);
  background: var(--color-surface-muted);
  padding: var(--space-3);
}

.faq-preview h3,
.faq-validation h2,
.faq-history h2 {
  margin-bottom: var(--space-2);
}

.faq-history li {
  display: grid;
  border-bottom: 1px solid var(--border-default);
  padding-block: var(--space-2);
}

.faq-history span {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.faq-action-bar > div:first-child {
  flex: 1 1 28rem;
}

@media (max-width: 78rem) {
  .faq-editor-v3__workspace {
    grid-template-columns: minmax(14rem, 0.8fr) minmax(24rem, 1.5fr);
  }

  .faq-side-stack {
    grid-column: 1 / -1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 54rem) {
  .faq-editor-v3__workspace,
  .faq-side-stack {
    grid-template-columns: 1fr;
  }

  .faq-side-stack {
    grid-column: auto;
  }
}
</style>
