<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import FaqV3FlowSettingsPanel from '@/components/admin/faq-v3/FaqV3FlowSettingsPanel.vue'
import FaqV3JourneySimulator from '@/components/admin/faq-v3/FaqV3JourneySimulator.vue'
import FaqV3MapWorkspace from '@/components/admin/faq-v3/FaqV3MapWorkspace.vue'
import FaqV3NodeEditorPanel from '@/components/admin/faq-v3/FaqV3NodeEditorPanel.vue'
import { FAQ_V3_NODE_EDITOR_KEY } from '@/components/admin/faq-v3/faqV3NodeEditorContext'
import FaqV3PlaybookPreviewDialog from '@/components/admin/faq-v3/FaqV3PlaybookPreviewDialog.vue'
import FaqV3SubmitReviewDialog from '@/components/admin/faq-v3/FaqV3SubmitReviewDialog.vue'
import FaqV3VersionHistoryDialog from '@/components/admin/faq-v3/FaqV3VersionHistoryDialog.vue'
import { useDialogA11y } from '@/composables/useDialogA11y'
import {
  approveKnowledgeV3Bundle,
  forkKnowledgeV3Draft,
  getKnowledgeV3Bundle,
  getKnowledgeV3Catalogs,
  getRuntimeFlags,
  getRuntimeSettings,
  getAdminCatalogs,
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
import { buildKnowledgeEditorPermissions } from '@/services/knowledgePermissionsRuntime'
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
const editorViewMode = ref('steps')
const mapDrawerOpen = ref(false)
const mapWorkspaceRef = ref(null)
const moreActionsOpen = ref(false)
const moreActionsTrigger = ref(null)
const moreActionsPanel = ref(null)
const issuesPanelRef = ref(null)
const publishConfirmPanelRef = ref(null)

const BLOCK_TYPE_LABELS = {
  text: 'Texto',
  notice: 'Aviso',
  link: 'Link',
  image: 'Imagem',
  video: 'Vídeo',
  button: 'Botão controlado',
  file: 'Arquivo institucional',
  animation: 'Animação acessível',
}
const validity = reactive({ valid_from: '', valid_until: '' })
const channelFlags = reactive({ availableStudent: true, availablePublic: false })
const catalogs = reactive({ themes: [], routing_patterns: [] })
const runtimeParameters = reactive({ criticalityLevels: [], slaLevels: [] })
const adminAreas = ref([])

const ROUTING_KEY_LABELS = {
  'atendimento-geral': 'Atendimento geral',
  sra: 'Secretaria de Registro Acadêmico',
}

const ROUTING_CHAIN_PRESETS = [
  { value: '', label: 'Usar caminho do fluxo', chain: null },
  { value: 'op_bpo_area', label: 'OP → BPO → Área', chain: ['op', 'bpo', 'area'] },
  { value: 'op_area', label: 'OP → Área', chain: ['op', 'area'] },
  { value: 'op_bpo', label: 'OP → BPO', chain: ['op', 'bpo'] },
  { value: 'area', label: 'Direto para a área', chain: ['area'] },
  { value: 'triage', label: 'Direto para triagem/gestor', chain: ['triage'] },
]

const tabs = [
  { key: 'student', label: 'Orientação' },
  { key: 'public', label: 'Público externo' },
  { key: 'op', label: 'OP' },
  { key: 'bpo', label: 'BPO' },
  { key: 'analyst', label: 'Analista' },
  { key: 'routing', label: 'Encaminhamento e prazo' },
  { key: 'document', label: 'Documentos e dados' },
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
const bundleOperationalDefaults = computed(() => ({
  criticidade:
    payload.value?.metadata?.criticidade_default_key ||
    payload.value?.metadata?.default_criticidade ||
    null,
  sla_policy_key:
    payload.value?.metadata?.sla_policy_key ||
    payload.value?.routing_policy?.sla_policy_key ||
    null,
}))
const approvedVersion = computed(() =>
  versions.value.find((version) => version.lifecycle_state === 'approved'),
)
const knowledgePermissions = computed(() =>
  buildKnowledgeEditorPermissions({
    allowedActions: auth.mockContext.allowedActions || [],
    lifecycleState: currentState.value,
    hasDraft: Boolean(draft.value),
    hasApprovedVersion: Boolean(approvedVersion.value),
    isAdminCentral: auth.mockContext.profileKey === 'admin_central',
    blockersCount: blockers.value.length,
  }),
)
const isAdmin = computed(() => auth.mockContext.profileKey === 'admin_central')
const canEdit = computed(() => knowledgePermissions.value.canEditDraft)
const canApprove = computed(() => knowledgePermissions.value.canApprove)
const canPublishDraft = computed(() => knowledgePermissions.value.canPublish)
const canPublishApproved = computed(() => knowledgePermissions.value.canPublishApproved)
const canSubmitReview = computed(
  () => canEdit.value && knowledgePermissions.value.canSubmitReview,
)
const nextStepLabel = computed(() => {
  if (dirty.value && canEdit.value) {
    return 'Salve o rascunho para registrar as alterações.'
  }
  if (blockers.value.length) {
    return 'Corrija as pendências de validação antes de enviar ou publicar.'
  }
  if (canPublishDraft.value) {
    return 'Revise o conteúdo e publique quando estiver pronto.'
  }
  if (canSubmitReview.value && isAdmin.value) {
    return 'Revise o conteúdo ou envie o rascunho para revisão.'
  }
  if (canSubmitReview.value) {
    return 'Conclua o rascunho e envie o conteúdo para aprovação.'
  }
  if (canApprove.value) {
    return 'Revise o conteúdo e aprove ou solicite ajustes.'
  }
  if (canPublishApproved.value) {
    return 'Publique a versão aprovada.'
  }
  return 'Nenhuma ação disponível para seu perfil neste fluxo.'
})
const isAreaEditor = computed(() =>
  ['analista_area', 'gestor_area'].includes(auth.mockContext.profileKey),
)
const channelLabelText = computed(() => availableChannelLabels(channelFlags).join(' · ') || '—')
const visibleTabs = computed(() =>
  tabs.filter((tab) => tab.key !== 'public' || channelFlags.availablePublic),
)
const editorTabs = computed(() => visibleTabs.value)
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
  loadEditor()
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleMenuKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleMenuKeydown)
})

useDialogA11y(issuesPanelOpen, issuesPanelRef, () => {
  issuesPanelOpen.value = false
})

useDialogA11y(publishConfirmOpen, publishConfirmPanelRef, () => {
  publishConfirmOpen.value = false
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
    const [bundleResponse, versionsResponse, catalogsResponse, runtimeResponse, adminCatalogsResponse] =
      await Promise.all([
      getKnowledgeV3Bundle(bundleKey.value),
      listKnowledgeV3Versions(bundleKey.value, { page_size: 100 }),
      getKnowledgeV3Catalogs(),
      getRuntimeSettings().catch(() => ({ data: {} })),
      getAdminCatalogs().catch(() => ({ data: {} })),
    ])
    bundle.value = bundleResponse.data
    versions.value = versionsResponse.data || []
    Object.assign(catalogs, catalogsResponse.data || {})
    const parameters = runtimeResponse.data?.parameters || {}
    runtimeParameters.criticalityLevels = Array.isArray(parameters.criticalityLevels)
      ? parameters.criticalityLevels
      : []
    runtimeParameters.slaLevels = Array.isArray(parameters.slaLevels) ? parameters.slaLevels : []
    adminAreas.value = (adminCatalogsResponse.data?.areas || []).map((area) => ({
      value: String(area.value || area.key || '').trim(),
      label: String(area.label || area.value || area.key || '').trim(),
    })).filter((area) => area.value)
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
    if (blockers.value.length) {
      errorMessage.value = blockers.value[0]
      return
    }
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
      area_key: null,
      routing_chain: null,
      assignee_email: null,
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
    node.operational ||= {
      routing_override: null,
      criticidade: null,
      sla_policy_key: null,
      area_key: null,
      routing_chain: null,
      assignee_email: null,
    }
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

function addContentBlock(layer, type = 'text', actionKey = null) {
  const block = {
    block_id: `${selectedNode.value.node_id}-${layer}-${type}-${Date.now().toString(36)}`,
    type,
    body: '',
    url: '',
    alt: '',
    captions_url: '',
  }
  if (type === 'button') block.action_key = actionKey || 'open_ticket'
  contentBlocks(layer).push(block)
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
  const theme = (catalogs.themes || []).find(
    (item) => item.theme_key === payload.value.theme_key,
  )
  if (canSubmitReview.value && !String(theme?.approver_group || '').trim()) {
    issues.push({
      id: 'approver-group-missing',
      severity: 'error',
      message: 'Configure o grupo aprovador do tema antes de enviar para revisão.',
      nodeId: null,
      layer: null,
      fieldKey: 'approver_group',
    })
  }
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
    for (const layer of ['student', 'public']) {
      for (const block of (node.content?.[layer]?.blocks || [])) {
        const url = String(block?.url || '').trim()
        if (url.startsWith('http://')) {
          issues.push({
            id: `http-url:${node.node_id}:${block.block_id || layer}`,
            severity: 'error',
            message: `Use HTTPS no endereço da mídia em “${node.display?.title}”.`,
            nodeId: node.node_id,
            layer,
            fieldKey: 'media_url',
          })
        }
      }
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
      if (!resolveFinalArea(node)) {
        issues.push({
          id: `area:${node.node_id}`,
          severity: 'error',
          message: `Defina a área responsável em “${node.display?.title}”.`,
          nodeId: node.node_id,
          layer: 'routing',
          fieldKey: 'area_key',
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
  if (block?.type === 'button') return Boolean(block.body?.trim() && block.action_key)
  return Boolean(block?.url?.trim() || block?.asset_id)
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

function ensureMetadataField(field, value) {
  if (!payload.value) return
  if (!payload.value.metadata || typeof payload.value.metadata !== 'object') {
    payload.value.metadata = {}
  }
  payload.value.metadata[field] = value || null
}

function navigateToIssue(issue) {
  if (issue?.nodeId) selectedNodeId.value = issue.nodeId
  if (issue?.layer) {
    activeTab.value = issue.layer
  } else if (issue?.fieldKey === 'channels') {
    settingsOpen.value = true
  }
  issuesPanelOpen.value = false
  if (issue?.fieldKey) {
    nextTick(() => focusIssueField(issue.fieldKey))
  }
}

function focusIssueField(fieldKey) {
  const idMap = {
    title: 'faq-field-title',
    final_answer: 'faq-field-final-answer',
    op_objective: 'faq-field-op-objective',
    cpf_purpose: 'faq-field-cpf-purpose',
    document_mode: 'faq-field-document-mode',
    channels: 'faq-field-channel-student',
    area_key: 'faq-field-area-key',
    pattern_key: 'faq-field-pattern-key',
  }
  const element = document.getElementById(idMap[fieldKey])
  element?.focus()
}

function stageIssueCount(nodeId) {
  return draftIssues.value.filter(
    (issue) => issue.nodeId === nodeId && issue.severity === 'error',
  ).length
}

function layerHasContent(node, layer) {
  if (!node) return false
  if (layer === 'op' || layer === 'bpo' || layer === 'analyst') {
    const playbook =
      layer === 'bpo' && !node.playbooks?.bpo ? node.playbooks?.op : node.playbooks?.[layer]
    return Boolean(
      playbook?.objective?.trim() ||
        playbook?.suggested_reply?.trim() ||
        (playbook?.checklist || []).length,
    )
  }
  if (layer === 'routing') {
    if (node.node_kind !== 'final') {
      return Boolean(node.operational?.routing_override)
    }
    return Boolean(
      node.operational?.routing_override ||
        node.operational?.criticidade ||
        node.operational?.sla_policy_key ||
        node.operational?.area_key ||
        (node.operational?.routing_chain || []).length ||
        node.operational?.assignee_email,
    )
  }
  if (layer === 'document') {
    return Boolean(
      (node.document_policy?.mode && node.document_policy.mode !== 'disabled') ||
        node.intake_policy?.requires_cpf ||
        node.intake_policy?.requires_ra ||
        node.intake_policy?.requires_course ||
        node.intake_policy?.requires_polo,
    )
  }
  const content = resolveNodeContent(node, layer)
  return Boolean(content?.blocks?.some(blockHasContent))
}

function resolveFinalArea(node) {
  const area = String(node?.operational?.area_key || '').trim()
  if (area) return area
  const owner = payload.value?.metadata?.operational_owner
  if (owner?.owner_type === 'area') {
    return String(owner.owner_key || '').trim()
  }
  return ''
}

function effectiveOperationalValue(node, field) {
  const nodeValue = node?.operational?.[field]
  if (nodeValue) return nodeValue
  return bundleOperationalDefaults.value[field] || null
}

function operationalInheritanceLabel(node, field, options = []) {
  const effective = effectiveOperationalValue(node, field)
  if (node?.operational?.[field]) {
    const match = options.find((item) => item.key === effective)
    return match?.label || effective
  }
  if (effective) {
    const match = options.find((item) => item.key === effective)
    return `Usar padrão do assunto (${match?.label || effective})`
  }
  return 'Sem padrão definido — configure em Configurações do assunto'
}

function routingKeyLabel(key) {
  const normalized = String(key || '').trim()
  if (!normalized) return 'Regra automática do fluxo'
  return ROUTING_KEY_LABELS[normalized] || normalized
}

function tabButtonId(tabKey) {
  return `faq-tab-${tabKey}`
}

function tabPanelId(tabKey) {
  return `faq-tabpanel-${tabKey}`
}

function firstTabIssue(tabKey) {
  const node = selectedNode.value
  if (!node) return null
  return draftIssues.value.find((issue) => issue.nodeId === node.node_id && issue.layer === tabKey) || null
}

function routingChainPresetValue(chain) {
  if (!Array.isArray(chain) || !chain.length) return ''
  const serialized = JSON.stringify(chain)
  const preset = ROUTING_CHAIN_PRESETS.find(
    (item) => item.chain && JSON.stringify(item.chain) === serialized,
  )
  return preset?.value || 'custom'
}

function setRoutingChainPreset(presetValue) {
  if (!selectedNode.value?.operational) return
  const preset = ROUTING_CHAIN_PRESETS.find((item) => item.value === presetValue)
  selectedNode.value.operational.routing_chain = preset?.chain ? [...preset.chain] : null
}

function tabStateLabel(tabKey) {
  const node = selectedNode.value
  if (!node) return ''
  const issue = firstTabIssue(tabKey)
  if (issue) {
    const short =
      issue.fieldKey === 'area_key'
        ? 'área'
        : issue.fieldKey === 'op_objective'
          ? 'objetivo OP'
          : issue.fieldKey === 'cpf_purpose'
            ? 'finalidade CPF'
            : issue.layer || 'campo'
    return `Pendente: ${short}`
  }
  if (layerHasContent(node, tabKey)) return 'Pronto'
  if (tabKey === 'document') return 'Opcional'
  if (['op', 'bpo', 'analyst', 'routing'].includes(tabKey)) return 'Opcional'
  return resolveNodeContent(node, tabKey)?.blocks?.length ? 'Pronto' : 'Opcional'
}

function readBlockCount(node, layer) {
  return resolveNodeContent(node, layer)?.blocks?.length || 0
}

function focusFirstMenuItem(panelRef) {
  nextTick(() => {
    const first = panelRef.value?.querySelector('[role="menuitem"]:not([disabled])')
    first?.focus()
  })
}

function closeMoreActions(restoreFocus = true) {
  if (!moreActionsOpen.value) return
  moreActionsOpen.value = false
  if (restoreFocus) nextTick(() => moreActionsTrigger.value?.focus())
}

function toggleMoreActions() {
  if (moreActionsOpen.value) {
    closeMoreActions()
    return
  }
  moreActionsOpen.value = true
  focusFirstMenuItem(moreActionsPanel)
}

function handleDocumentPointerDown(event) {
  const target = event.target
  if (moreActionsOpen.value) {
    const insideMenu =
      moreActionsTrigger.value?.contains(target) || moreActionsPanel.value?.contains(target)
    if (!insideMenu) closeMoreActions(false)
  }
}

function handleMenuKeydown(event) {
  if (event.key !== 'Escape') return
  if (moreActionsOpen.value) {
    event.preventDefault()
    closeMoreActions()
  }
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

function setEditorViewMode(mode) {
  editorViewMode.value = mode
  if (mode === 'steps') {
    mapDrawerOpen.value = false
    return
  }
  nextTick(() => mapWorkspaceRef.value?.centerSelected())
}

function handleMapSelectNode(nodeId) {
  selectedNodeId.value = nodeId
  mapDrawerOpen.value = true
}

function handleMapAddNode(kind, parentNodeId) {
  if (parentNodeId) selectedNodeId.value = parentNodeId
  addNode(kind)
}

function handleMapRemoveNode(nodeId) {
  selectedNodeId.value = nodeId
  removeSelectedNode()
  if (!payload.value?.nodes?.some((node) => node.node_id === selectedNodeId.value)) {
    mapDrawerOpen.value = false
  }
}

watch(editorViewMode, (mode) => {
  if (mode === 'map') {
    nextTick(() => mapWorkspaceRef.value?.centerSelected())
  }
})

provide(FAQ_V3_NODE_EDITOR_KEY, {
  selectedNode,
  canEdit,
  activeTab,
  editorTabs,
  publicContentIsCustom,
  payload,
  catalogs,
  runtimeParameters,
  adminAreas,
  bundleOperationalDefaults,
  selectedPattern,
  allowedRoutingKeys,
  ROUTING_CHAIN_PRESETS,
  mediaUploadEnabled,
  assetBusy,
  BLOCK_TYPE_LABELS,
  contentBlocks,
  addContentBlock,
  removeContentBlock,
  moveContentBlock,
  setOutcome,
  togglePublicCustomization,
  ensurePlaybook,
  useOpPlaybook,
  effectivePlaybook,
  updatePlaybookField,
  updatePlaybookList,
  playbookList,
  uploadBlockAsset,
  tabStateLabel,
  readBlockCount,
  isRoot,
  removeSelectedNode,
  effectiveOperationalValue,
  operationalInheritanceLabel,
  routingChainPresetValue,
  setRoutingChainPreset,
  resolveFinalArea,
  routingKeyLabel,
  tabButtonId,
  tabPanelId,
})
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
        <div class="faq-view-mode-toggle" role="group" aria-label="Modo de visualização">
          <button
            type="button"
            class="crm-button-secondary faq-view-mode-toggle__button"
            :class="{ 'is-active': editorViewMode === 'steps' }"
            :aria-pressed="editorViewMode === 'steps'"
            @click="setEditorViewMode('steps')"
          >
            Etapas
          </button>
          <button
            type="button"
            class="crm-button-secondary faq-view-mode-toggle__button"
            :class="{ 'is-active': editorViewMode === 'map' }"
            :aria-pressed="editorViewMode === 'map'"
            @click="setEditorViewMode('map')"
          >
            Mapa
          </button>
        </div>
        <button type="button" class="crm-button-secondary" @click="simulatorOpen = true">
          Simular jornada
        </button>
        <button type="button" class="crm-button-secondary" @click="settingsOpen = true">
          Configurações do assunto
        </button>
        <div class="faq-menu">
          <button
            ref="moreActionsTrigger"
            type="button"
            class="crm-button-secondary"
            aria-haspopup="menu"
            :aria-expanded="moreActionsOpen"
            @click="toggleMoreActions"
          >
            Mais ações
          </button>
          <div v-if="moreActionsOpen" ref="moreActionsPanel" class="faq-menu__panel" role="menu">
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

      <div v-if="editorViewMode === 'steps'" class="faq-editor-v3__workspace">
        <aside class="crm-panel faq-tree" aria-labelledby="flow-tree-title">
          <div class="crm-panel-header__copy">
            <h2 id="flow-tree-title">Etapas do fluxo</h2>
            <p>Escolha a etapa que deseja editar.</p>
          </div>
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
                <small
                  v-if="stageIssueCount(node.node_id)"
                  class="faq-tree__issue-count"
                  aria-hidden="true"
                >
                  {{ stageIssueCount(node.node_id) }} alerta(s)
                </small>
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
            <button
              type="button"
              class="crm-button-secondary faq-tree__danger"
              :disabled="!canEdit || !selectedNode || isRoot(selectedNode.node_id) || childEdges(selectedNode.node_id).length"
              @click="removeSelectedNode()"
            >
              Excluir etapa
            </button>
          </div>
        </aside>

        <section class="crm-panel faq-node-editor" aria-labelledby="node-editor-heading">
          <h2 id="node-editor-heading" class="faq-sr-only">Editor da etapa selecionada</h2>
          <FaqV3NodeEditorPanel />
        </section>
      </div>

      <FaqV3MapWorkspace
        v-else
        ref="mapWorkspaceRef"
        :payload="payload"
        :selected-node-id="selectedNodeId"
        :node-issues="nodeIssues"
        :can-edit="canEdit"
        :drawer-open="mapDrawerOpen"
        :selected-node="selectedNode"
        :is-root-node="isRoot"
        @select-node="handleMapSelectNode"
        @close-drawer="mapDrawerOpen = false"
        @add-node="handleMapAddNode"
        @remove-node="handleMapRemoveNode"
      />

      <section class="crm-panel faq-action-bar" aria-label="Ações do editor">
        <div class="faq-action-bar__status">
          <p class="faq-action-bar__next-step">
            <strong>Próximo passo:</strong> {{ nextStepLabel }}
          </p>
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
        :theme-key="payload.theme_key"
        :pattern-key="payload.routing_policy?.pattern_key || ''"
        :routing-patterns="catalogs.routing_patterns"
        :selected-pattern="selectedPattern"
        :criticidade-default-key="payload.metadata?.criticidade_default_key || ''"
        :sla-policy-key="payload.metadata?.sla_policy_key || ''"
        :criticality-levels="runtimeParameters.criticalityLevels"
        :sla-levels="runtimeParameters.slaLevels"
        :available-student="channelFlags.availableStudent"
        :available-public="channelFlags.availablePublic"
        :valid-from="validity.valid_from"
        :valid-until="validity.valid_until"
        :themes="catalogs.themes"
        :owner-email="bundle?.owner_email || ''"
        @close="settingsOpen = false"
        @sync-channels="syncChannelSettings"
        @update:theme-key="payload.theme_key = $event"
        @update:pattern-key="payload.routing_policy.pattern_key = $event"
        @update:criticidade-default-key="ensureMetadataField('criticidade_default_key', $event)"
        @update:sla-policy-key="ensureMetadataField('sla_policy_key', $event)"
        @update:available-student="channelFlags.availableStudent = $event"
        @update:available-public="channelFlags.availablePublic = $event"
        @update:valid-from="validity.valid_from = $event"
        @update:valid-until="validity.valid_until = $event"
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
        <section ref="issuesPanelRef" class="crm-panel faq-confirm-dialog faq-issues-dialog" tabindex="-1">
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
      <section ref="publishConfirmPanelRef" class="crm-panel faq-confirm-dialog" tabindex="-1">
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

.faq-view-mode-toggle {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.faq-view-mode-toggle__button.is-active {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  font-weight: 700;
}

.faq-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

.faq-tree__issue-count {
  color: var(--color-danger);
  font-weight: 700;
}

.faq-tree__danger {
  color: var(--color-danger);
}

.faq-tabs__button {
  display: grid;
  gap: var(--space-1);
  justify-items: start;
}

.faq-tabs__state {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.faq-tabs__hint {
  margin: calc(var(--space-2) * -1) 0 var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-tabs__button.has-issue .faq-tabs__state {
  color: var(--color-danger);
}

.faq-advanced-toggle {
  margin-block: var(--space-2);
}

.faq-advanced-toggle__meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.faq-empty-tab {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
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
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
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

.faq-action-bar__next-step {
  flex: 1 1 100%;
  margin: 0;
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
