<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import FaqV3FlowMap from '@/components/admin/faq-v3/FaqV3FlowMap.vue'
import FaqV3FlowSettingsPanel from '@/components/admin/faq-v3/FaqV3FlowSettingsPanel.vue'
import FaqV3JourneySimulator from '@/components/admin/faq-v3/FaqV3JourneySimulator.vue'
import FaqV3PlaybookPreviewDialog from '@/components/admin/faq-v3/FaqV3PlaybookPreviewDialog.vue'
import FaqV3SubmitReviewDialog from '@/components/admin/faq-v3/FaqV3SubmitReviewDialog.vue'
import FaqV3VersionHistoryDialog from '@/components/admin/faq-v3/FaqV3VersionHistoryDialog.vue'
import {
  approveKnowledgeV3Bundle,
  forkKnowledgeV3Draft,
  getKnowledgeV3Bundle,
  getKnowledgeV3Catalogs,
  getRuntimeFlags,
  listKnowledgeV3Versions,
  publishKnowledgeV3Version,
  saveKnowledgeV3Draft,
  submitKnowledgeV3Approval,
  uploadKnowledgeV3Asset,
} from '@/services/appApi'
import {
  downloadKnowledgeV3Template,
  readKnowledgeV3Import,
  resolveImportConflict,
  resolveImportOrphan,
} from '@/services/faqV3Import'
import {
  applyChannelsToPayload,
  availableChannelLabels,
  audienceProfileFromChannels,
  canonicalRootId,
  channelAudiences,
  channelsFromPayload,
  flattenCanonicalTree,
  inheritsPublicFromStudent,
  isLegacyDualTree,
  normalizePayloadForEditor,
  PUBLIC_CONTENT_CUSTOM,
  PUBLIC_CONTENT_INHERIT,
  publicContentMode,
  resolveNodeContent,
  setPublicContentMode,
} from '@/services/faqV3PayloadAdapter'
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
const activeTab = ref('student')
const viewMode = ref('map')
const simulatorOpen = ref(false)
const playbookPreviewOpen = ref(false)
const settingsOpen = ref(false)
const publishConfirmOpen = ref(false)
const changeSummary = ref('')
const importOpen = ref(false)
const importBusy = ref(false)
const importDiff = ref(null)
const assetBusy = ref(false)
const mediaUploadEnabled = ref(false)
const issuesPanelOpen = ref(false)
const historyOpen = ref(false)
const submitDialogOpen = ref(false)
const submitDialogIntent = ref('review')
const mapOpen = ref(false)
const moreActionsOpen = ref(false)
const stageActionsOpen = ref(false)
const validity = reactive({ valid_from: '', valid_until: '' })
const channelFlags = reactive({ availableStudent: true, availablePublic: false })
const catalogs = reactive({ themes: [], routing_patterns: [] })

const tabs = [
  { key: 'student', label: 'Orientação' },
  { key: 'public', label: 'Público externo' },
  { key: 'op', label: 'OP' },
  { key: 'bpo', label: 'BPO' },
  { key: 'analyst', label: 'Analista' },
  { key: 'routing', label: 'Encaminhamento' },
  { key: 'document', label: 'Documento' },
]
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
const isAdmin = computed(() => auth.mockContext.profileKey === 'admin_central')
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
const canPublishDraft = computed(
  () =>
    isAdmin.value &&
    currentState.value === 'draft' &&
    Boolean(draft.value) &&
    allowedActions.value.has('publish_knowledge_version') &&
    blockers.value.length === 0,
)
const canPublishApproved = computed(
  () =>
    isAdmin.value &&
    Boolean(approvedVersion.value) &&
    allowedActions.value.has('publish_knowledge_version'),
)
const canSubmitReview = computed(
  () => canEdit.value && allowedActions.value.has('submit_knowledge_approval'),
)
const isAreaEditor = computed(() =>
  ['analista_area', 'gestor_area'].includes(auth.mockContext.profileKey),
)
const themeLabel = computed(() => {
  const key = payload.value?.theme_key || bundle.value?.theme_key || ''
  return (
    catalogs.themes.find((theme) => theme.theme_key === key)?.theme_label || key || '—'
  )
})
const channelLabelText = computed(() => availableChannelLabels(channelFlags).join(' · ') || '—')
const visibleTabs = computed(() =>
  tabs.filter((tab) => tab.key !== 'public' || channelFlags.availablePublic),
)
const publicContentIsCustom = computed(
  () => publicContentMode(selectedNode.value) === PUBLIC_CONTENT_CUSTOM,
)
const finalNodeCount = computed(
  () => (payload.value?.nodes || []).filter((node) => node.node_kind === 'final').length,
)

const treeNodes = computed(() => flattenCanonicalTree(payload.value))
const draftIssues = computed(() => collectIssues())
const blockers = computed(() => [
  ...new Set(
    draftIssues.value.filter((issue) => issue.severity === 'error').map((issue) => issue.message),
  ),
])
const nodeIssues = computed(() => {
  const grouped = {}
  for (const issue of draftIssues.value) {
    if (!issue.nodeId) continue
    if (!grouped[issue.nodeId]) grouped[issue.nodeId] = []
    grouped[issue.nodeId].push(issue)
  }
  return grouped
})
const playbookPreviewLayers = computed(() => {
  if (!selectedNode.value) return []
  return ['op', 'bpo', 'analyst'].map((layer) => ({
    key: layer,
    label: tabs.find((tab) => tab.key === layer)?.label || layer,
    inherited: layer === 'bpo' && !selectedNode.value.playbooks?.bpo,
    objective: effectivePlaybook(layer).objective,
    suggestedReply: effectivePlaybook(layer).suggested_reply,
    checklist: (effectivePlaybook(layer).checklist || []).map(playbookItemLabel),
  }))
})

onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 54rem)').matches) {
    viewMode.value = 'list'
  }
  loadEditor()
})

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
    try {
      mediaUploadEnabled.value = Boolean((await getRuntimeFlags()).data?.knowledge_media_upload)
    } catch {
      mediaUploadEnabled.value = false
    }
    etag.value = bundleResponse.meta?.etag || bundle.value?.draft?.etag || ''
    const editablePayload = bundle.value?.draft?.payload
    payload.value = editablePayload ? cloneJson(editablePayload) : null
    if (payload.value) {
      Object.assign(
        channelFlags,
        channelsFromPayload(payload.value, bundle.value?.audience_profile),
      )
      if (!isLegacyDualTree(payload.value)) {
        payload.value = normalizePayloadForEditor(payload.value, channelFlags)
      }
    }
    ensureNodePolicies()
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
    payload.value = applyChannelsToPayload(payload.value, channelFlags)
    if (payload.value.metadata) {
      payload.value.metadata.audience_profile = audienceProfileFromChannels(channelFlags)
    }
    if (payload.value.theme_key && bundle.value) {
      bundle.value.theme_key = payload.value.theme_key
    }
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
  if (!canPublishApproved.value || saving.value) return
  publishConfirmOpen.value = true
}

async function publishDraftDirect() {
  if (!canPublishDraft.value) return
  if (changeSummary.value.trim().length < 20) {
    submitDialogIntent.value = 'publish'
    submitDialogOpen.value = true
    return
  }
  publishConfirmOpen.value = true
}

function openSubmitDialog(intent) {
  submitDialogIntent.value = intent
  submitDialogOpen.value = true
}

async function confirmSubmitDialog() {
  if (changeSummary.value.trim().length < 20) return
  if (submitDialogIntent.value === 'publish') {
    submitDialogOpen.value = false
    publishConfirmOpen.value = true
    return
  }
  if (blockers.value.length) return
  await submitApproval()
  if (!errorMessage.value) submitDialogOpen.value = false
}

async function confirmPublish() {
  publishConfirmOpen.value = false
  const isDraftPublish = canPublishDraft.value && Boolean(draft.value?.version_id)
  const versionId = isDraftPublish ? draft.value.version_id : approvedVersion.value?.version_id
  if (!versionId || saving.value) return

  if (isDraftPublish) {
    if (dirty.value && !(await saveDraft({ silent: true }))) return
    payload.value = applyChannelsToPayload(payload.value, channelFlags)
  }

  saving.value = true
  errorMessage.value = ''
  try {
    const publishPayload = isDraftPublish
      ? { change_summary: changeSummary.value, if_match: etag.value }
      : undefined
    await publishKnowledgeV3Version(versionId, publishPayload)
    successMessage.value = 'Versão publicada.'
    await loadEditor()
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível publicar a versão.'
  } finally {
    saving.value = false
  }
}

function syncChannelSettings() {
  if (!payload.value || isLegacyDualTree(payload.value)) return
  payload.value = normalizePayloadForEditor(payload.value, channelFlags)
  if (!channelFlags.availablePublic && activeTab.value === 'public') {
    activeTab.value = 'student'
  }
}

function togglePublicCustomization(enabled) {
  if (!selectedNode.value) return
  setPublicContentMode(
    selectedNode.value,
    enabled ? PUBLIC_CONTENT_CUSTOM : PUBLIC_CONTENT_INHERIT,
  )
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
  Object.assign(channelFlags, channelsFromPayload(payload.value, bundle.value?.audience_profile))
  if (!isLegacyDualTree(payload.value)) {
    payload.value = normalizePayloadForEditor(payload.value, channelFlags)
  }
  ensureNodePolicies()
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
  const audiences = channelAudiences(channelFlags)
  payload.value.nodes.push({
    node_id: id,
    stable_key: id,
    node_kind: kind,
    audiences,
    display: { title: kind === 'final' ? 'Nova resposta final' : 'Nova etapa' },
    presentation: { public_content_mode: PUBLIC_CONTENT_INHERIT },
    content: {
      student: channelFlags.availableStudent ? emptyContent() : null,
      public: null,
    },
    playbooks: { op: null, bpo: null, analyst: null },
    operational: {
      routing_override: null,
      criticidade: null,
      sla_policy_key: null,
    },
    document_policy: kind === 'final' ? { mode: 'disabled' } : null,
    intake_policy:
      kind === 'final'
        ? {
            requires_cpf: false,
            cpf_purpose: '',
            requires_ra: false,
            requires_course: false,
            requires_polo: false,
          }
        : null,
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

function ensureNodePolicies() {
  for (const node of payload.value?.nodes || []) {
    if (node.node_kind !== 'final') continue
    node.document_policy ||= { mode: 'disabled' }
    node.intake_policy ||= {
      requires_cpf: false,
      cpf_purpose: '',
      requires_ra: false,
      requires_course: false,
      requires_polo: false,
    }
  }
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

function contentBlocks(layer) {
  if (!selectedNode.value.content) selectedNode.value.content = {}
  if (!selectedNode.value.content[layer]) selectedNode.value.content[layer] = emptyContent()
  return selectedNode.value.content[layer].blocks
}

function addContentBlock(layer, type = 'text') {
  contentBlocks(layer).push({
    block_id: `${selectedNode.value.node_id}-${layer}-${type}-${Date.now().toString(36)}`,
    type,
    body: '',
    url: '',
    alt: '',
    captions_url: '',
  })
}

function removeContentBlock(layer, index) {
  contentBlocks(layer).splice(index, 1)
}

function moveContentBlock(layer, index, direction) {
  const blocks = contentBlocks(layer)
  const target = index + direction
  if (target < 0 || target >= blocks.length) return
  const [block] = blocks.splice(index, 1)
  blocks.splice(target, 0, block)
}

async function uploadBlockAsset(layer, block, event) {
  const file = event.target.files?.[0]
  if (!file) return
  assetBusy.value = true
  errorMessage.value = ''
  try {
    const result = await uploadKnowledgeV3Asset(file, {
      alt_text: block.alt,
      caption: block.caption,
      transcript: block.transcript,
    })
    Object.assign(block, {
      asset_id: result.data.asset_id,
      type: result.data.type,
      url: result.data.url,
      alt: result.data.alt || block.alt,
    })
    successMessage.value = 'Mídia institucional enviada e vinculada ao bloco.'
  } catch (error) {
    errorMessage.value = error?.message || 'Não foi possível enviar a mídia.'
  } finally {
    assetBusy.value = false
    event.target.value = ''
  }
}

function setOutcome(layer, value) {
  if (!selectedNode.value.content) selectedNode.value.content = {}
  if (!selectedNode.value.content[layer]) selectedNode.value.content[layer] = emptyContent()
  selectedNode.value.content[layer].outcome_key = value
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

function isRoot(nodeId) {
  return nodeId === canonicalRootId(payload.value)
}

function collectIssues() {
  if (!payload.value) {
    return [
      {
        id: 'no-payload',
        severity: 'error',
        message: 'Crie ou abra um rascunho para editar.',
        nodeId: null,
        layer: null,
        fieldKey: 'draft',
      },
    ]
  }
  const issues = []
  if (!channelFlags.availableStudent && !channelFlags.availablePublic) {
    issues.push({
      id: 'channels-required',
      severity: 'error',
      message: 'Selecione ao menos um canal de disponibilidade.',
      nodeId: null,
      layer: null,
      fieldKey: 'channels',
    })
  }
  const nodeIds = new Set(payload.value.nodes.map((node) => node.node_id))
  const rootId = canonicalRootId(payload.value)
  if (rootId && !nodeIds.has(rootId)) {
    issues.push({
      id: 'root-missing',
      severity: 'error',
      message: 'A etapa inicial do fluxo não existe.',
      nodeId: rootId,
      layer: null,
      fieldKey: 'root',
    })
  }
  const patternHasOp = selectedPattern.value?.steps?.includes('op')
  payload.value.nodes.forEach((node) => {
    if (!node.display?.title?.trim()) {
      issues.push({
        id: `title:${node.node_id}`,
        severity: 'error',
        message: `A etapa “${node.display?.title || 'sem título'}” precisa de um nome.`,
        nodeId: node.node_id,
        layer: null,
        fieldKey: 'title',
      })
    }
    if (node.node_kind === 'final') {
      if (channelFlags.availableStudent) {
        const studentContent = resolveNodeContent(node, 'student')
        if (!studentContent?.blocks?.some(blockHasContent)) {
          issues.push({
            id: `final-answer:${node.node_id}:student`,
            severity: 'error',
            message: `A resposta final “${node.display?.title}” está vazia na orientação.`,
            nodeId: node.node_id,
            layer: 'student',
            fieldKey: 'final_answer',
          })
        }
      }
      if (channelFlags.availablePublic) {
        const publicContent = inheritsPublicFromStudent(node)
          ? resolveNodeContent(node, 'student')
          : resolveNodeContent(node, 'public')
        if (!publicContent?.blocks?.some(blockHasContent)) {
          issues.push({
            id: `final-answer:${node.node_id}:public`,
            severity: 'error',
            message: `A resposta final “${node.display?.title}” está vazia para o público externo.`,
            nodeId: node.node_id,
            layer: 'public',
            fieldKey: 'final_answer',
          })
        }
      }
      if (
        patternHasOp &&
        channelFlags.availableStudent &&
        !node.playbooks?.op?.objective?.trim()
      ) {
        issues.push({
          id: `op-objective:${node.node_id}`,
          severity: 'error',
          message: `Defina o objetivo do playbook OP em “${node.display?.title}”.`,
          nodeId: node.node_id,
          layer: 'op',
          fieldKey: 'op_objective',
        })
      }
      if (node.intake_policy?.requires_cpf && node.intake_policy.cpf_purpose?.trim().length < 10) {
        issues.push({
          id: `cpf-purpose:${node.node_id}`,
          severity: 'error',
          message: `Explique por que o CPF é necessário em “${node.display?.title}”.`,
          nodeId: node.node_id,
          layer: 'document',
          fieldKey: 'cpf_purpose',
        })
      }
    } else if (node.document_policy?.mode && node.document_policy.mode !== 'disabled') {
      issues.push({
        id: `document-mode:${node.node_id}`,
        severity: 'error',
        message: `Documento só pode ser solicitado em resposta final: “${node.display?.title}”.`,
        nodeId: node.node_id,
        layer: 'document',
        fieldKey: 'document_mode',
      })
    }
  })
  return issues
}

function blockHasContent(block) {
  if (['text', 'notice'].includes(block?.type)) return Boolean(block.body?.trim())
  return Boolean(block?.url?.trim())
}

function childEdges(nodeId) {
  return (payload.value?.edges || [])
    .filter((edge) => edge.active !== false && edge.parent_node_id === nodeId)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
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

function navigateToIssue(issue) {
  if (issue?.nodeId) selectedNodeId.value = issue.nodeId
  issuesPanelOpen.value = false
}

function openHistoryFromMenu() {
  historyOpen.value = true
  moreActionsOpen.value = false
}

function openPlaybookFromMenu() {
  playbookPreviewOpen.value = true
  moreActionsOpen.value = false
}

function openImportFromMenu() {
  importOpen.value = true
  moreActionsOpen.value = false
}

function deleteStageFromMenu() {
  stageActionsOpen.value = false
  removeSelectedNode()
}
</script>

<template>
  <main class="faq-editor-v3 crm-page-wide" aria-labelledby="faq-editor-title">
    <header class="crm-page-header faq-editor-v3__header">
      <div class="faq-editor-v3__header-main">
        <div>
          <button type="button" class="faq-back-link" @click="goBack">
            {{ isAreaEditor ? 'Voltar para sugestões' : 'Voltar para a Biblioteca' }}
          </button>
          <h1 id="faq-editor-title" class="crm-page-title">
            {{ bundle?.title || 'Editor do fluxo' }}
          </h1>
          <div class="faq-editor-v3__header-status">
            <span class="crm-chip">
              {{ lifecycleLabels[currentState] || currentState }}
            </span>
            <span v-if="dirty && canEdit" class="faq-editor-v3__dirty" role="status">
              Alterações não salvas
            </span>
          </div>
        </div>
      </div>
      <div v-if="payload" class="faq-editor-v3__header-toolbar">
        <button type="button" class="crm-button-secondary" @click="mapOpen = true">Ver mapa</button>
        <button type="button" class="crm-button-secondary" @click="simulatorOpen = true">
          Simular jornada
        </button>
        <button type="button" class="crm-button-secondary" @click="settingsOpen = true">
          Configurações do fluxo
        </button>
        <div class="faq-menu">
          <button
            type="button"
            class="crm-button-secondary"
            aria-haspopup="menu"
            :aria-expanded="moreActionsOpen"
            @click="moreActionsOpen = !moreActionsOpen"
          >
            Mais ações
          </button>
          <div v-if="moreActionsOpen" class="faq-menu__panel" role="menu">
            <button
              type="button"
              role="menuitem"
              class="faq-menu__item"
              @click="openHistoryFromMenu"
            >
              Histórico de versões
            </button>
            <button
              type="button"
              role="menuitem"
              class="faq-menu__item"
              :disabled="!selectedNode"
              @click="openPlaybookFromMenu"
            >
              Ver playbook
            </button>
            <button
              v-if="canEdit"
              type="button"
              role="menuitem"
              class="faq-menu__item"
              @click="openImportFromMenu"
            >
              Importar ou atualizar
            </button>
          </div>
        </div>
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
          canPublishApproved
            ? 'O conteúdo já passou pela aprovação e está pronto para publicação.'
            : 'O conteúdo já passou pela aprovação e aguarda publicação pelo Admin.'
        }}
      </p>
      <p v-else>Crie um novo rascunho a partir da versão publicada para fazer alterações.</p>
      <button
        v-if="canPublishApproved"
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
            <p>Escolha a etapa que deseja editar.</p>
          </div>
          <div class="faq-view-toggle" role="tablist" aria-label="Visualização do fluxo">
            <button
              type="button"
              role="tab"
              class="faq-view-toggle__button"
              :class="{ 'is-active': viewMode === 'map' }"
              :aria-selected="viewMode === 'map'"
              @click="viewMode = 'map'"
            >
              Mapa do fluxo
            </button>
            <button
              type="button"
              role="tab"
              class="faq-view-toggle__button"
              :class="{ 'is-active': viewMode === 'list' }"
              :aria-selected="viewMode === 'list'"
              @click="viewMode = 'list'"
            >
              Lista de etapas
            </button>
          </div>
          <FaqV3FlowMap
            v-if="viewMode === 'map'"
            :payload="payload"
            :selected-node-id="selectedNodeId"
            :node-issues="nodeIssues"
            @select-node="selectedNodeId = $event"
          />
          <ol v-else class="faq-tree__list">
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
              <div class="faq-menu">
                <button
                  type="button"
                  class="crm-button-secondary"
                  aria-haspopup="menu"
                  :aria-expanded="stageActionsOpen"
                  @click="stageActionsOpen = !stageActionsOpen"
                >
                  Ações da etapa
                </button>
                <div v-if="stageActionsOpen" class="faq-menu__panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    class="faq-menu__item faq-menu__item--danger"
                    :disabled="!canEdit || isRoot(selectedNode.node_id)"
                    @click="deleteStageFromMenu"
                  >
                    Excluir etapa
                  </button>
                </div>
              </div>
            </div>

            <nav class="faq-tabs" aria-label="Camadas da etapa">
              <button
                v-for="tab in visibleTabs"
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

            <div v-if="activeTab === 'student'" class="faq-form-stack">
              <p>
                Escreva a orientação que a pessoa verá nesta etapa. Use linguagem direta e indique
                o próximo passo.
              </p>
              <ol class="faq-blocks" aria-label="Blocos da orientação">
                <li
                  v-for="(block, index) in contentBlocks('student')"
                  :key="block.block_id"
                  class="crm-card-muted faq-block"
                >
                  <div class="faq-block__header">
                    <label v-if="block.type !== 'button'" class="crm-field-label">
                      Tipo do bloco
                      <select v-model="block.type" class="crm-field" :disabled="!canEdit">
                        <option value="text">Texto</option>
                        <option value="image">Imagem</option>
                        <option value="link">Link</option>
                        <option value="video">Vídeo</option>
                        <option value="notice">Aviso</option>
                        <option value="button">Botão controlado</option>
                        <option value="file">Arquivo institucional</option>
                        <option value="animation">Animação acessível</option>
                      </select>
                    </label>
                    <div class="faq-block__actions">
                      <button type="button" class="crm-button-secondary" :disabled="!canEdit || index === 0" :aria-label="`Mover bloco ${index + 1} para cima`" @click="moveContentBlock('student', index, -1)">Subir</button>
                      <button type="button" class="crm-button-secondary" :disabled="!canEdit || index === contentBlocks('student').length - 1" :aria-label="`Mover bloco ${index + 1} para baixo`" @click="moveContentBlock('student', index, 1)">Descer</button>
                      <button type="button" class="crm-button-secondary" :disabled="!canEdit" :aria-label="`Excluir bloco ${index + 1}`" @click="removeContentBlock('student', index)">Excluir</button>
                    </div>
                  </div>
                  <label v-if="['text', 'notice'].includes(block.type)" class="crm-field-label">
                    Conteúdo
                    <textarea v-model="block.body" class="crm-field faq-textarea" :disabled="!canEdit" />
                  </label>
                  <template v-else>
                    <label class="crm-field-label">
                      Endereço HTTPS
                      <input v-model="block.url" type="url" class="crm-field" :disabled="!canEdit" />
                    </label>
                    <label v-if="['link', 'file'].includes(block.type)" class="crm-field-label">
                      Texto exibido
                      <input v-model="block.body" class="crm-field" :disabled="!canEdit" />
                    </label>
                    <label v-if="block.type === 'button'" class="crm-field-label">
                      Ação controlada
                      <select v-model="block.action_key" class="crm-field" :disabled="!canEdit">
                        <option value="open_ticket">Abrir atendimento</option>
                        <option value="go_login">Ir para o portal do aluno</option>
                      </select>
                    </label>
                    <label v-if="block.type === 'button'" class="crm-field-label">
                      Texto do botão
                      <input v-model="block.body" class="crm-field" :disabled="!canEdit" />
                    </label>
                    <label v-if="['image', 'animation'].includes(block.type)" class="crm-field-label">
                      Texto alternativo
                      <input v-model="block.alt" class="crm-field" :disabled="!canEdit" />
                    </label>
                    <label v-if="block.type === 'video'" class="crm-field-label">
                      URL da legenda
                      <input v-model="block.captions_url" type="url" class="crm-field" :disabled="!canEdit" />
                    </label>
                    <label v-if="block.type === 'video'" class="crm-field-label">
                      Transcrição
                      <textarea v-model="block.transcript" class="crm-field faq-textarea" :disabled="!canEdit" />
                    </label>
                    <label v-if="mediaUploadEnabled && ['image', 'video'].includes(block.type)" class="crm-field-label">
                      Enviar mídia institucional
                      <input type="file" :accept="block.type === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'video/mp4,video/webm'" :disabled="!canEdit || assetBusy" @change="uploadBlockAsset('student', block, $event)" />
                    </label>
                  </template>
                </li>
              </ol>
              <button type="button" class="crm-button-secondary" :disabled="!canEdit" @click="addContentBlock('student')">
                Adicionar bloco
              </button>
              <label v-if="selectedNode.node_kind === 'final'" class="crm-field-label">
                Resultado esperado
                <input
                  class="crm-field"
                  :value="selectedNode.content?.student?.outcome_key || ''"
                  :disabled="!canEdit"
                  placeholder="Ex.: resolveu ou abrir_atendimento"
                  @input="setOutcome('student', $event.target.value)"
                />
              </label>
            </div>

            <div v-else-if="activeTab === 'public'" class="faq-form-stack">
              <label class="faq-public-toggle">
                <input
                  type="checkbox"
                  :checked="publicContentIsCustom"
                  :disabled="!canEdit"
                  @change="togglePublicCustomization($event.target.checked)"
                />
                Personalizar texto para o público externo
              </label>
              <p v-if="!publicContentIsCustom" class="faq-inheritance">
                O público externo vê a mesma orientação definida na aba Orientação.
              </p>
              <template v-else>
                <p>
                  Escreva uma orientação específica para quem acessa pelo atendimento público.
                </p>
                <ol class="faq-blocks" aria-label="Blocos da orientação pública">
                  <li
                    v-for="(block, index) in contentBlocks('public')"
                    :key="block.block_id"
                    class="crm-card-muted faq-block"
                  >
                    <div class="faq-block__header">
                      <label v-if="block.type !== 'button'" class="crm-field-label">
                        Tipo do bloco
                        <select v-model="block.type" class="crm-field" :disabled="!canEdit">
                          <option value="text">Texto</option>
                          <option value="image">Imagem</option>
                          <option value="link">Link</option>
                          <option value="video">Vídeo</option>
                          <option value="notice">Aviso</option>
                          <option value="button">Botão controlado</option>
                          <option value="file">Arquivo institucional</option>
                          <option value="animation">Animação acessível</option>
                        </select>
                      </label>
                      <div class="faq-block__actions">
                        <button type="button" class="crm-button-secondary" :disabled="!canEdit || index === 0" @click="moveContentBlock('public', index, -1)">Subir</button>
                        <button type="button" class="crm-button-secondary" :disabled="!canEdit || index === contentBlocks('public').length - 1" @click="moveContentBlock('public', index, 1)">Descer</button>
                        <button type="button" class="crm-button-secondary" :disabled="!canEdit" @click="removeContentBlock('public', index)">Excluir</button>
                      </div>
                    </div>
                    <label v-if="['text', 'notice'].includes(block.type)" class="crm-field-label">
                      Conteúdo
                      <textarea v-model="block.body" class="crm-field faq-textarea" :disabled="!canEdit" />
                    </label>
                    <template v-else>
                      <label class="crm-field-label">
                        Endereço HTTPS
                        <input v-model="block.url" type="url" class="crm-field" :disabled="!canEdit" />
                      </label>
                      <label v-if="['link', 'file'].includes(block.type)" class="crm-field-label">
                        Texto exibido
                        <input v-model="block.body" class="crm-field" :disabled="!canEdit" />
                      </label>
                    </template>
                  </li>
                </ol>
                <button type="button" class="crm-button-secondary" :disabled="!canEdit" @click="addContentBlock('public')">
                  Adicionar bloco
                </button>
                <label v-if="selectedNode.node_kind === 'final'" class="crm-field-label">
                  Resultado esperado
                  <input
                    class="crm-field"
                    :value="selectedNode.content?.public?.outcome_key || ''"
                    :disabled="!canEdit"
                    placeholder="Ex.: resolveu ou abrir_atendimento"
                    @input="setOutcome('public', $event.target.value)"
                  />
                </label>
              </template>
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
              <fieldset class="crm-card-muted faq-form-stack">
                <legend>Dados pedidos ao abrir atendimento</legend>
                <p>Nome, e-mail e celular são sempre pedidos. Marque somente o que esta resposta exige.</p>
                <label>
                  <input v-model="selectedNode.intake_policy.requires_cpf" type="checkbox" :disabled="!canEdit" />
                  Solicitar CPF
                </label>
                <label v-if="selectedNode.intake_policy.requires_cpf" class="crm-field-label">
                  Finalidade objetiva do CPF
                  <textarea
                    v-model="selectedNode.intake_policy.cpf_purpose"
                    class="crm-field faq-textarea"
                    :disabled="!canEdit"
                    placeholder="Explique por que este fluxo precisa confirmar o CPF."
                  />
                </label>
                <label>
                  <input v-model="selectedNode.intake_policy.requires_ra" type="checkbox" :disabled="!canEdit" />
                  Solicitar RA
                </label>
                <label>
                  <input v-model="selectedNode.intake_policy.requires_course" type="checkbox" :disabled="!canEdit" />
                  Solicitar curso
                </label>
                <label>
                  <input v-model="selectedNode.intake_policy.requires_polo" type="checkbox" :disabled="!canEdit" />
                  Solicitar polo
                </label>
              </fieldset>
            </div>
          </template>
        </section>
      </div>

      <section class="crm-panel faq-action-bar" aria-label="Ações do editor">
        <div class="faq-action-bar__status">
          <p v-if="dirty && canEdit" role="status">Alterações não salvas</p>
          <p v-if="!blockers.length" class="faq-ok" role="status">Nenhum bloqueio encontrado.</p>
          <p v-else role="status">
            {{ draftIssues.filter((issue) => issue.severity === 'error').length }}
            pendência(s) de validação
          </p>
          <div class="faq-action-bar__status-actions">
            <button
              v-if="draftIssues.length"
              type="button"
              class="crm-button-secondary"
              @click="issuesPanelOpen = true"
            >
              Ver pendências
            </button>
          </div>
        </div>
        <div class="faq-action-bar__buttons">
          <button
            v-if="canPublishDraft"
            type="button"
            class="crm-button-primary"
            :disabled="saving"
            @click="publishDraftDirect"
          >
            Publicar
          </button>
          <button
            v-if="canSubmitReview && isAdmin"
            type="button"
            class="crm-button-secondary"
            :disabled="saving"
            @click="openSubmitDialog('review')"
          >
            Enviar para revisão
          </button>
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
            v-if="canSubmitReview && !isAdmin"
            type="button"
            class="crm-button-primary"
            :disabled="saving"
            @click="openSubmitDialog('approval')"
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
        </div>
      </section>

      <FaqV3JourneySimulator
        :open="simulatorOpen"
        :payload="payload"
        @close="simulatorOpen = false"
      />

      <FaqV3FlowSettingsPanel
        :open="settingsOpen"
        :can-edit="canEdit"
        :payload="payload"
        :channel-flags="channelFlags"
        :validity="validity"
        :themes="catalogs.themes"
        :owner-email="bundle?.owner_email || ''"
        @close="settingsOpen = false"
        @sync-channels="syncChannelSettings"
      />

      <FaqV3SubmitReviewDialog
        :open="submitDialogOpen"
        :intent="submitDialogIntent"
        :blockers="blockers"
        :change-summary="changeSummary"
        :saving="saving"
        @close="submitDialogOpen = false"
        @confirm="confirmSubmitDialog"
        @update:change-summary="changeSummary = $event"
      />

      <FaqV3PlaybookPreviewDialog
        :open="playbookPreviewOpen"
        :stage-title="selectedNode?.display?.title || ''"
        :layers="playbookPreviewLayers"
        @close="playbookPreviewOpen = false"
      />

      <FaqV3VersionHistoryDialog
        :open="historyOpen"
        :versions="versions"
        :lifecycle-labels="lifecycleLabels"
        @close="historyOpen = false"
      />

      <div
        v-if="issuesPanelOpen"
        class="faq-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issues-panel-title"
        @click.self="issuesPanelOpen = false"
      >
        <section class="crm-panel faq-confirm-dialog faq-issues-dialog">
          <div class="faq-playbook-preview__header">
            <h2 id="issues-panel-title">Pendências de validação</h2>
            <button type="button" class="crm-button-secondary" @click="issuesPanelOpen = false">
              Fechar
            </button>
          </div>
          <p v-if="!draftIssues.length" class="faq-ok" role="status">Nenhum bloqueio encontrado.</p>
          <ul v-else class="faq-issues-dialog__list">
            <li v-for="issue in draftIssues" :key="issue.id">
              <button
                type="button"
                class="faq-issues-dialog__item"
                :disabled="!issue.nodeId"
                @click="navigateToIssue(issue)"
              >
                {{ issue.message }}
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <div
      v-if="publishConfirmOpen"
      class="faq-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-confirm-title"
    >
      <section class="crm-panel faq-confirm-dialog">
        <h2 id="publish-confirm-title">Confirmar publicação</h2>
        <ul class="faq-confirm-dialog__details">
          <li><strong>Canais:</strong> {{ channelLabelText }}</li>
          <li>
            <strong>Vigência:</strong>
            {{ validity.valid_from ? formatDate(validity.valid_from) : 'Imediata' }}
            até
            {{ validity.valid_until ? formatDate(validity.valid_until) : 'sem fim definido' }}
          </li>
          <li v-if="payload"><strong>Respostas finais:</strong> {{ finalNodeCount }}</li>
        </ul>
        <div class="faq-confirm-dialog__actions">
          <button type="button" class="crm-button-secondary" @click="publishConfirmOpen = false">
            Cancelar
          </button>
          <button
            type="button"
            class="crm-button-primary"
            :disabled="saving"
            @click="confirmPublish"
          >
            Confirmar publicação
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.faq-editor-v3 {
  display: grid;
  gap: var(--space-4);
  padding-bottom: calc(var(--faq-action-bar-height, 5.5rem) + var(--space-4));
}

.faq-editor-v3__header {
  display: grid;
  gap: var(--space-3);
}

.faq-editor-v3__header-main,
.faq-editor-v3__header-toolbar,
.faq-editor-v3__header-status {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.faq-editor-v3__header-toolbar {
  justify-content: flex-start;
}

.faq-editor-v3__dirty {
  color: var(--color-warning, var(--color-text-muted));
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.faq-menu {
  position: relative;
}

.faq-menu__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 35;
  display: grid;
  gap: var(--space-1);
  min-width: 12rem;
  padding: var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md, 0 0.5rem 1rem rgba(0, 0, 0, 0.12));
}

.faq-menu__item {
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  text-align: start;
}

.faq-menu__item:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.faq-menu__item--danger {
  color: var(--color-danger);
}

.faq-editor-v3__header,
.faq-editor-v3__header-actions,
.faq-editor-v3__meta,
.faq-node-editor__title,
.faq-governance-strip,
.faq-action-bar,
.faq-action-bar__buttons,
.faq-tree__actions,
.faq-playbook-preview__header,
.faq-confirm-dialog__actions,
.faq-settings__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: end;
  justify-content: space-between;
}

.faq-editor-v3__meta {
  margin-top: var(--space-2);
  align-items: start;
}

.faq-editor-v3__meta div {
  display: grid;
  gap: var(--space-1);
}

.faq-editor-v3__meta dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
}

.faq-editor-v3__meta dd {
  margin: 0;
  font-weight: 600;
}

.faq-view-toggle {
  display: inline-flex;
  gap: var(--space-1);
  margin-block: var(--space-3);
  padding: var(--space-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.faq-view-toggle__button {
  min-height: 2.5rem;
  padding-inline: var(--space-3);
  border-radius: var(--radius-sm);
}

.faq-view-toggle__button.is-active {
  background: var(--color-surface);
  color: var(--color-primary-dark);
  font-weight: 700;
}

.faq-settings,
.faq-playbook-preview,
.faq-confirm-dialog {
  padding: var(--space-4);
}

.faq-settings__channels {
  display: grid;
  gap: var(--space-2);
  border: 0;
  padding: 0;
}

.faq-settings__channels label,
.faq-public-toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.faq-playbook-preview__context {
  color: var(--color-text-muted);
}

.faq-playbook-preview article {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
}

.faq-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: color-mix(in srgb, var(--color-text) 35%, transparent);
}

.faq-confirm-dialog {
  width: min(100%, 32rem);
}

.faq-confirm-dialog__details {
  display: grid;
  gap: var(--space-2);
  margin-block: var(--space-3);
  padding-left: var(--space-4);
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
  grid-template-columns: minmax(14rem, 0.85fr) minmax(24rem, 1.75fr);
}

.faq-tree,
.faq-node-editor,
.faq-settings {
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

.faq-blocks,
.faq-block {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.faq-block__header,
.faq-block__actions {
  display: flex;
  gap: var(--space-2);
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
}

.faq-textarea {
  min-height: 8rem;
}

.faq-inheritance {
  border-left: 4px solid var(--color-primary);
  background: var(--color-surface-muted);
  padding: var(--space-3);
}

.faq-validation h2,
.faq-history h2,
.faq-playbook-preview h2 {
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

.faq-action-bar {
  position: sticky;
  bottom: 0;
  z-index: 30;
  margin-top: auto;
  border-top: 1px solid var(--border-default);
  background: var(--color-surface);
  box-shadow: 0 -0.25rem 1rem color-mix(in srgb, var(--color-text) 8%, transparent);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
}

.faq-action-bar__status {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  flex: 1 1 16rem;
}

.faq-action-bar__status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.faq-issues-dialog {
  width: min(100%, 36rem);
  max-height: min(100%, 80vh);
  overflow: auto;
}

.faq-issues-dialog__list {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.faq-issues-dialog__item {
  width: 100%;
  text-align: start;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
}

.faq-issues-dialog__item:not(:disabled):hover {
  background: var(--color-surface-muted);
}

.faq-issues-dialog__item:disabled {
  color: var(--color-text);
  cursor: default;
}

.faq-action-bar > div:first-child {
  flex: 1 1 28rem;
}

@media (max-width: 54rem) {
  .faq-editor-v3__workspace {
    grid-template-columns: 1fr;
  }
}
</style>
