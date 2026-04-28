<script setup>
import {
  computed,
  defineAsyncComponent,
  markRaw,
  onErrorCaptured,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  watchEffect,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  buildFaqBuilderBackendReadiness,
  buildFaqBuilderUpsertPayload,
} from '@/contracts/faqBuilderContract'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  addFaqBuilderChildNode,
  buildAutoLayoutSnapshot,
  buildFaqBuilderDiff,
  buildFaqBuilderGraphSafe,
  buildFaqBuilderPreviewJourneySafe,
  clearFaqBuilderBundleLibraryLocal,
  connectFaqBuilderNodes,
  createFaqBuilderBundleLibrary,
  downloadFaqBuilderTemplateXlsx,
  getFaqBuilderBundleById,
  getFaqBuilderCatalogOptions,
  getFaqBuilderNode,
  loadFaqBuilderBundleLibraryLocal,
  moveFaqBuilderNode,
  publishFaqBuilderWorkspace,
  readFaqBuilderSpreadsheet,
  rebuildFaqBuilderCanvasSnapshot,
  runFaqBuilderBundleSanityCheck,
  saveFaqBuilderDraftWorkspace,
  saveFaqBuilderBundleLibraryLocal,
  setFaqBuilderBundleOperationalOwner,
  setFaqBuilderNodeField,
  setFaqBuilderNodeListField,
  setFaqBuilderNodeOwnership,
  syncCanvasSnapshotEdges,
  touchFaqBuilderWorkspace,
  transitionFaqBuilderWorkflow,
  updateCanvasSnapshotNodePosition,
  validateFaqBuilderBundle,
  resolveFaqBuilderNodeEffectiveOwner,
} from '@/services/faqBuilderHybridRuntime'
import { useAuthStore } from '@/stores/auth'

const EDITOR_MODES = Object.freeze([
  { key: 'visual', label: 'Editor' },
  { key: 'import', label: 'Importacao' },
  { key: 'governance', label: 'Governanca' },
])
const BLOCK_ROUTE_PROMOTION_DURING_MOUNT = true

function decodeBundleParam(value = '') {
  let decoded = ''
  try {
    decoded = decodeURIComponent(String(value || ''))
  } catch {
    decoded = String(value || '')
  }
  return String(decoded || '')
    .split('?')[0]
    .split('#')[0]
    .split('/')[0]
    .trim()
}

function sanitizeBundleId(value = '') {
  return String(value || '')
    .split('?')[0]
    .split('#')[0]
    .split('/')[0]
    .trim()
}

function normalizeMode(rawMode = 'visual') {
  const value = String(rawMode || '').trim().toLowerCase()
  return EDITOR_MODES.some((mode) => mode.key === value) ? value : 'visual'
}

function parseSafeModeQuery(rawValue = '') {
  const normalized = String(rawValue || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return ['1', 'true', 'sim', 'yes', 'y'].includes(normalized)
}

function parseFullscreenQuery(rawValue = '') {
  const normalized = String(rawValue || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return !['0', 'false', 'nao', 'não', 'no', 'n'].includes(normalized)
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const catalogs = getFaqBuilderCatalogOptions()

const VueFlowCanvas = defineAsyncComponent({
  loader: async () => {
    await Promise.all([
      import('@vue-flow/core/dist/style.css'),
      import('@vue-flow/core/dist/theme-default.css'),
    ])
    const module = await import('@vue-flow/core')
    return module.VueFlow
  },
  delay: 120,
  timeout: 20000,
})

const FaqCanvasNodeAsync = markRaw(defineAsyncComponent({
  loader: async () => {
    const module = await import('@/components/admin/faq-builder/FaqCanvasNode.vue')
    return module.default
  },
  delay: 120,
  timeout: 15000,
}))
const vueFlowNodeTypes = markRaw({
  faqBuilderNode: FaqCanvasNodeAsync,
})

const VueFlowBackground = defineAsyncComponent({
  loader: async () => {
    const module = await import('@vue-flow/background')
    return module.Background
  },
  delay: 120,
  timeout: 15000,
})

const VueFlowControls = defineAsyncComponent({
  loader: async () => {
    const module = await import('@vue-flow/controls')
    return module.Controls
  },
  delay: 120,
  timeout: 15000,
})

const ui = reactive({
  mode: normalizeMode(route.query.mode),
  safeMode: parseSafeModeQuery(route.query.safe),
  isFullscreen: parseFullscreenQuery(route.query.fullscreen),
  selectedNodeId: '',
  parentTargetId: '',
  governanceSummary: '',
  showValidationDetails: false,
  showPreviewModal: false,
  showOverflowMenu: false,
})
const BUNDLE_OWNER_EDITABLE_FIELDS = Object.freeze([
  'ownerType',
  'queueKey',
  'areaLabel',
  'roleKey',
])
const bundleOwnerDraft = ref({
  ownerType: 'queue',
  queueKey: '',
  areaLabel: '',
  roleKey: '',
})
const feedback = reactive({
  type: '',
  message: '',
})
const openState = reactive({
  isLoading: false,
  failed: false,
  issueCode: '',
  issueMessage: '',
  markers: [],
})
const sanitizedState = reactive({
  warnings: [],
  errors: [],
})
const importState = reactive({
  fileName: '',
  isLoading: false,
  result: null,
})
const previewState = reactive({
  activeNodeId: '',
})
const responseEditorRef = ref(null)
const overflowMenuRef = ref(null)
let persistLibraryTimer = null
let rebuildArtifactsTimer = null
let hasMountedEditor = false
let isUpdatingBundleOperationalOwner = false

const backendReadiness = buildFaqBuilderBackendReadiness({
  hasServerUpsert: false,
  hasServerDryRun: false,
  hasServerLock: false,
})
const runtimeLoadError = ref('')

function loadLibraryWithFallback(editorName = 'Admin local') {
  try {
    return loadFaqBuilderBundleLibraryLocal(editorName)
  } catch (error) {
    runtimeLoadError.value = String(
      error?.message || 'Falha ao carregar dados locais do builder.',
    )
    console.error('[faq-builder][editor-library-load-failed]', error)
    try {
      clearFaqBuilderBundleLibraryLocal()
    } catch (clearError) {
      console.error('[faq-builder][editor-library-clear-failed]', clearError)
    }
    const seeded = createFaqBuilderBundleLibrary(editorName)
    try {
      saveFaqBuilderBundleLibraryLocal(seeded)
    } catch (saveError) {
      console.error('[faq-builder][editor-library-seed-save-failed]', saveError)
    }
    return seeded
  }
}

const currentEditorName = computed(
  () => auth.displayName || auth.mockContext?.userName || 'Admin local',
)
const library = reactive(
  loadLibraryWithFallback(currentEditorName.value) ||
    createFaqBuilderBundleLibrary(currentEditorName.value),
)
const bundleId = computed(() => decodeBundleParam(route.params.bundleId))
const currentBundleEntry = computed(() =>
  getFaqBuilderBundleById(library, bundleId.value),
)
const workspace = computed(() => currentBundleEntry.value?.workspace || null)
const isMissingBundle = computed(() => !currentBundleEntry.value || !workspace.value)
const workspaceNodes = computed(() =>
  Array.isArray(workspace.value?.draftBundle?.nodes)
    ? workspace.value.draftBundle.nodes.filter(
        (node) => node && typeof node === 'object' && String(node.id || '').trim(),
      )
    : [],
)
const workspaceLinks = computed(() =>
  Array.isArray(workspace.value?.draftBundle?.links)
    ? workspace.value.draftBundle.links.filter(
        (link) =>
          link &&
          typeof link === 'object' &&
          String(link.parent_node_id || '').trim() &&
          String(link.child_node_id || '').trim(),
      )
    : [],
)

function createEmptyValidationState() {
  return {
    issues: [],
    errors: [],
    warnings: [],
    nodeIssueSummary: new Map(),
    ownershipCoverage: {
      bundleDefaultConfigured: false,
      totalFinalNodes: 0,
      effectiveFinalNodes: 0,
      missingFinalNodes: 0,
      invalidOverrides: 0,
    },
    hasBlockingPublishError: false,
    hasBlockingImportError: false,
  }
}

function createEmptyPreviewState() {
  return {
    startId: '',
    nodeById: new Map(),
    outgoingMap: new Map(),
  }
}

const renderState = reactive({
  validation: createEmptyValidationState(),
  flowNodes: [],
  flowEdges: [],
  previewRuntime: createEmptyPreviewState(),
})

const validation = computed(() => renderState.validation)
const flowNodes = computed(() => renderState.flowNodes)
const flowEdges = computed(() => renderState.flowEdges)

const selectedNode = computed(() =>
  workspace.value
    ? getFaqBuilderNode(workspace.value.draftBundle, ui.selectedNodeId)
    : null,
)

const selectedNodeParentLink = computed(() => {
  if (!workspace.value) return null
  return (
    workspaceLinks.value.find(
      (link) =>
        link.ativo !== false && link.child_node_id === ui.selectedNodeId,
    ) || null
  )
})

const selectedNodeMode = computed(() =>
  selectedNode.value?.node_kind === 'leaf' ? 'final' : 'path',
)

const selectedNodeEffectiveOwner = computed(() => {
  if (!workspace.value || !selectedNode.value?.id) {
    return null
  }
  try {
    return resolveFaqBuilderNodeEffectiveOwner(
      workspace.value.draftBundle,
      selectedNode.value.id,
    )
  } catch (error) {
    console.warn(
      '[faq-builder][effective-owner-failed]',
      String(error?.message || 'Falha ao resolver ownership do no selecionado.'),
    )
    return null
  }
})

const parentOptions = computed(() =>
  workspace.value
    ? workspaceNodes.value
        .filter((node) => node.id !== ui.selectedNodeId)
        .map((node) => ({
          value: node.id,
          label: node.titulo_exibido || node.id,
        }))
    : [],
)

const previewRuntime = computed(() => renderState.previewRuntime)

const previewNode = computed(() => {
  const activeId = previewState.activeNodeId || previewRuntime.value.startId
  return previewRuntime.value.nodeById.get(activeId) || null
})

const previewChoices = computed(() => {
  if (!previewNode.value) return []
  return (previewRuntime.value.outgoingMap.get(previewNode.value.id) || [])
    .map((link) => previewRuntime.value.nodeById.get(link.child_node_id))
    .filter((node) => node && typeof node === 'object' && String(node.id || '').trim())
})

const bundleDiff = computed(() =>
  workspace.value
    ? buildFaqBuilderDiff({
        // buildFaqBuilderDiff normalizes with ensureBundleCollections (mutates input).
        // Use snapshots so governance render does not mutate reactive workspace state.
        draftBundle: cloneBundleForOwnershipPatch(workspace.value.draftBundle) || {},
        publishedBundle: cloneBundleForOwnershipPatch(workspace.value.publishedBundle) || {},
      })
    : {
        summary: {
          createdNodes: 0,
          removedNodes: 0,
          updatedNodes: 0,
          createdLinks: 0,
          removedLinks: 0,
        },
      },
)

const upsertPreview = computed(() => {
  if (!workspace.value) return null
  return buildFaqBuilderUpsertPayload({
    bundleContext: {
      bundleId: currentBundleEntry.value.bundleId,
      faqType: currentBundleEntry.value.faqType,
      subjectKey: currentBundleEntry.value.subjectKey,
      title: currentBundleEntry.value.title,
    },
    bundle: workspace.value.draftBundle,
    canvasSnapshot: workspace.value.canvasSnapshot,
    workflowStatus: workspace.value.workflowStatus,
    validation: validation.value,
    publishConfig: workspace.value.publishConfig,
    lockContext: workspace.value.lockContext,
    actorName: currentEditorName.value,
  })
})

const statusToneClass = computed(() => {
  const status = String(workspace.value?.workflowStatus || '').toLowerCase()
  if (status === 'published') return 'text-[var(--color-success)]'
  if (status === 'in review') return 'text-[#8a5200]'
  if (status === 'archived') return 'text-slate-500'
  return 'text-slate-700'
})

const validationSummaryLabel = computed(() => {
  const errorCount = validation.value.errors.length
  const warningCount = validation.value.warnings.length
  if (!errorCount && !warningCount) return 'Sem alertas estruturais'
  return `${errorCount} erro(s) / ${warningCount} alerta(s)`
})

const publishBlocked = computed(() => validation.value.hasBlockingPublishError)

function appendOpenMarker(stage = '', details = '') {
  const marker = {
    at: new Date().toISOString(),
    stage,
    details,
  }
  openState.markers.push(marker)
  if (openState.markers.length > 30) {
    openState.markers.shift()
  }
}

let isPreparingWorkspace = false

function markEntryAsTouched() {
  if (!currentBundleEntry.value || !workspace.value) return
  currentBundleEntry.value.updatedAt =
    workspace.value.lockContext?.lastTouchedAt || new Date().toISOString()
  currentBundleEntry.value.updatedBy =
    workspace.value.lockContext?.editorName || currentEditorName.value
}

function buildSafeFlowNodes(nodes = []) {
  const safeNodes = Array.isArray(nodes) ? nodes : []
  const seenIds = new Set()
  const normalized = []

  for (const node of safeNodes) {
    if (!node || typeof node !== 'object') {
      continue
    }
    const nodeId = String(node.id || '').trim()
    if (!nodeId || seenIds.has(nodeId)) {
      continue
    }
    seenIds.add(nodeId)
    normalized.push({
      ...node,
      id: nodeId,
      type: String(node.type || 'faqBuilderNode').trim() || 'faqBuilderNode',
      position:
        node.position && typeof node.position === 'object'
          ? {
              x: Number(node.position.x || 0),
              y: Number(node.position.y || 0),
            }
          : { x: 0, y: 0 },
    })
  }

  return normalized
}

function buildSafeFlowEdges(edges = [], nodeIds = new Set()) {
  const safeEdges = Array.isArray(edges) ? edges : []
  const seenIds = new Set()
  const normalized = []
  let sequence = 1

  for (const edge of safeEdges) {
    if (!edge || typeof edge !== 'object') {
      continue
    }
    const source = String(edge.source || '').trim()
    const target = String(edge.target || '').trim()
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
      continue
    }

    let edgeId =
      String(edge.id || '').trim() || `${source}->${target}`
    if (seenIds.has(edgeId)) {
      edgeId = `${edgeId}#${sequence}`
    }
    sequence += 1
    seenIds.add(edgeId)

    normalized.push({
      ...edge,
      id: edgeId,
      source,
      target,
    })
  }

  return normalized
}

function rebuildRenderArtifacts({ safeMode = false } = {}) {
  if (!workspace.value) {
    renderState.validation = createEmptyValidationState()
    renderState.flowNodes = []
    renderState.flowEdges = []
    renderState.previewRuntime = createEmptyPreviewState()
    return
  }

  let nextValidation = createEmptyValidationState()
  try {
    nextValidation = validateFaqBuilderBundle(workspace.value.draftBundle, {
      mode: 'edit',
    })
  } catch (error) {
    appendOpenMarker(
      'validation failed',
      String(error?.message || 'Falha ao validar bundle.'),
    )
    nextValidation.errors = [
      {
        severity: 'error',
        code: 'runtime_validation_failed',
        nodeId: '',
        message: String(error?.message || 'Falha ao validar bundle.'),
        blocksImport: false,
        blocksPublish: true,
      },
    ]
    nextValidation.issues = [...nextValidation.errors]
    nextValidation.hasBlockingPublishError = true
  }

  let graphRuntime = {
    graph: { nodes: [], edges: [] },
    sanity: { errors: [], warnings: [] },
    fallbackUsed: true,
  }
  try {
    graphRuntime = buildFaqBuilderGraphSafe(
      workspace.value.draftBundle,
      workspace.value.canvasSnapshot,
      nextValidation,
      { mode: safeMode ? 'safe' : 'default' },
    )
  } catch (error) {
    appendOpenMarker(
      'graph failed',
      String(error?.message || 'Falha ao montar canvas.'),
    )
  }

  let nextPreviewRuntime = createEmptyPreviewState()
  try {
    nextPreviewRuntime = buildFaqBuilderPreviewJourneySafe(
      workspace.value.draftBundle,
      previewState.activeNodeId,
      { mode: safeMode ? 'safe' : 'default' },
    )
  } catch (error) {
    appendOpenMarker(
      'preview failed',
      String(error?.message || 'Falha ao montar preview.'),
    )
  }
  const safeGraphNodes = buildSafeFlowNodes(graphRuntime?.graph?.nodes || [])
  const safeNodeIds = new Set(safeGraphNodes.map((node) => String(node.id || '').trim()))
  const safeGraphEdges = buildSafeFlowEdges(
    graphRuntime?.graph?.edges || [],
    safeNodeIds,
  )

  renderState.validation = nextValidation
  renderState.flowNodes = safeGraphNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onSelect: () => {
        ui.selectedNodeId = node.id
      },
      onQuickAddPath: () => quickAddChild(node.id, 'path'),
      onQuickAddFinal: () => quickAddChild(node.id, 'final'),
    },
  }))
  renderState.flowEdges = safeGraphEdges.map((edge) => ({
    ...edge,
  }))
  renderState.previewRuntime = nextPreviewRuntime
}

function scheduleLibraryPersist() {
  if (persistLibraryTimer) {
    clearTimeout(persistLibraryTimer)
  }
  persistLibraryTimer = setTimeout(() => {
    saveFaqBuilderBundleLibraryLocal(library, { skipNormalize: true })
    persistLibraryTimer = null
  }, 280)
}

function scheduleRebuildArtifacts() {
  if (rebuildArtifactsTimer) {
    clearTimeout(rebuildArtifactsTimer)
  }
  rebuildArtifactsTimer = setTimeout(() => {
    rebuildRenderArtifacts({ safeMode: ui.safeMode })
    rebuildArtifactsTimer = null
  }, 120)
}

function canMutateRouteQueryFlag(key = 'safe', source = 'auto') {
  const normalizedSource = String(source || 'auto').trim().toLowerCase()
  if (normalizedSource === 'user') {
    return true
  }
  const routeValue = route.query?.[key]
  const routeHasExplicitValue =
    routeValue !== undefined && String(routeValue).trim() !== ''
  if (routeHasExplicitValue) {
    return true
  }
  if (BLOCK_ROUTE_PROMOTION_DURING_MOUNT) {
    return false
  }
  return hasMountedEditor
}

function setSafeMode(enabled = true, options = {}) {
  const source = String(options?.source || 'auto')
  ui.safeMode = Boolean(enabled)
  const nextQuery = { ...route.query }
  if (ui.safeMode) {
    nextQuery.safe = '1'
  } else {
    delete nextQuery.safe
  }
  const currentSafe = parseSafeModeQuery(route.query.safe)
  const allowQueryMutation = canMutateRouteQueryFlag('safe', source)
  if (currentSafe !== ui.safeMode && allowQueryMutation) {
    router.replace({
      path: route.path,
      query: nextQuery,
    })
  }
}

function setEditorFullscreen(enabled = true, options = {}) {
  const source = String(options?.source || 'auto')
  const nextValue = Boolean(enabled)
  ui.isFullscreen = nextValue
  const currentValue = parseFullscreenQuery(route.query.fullscreen)
  const allowQueryMutation = canMutateRouteQueryFlag('fullscreen', source)
  if (currentValue === nextValue || !allowQueryMutation) {
    return
  }
  const nextQuery = { ...route.query }
  if (nextValue) {
    nextQuery.fullscreen = '1'
  } else {
    nextQuery.fullscreen = '0'
  }
  router.replace({
    path: route.path,
    query: nextQuery,
  })
}

function prepareWorkspaceForRender({ safeMode = false } = {}) {
  if (isPreparingWorkspace) {
    return
  }

  if (!workspace.value) {
    openState.failed = true
    openState.issueCode = 'bundle_not_found'
    openState.issueMessage = 'Bundle nao encontrado para edicao.'
    return
  }

  isPreparingWorkspace = true
  openState.isLoading = true
  openState.failed = false
  openState.issueCode = ''
  openState.issueMessage = ''
  openState.markers = []

  appendOpenMarker('open bundle started', bundleId.value)
  appendOpenMarker('bundle resolved', currentBundleEntry.value?.title || bundleId.value)

  try {
    appendOpenMarker('bundle payload loaded', `nodes=${workspace.value.draftBundle?.nodes?.length || 0}`)
    const sanity = runFaqBuilderBundleSanityCheck(
      workspace.value.draftBundle,
      workspace.value.canvasSnapshot,
      { mode: safeMode ? 'safe' : 'default' },
    )
    sanitizedState.warnings = sanity.warnings || []
    sanitizedState.errors = sanity.errors || []
    appendOpenMarker('snapshot loaded', `warnings=${sanity.warnings.length}`)

    if (sanity.shouldUseSafeMode && !safeMode) {
      appendOpenMarker('builder failed with reason runtime_limit_requires_safe_mode')
      setSafeMode(true, { source: 'auto' })
      return
    }

    workspace.value.draftBundle = sanity.bundle
    workspace.value.canvasSnapshot = sanity.canvasSnapshot
    markEntryAsTouched()

    appendOpenMarker('validation started')
    rebuildRenderArtifacts({ safeMode })
    appendOpenMarker('validation finished')

    if (renderState.validation.hasBlockingPublishError && safeMode) {
      appendOpenMarker('builder safe mode warning', 'validation_blocking_errors')
    }

    appendOpenMarker('preview started')
    appendOpenMarker('preview finished')
    appendOpenMarker('layout started')
    appendOpenMarker('layout finished')
    appendOpenMarker('fitView started')
    appendOpenMarker('fitView finished')
    appendOpenMarker('builder ready')
  } catch (error) {
    const failureMessage = String(error?.message || 'Falha ao abrir o editor do fluxo.')
    appendOpenMarker('builder failed with reason', failureMessage)

    if (!safeMode) {
      appendOpenMarker('fallback to safe mode', 'retrying in safe mode after runtime failure')
      setSafeMode(true, { source: 'auto' })
      return
    }

    openState.failed = true
    openState.issueCode = 'builder_open_failed'
    openState.issueMessage = failureMessage
  } finally {
    isPreparingWorkspace = false
    openState.isLoading = false
  }
}

onErrorCaptured((error, instance, info) => {
  openState.failed = true
  openState.isLoading = false
  openState.issueCode = 'editor_runtime_error'
  openState.issueMessage = String(
    error?.message || 'Erro inesperado ao montar o editor do fluxo.',
  )
  appendOpenMarker(
    'builder failed with runtime error',
    `${openState.issueMessage} | ${String(info || '')}`.trim(),
  )
  console.error('[faq-builder][editor-runtime-error]', error, info, instance)
  return true
})

function retryOpenBundle() {
  prepareWorkspaceForRender({
    safeMode: ui.safeMode,
  })
}

function recoverIgnoringSnapshot() {
  if (!workspace.value) {
    return
  }
  workspace.value.canvasSnapshot = rebuildFaqBuilderCanvasSnapshot(
    workspace.value.draftBundle,
    {},
  )
  touchWorkspace()
  setFeedback('success', 'Snapshot visual reconstruido para estabilizar o editor.')
  prepareWorkspaceForRender({ safeMode: true })
}

watchEffect(() => {
  if (workspace.value && !ui.selectedNodeId) {
    const firstNodeId = workspaceNodes.value[0]?.id || ''
    if (firstNodeId) {
      ui.selectedNodeId = firstNodeId
    }
  }
})

watch(
  () => route.query.mode,
  (mode) => {
    ui.mode = normalizeMode(mode || 'visual')
  },
)

watch(
  () => route.query.safe,
  (safeQuery) => {
    const nextValue = parseSafeModeQuery(safeQuery)
    if (ui.safeMode === nextValue) {
      return
    }
    ui.safeMode = nextValue
  },
  { immediate: true },
)

watch(
  () => route.query.fullscreen,
  (fullscreenQuery) => {
    const nextValue = parseFullscreenQuery(fullscreenQuery)
    if (ui.isFullscreen === nextValue) {
      return
    }
    ui.isFullscreen = nextValue
  },
  { immediate: true },
)

watch(
  () => [bundleId.value, ui.safeMode],
  () => {
    prepareWorkspaceForRender({
      safeMode: ui.safeMode,
    })
  },
  { immediate: true },
)

watch(
  () => [bundleId.value, workspace.value?.draftBundle],
  () => {
    syncBundleOwnerDraftFromWorkspace({
      source: 'watch bundleId/draftBundle',
    })
  },
  { immediate: true },
)

watch(selectedNode, (node) => {
  ui.parentTargetId = selectedNodeParentLink.value?.parent_node_id || ''
  if (node && responseEditorRef.value) {
    responseEditorRef.value.innerHTML = node.resposta || ''
  }
})

function handleGlobalPointerDown(event) {
  if (!overflowMenuRef.value) return
  if (!overflowMenuRef.value.contains(event.target)) {
    ui.showOverflowMenu = false
  }
}

onMounted(() => {
  hasMountedEditor = true
  document.addEventListener('pointerdown', handleGlobalPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleGlobalPointerDown)
  if (persistLibraryTimer) {
    clearTimeout(persistLibraryTimer)
    persistLibraryTimer = null
  }
  if (rebuildArtifactsTimer) {
    clearTimeout(rebuildArtifactsTimer)
    rebuildArtifactsTimer = null
  }
})

function setFeedback(type = '', message = '') {
  feedback.type = type
  feedback.message = message
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cloneBundleForOwnershipPatch(bundle = null) {
  if (!bundle || typeof bundle !== 'object') {
    return null
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(bundle)
    } catch {
      // fallback below
    }
  }
  try {
    return JSON.parse(JSON.stringify(bundle))
  } catch {
    return null
  }
}

function readEventValue(eventOrValue = '') {
  if (
    eventOrValue &&
    typeof eventOrValue === 'object' &&
    eventOrValue.target &&
    typeof eventOrValue.target === 'object'
  ) {
    return String(eventOrValue.target.value || '')
  }
  return String(eventOrValue || '')
}

function getCurrentBundleOwnerFieldValue(field = '') {
  const currentOwner = workspace.value?.draftBundle?.operational_owner || {}
  if (field === 'ownerType') {
    return String(currentOwner.ownerType || 'queue')
  }
  return String(currentOwner[field] || '')
}

function normalizeBundleOwnerFieldValue(field = '', eventOrValue = '') {
  const rawValue = readEventValue(eventOrValue)
  if (field === 'ownerType') {
    const normalized = rawValue.trim().toLowerCase()
    return ['queue', 'area', 'role'].includes(normalized) ? normalized : 'queue'
  }
  if (field === 'queueKey') {
    return rawValue.trim()
  }
  return rawValue
}

function getCurrentBundleOwnerDraftFieldValue(field = '') {
  if (field === 'ownerType') {
    return String(bundleOwnerDraft.value.ownerType || 'queue')
  }
  return String(bundleOwnerDraft.value[field] || '')
}

function syncBundleOwnerDraftFromWorkspace(options = {}) {
  const source = String(options.source || 'unknown')
  if (isUpdatingBundleOperationalOwner && !options.force) {
    return
  }

  const owner = workspace.value?.draftBundle?.operational_owner || {}
  const nextDraft = {
    ownerType: normalizeBundleOwnerFieldValue('ownerType', owner.ownerType || 'queue'),
    queueKey: normalizeBundleOwnerFieldValue('queueKey', owner.queueKey || ''),
    areaLabel: String(owner.areaLabel || ''),
    roleKey: String(owner.roleKey || ''),
  }
  const currentDraft = bundleOwnerDraft.value
  const isSameDraft =
    String(currentDraft.ownerType || '') === nextDraft.ownerType &&
    String(currentDraft.queueKey || '') === nextDraft.queueKey &&
    String(currentDraft.areaLabel || '') === nextDraft.areaLabel &&
    String(currentDraft.roleKey || '') === nextDraft.roleKey
  if (isSameDraft) {
    return
  }

  bundleOwnerDraft.value = nextDraft
}

function goToFlowOverview() {
  const normalizedBundleId = sanitizeBundleId(
    currentBundleEntry.value?.bundleId || bundleId.value || '',
  )
  if (!normalizedBundleId) {
    goToLibrary()
    return
  }
  const query = {}
  if (ui.safeMode) {
    query.safe = '1'
  }
  router.push({
    name: 'admin-faq-flow',
    params: {
      bundleId: normalizedBundleId,
    },
    query,
  })
}

function goToLibrary() {
  router.push({ name: 'admin-faq' })
}

function switchMode(mode = 'visual') {
  const nextMode = normalizeMode(mode)
  if (ui.mode === nextMode && String(route.query.mode || '') === nextMode) {
    return
  }
  ui.mode = nextMode
  router.replace({
    path: route.path,
    query: { ...route.query, mode: nextMode },
  })
}

function toggleOverflowMenu() {
  ui.showOverflowMenu = !ui.showOverflowMenu
}

function touchWorkspace({ rebuild = 'debounced' } = {}) {
  if (!workspace.value) return
  touchFaqBuilderWorkspace(workspace.value, currentEditorName.value)
  markEntryAsTouched()
  if (rebuild === 'immediate') {
    rebuildRenderArtifacts({ safeMode: ui.safeMode })
  } else {
    scheduleRebuildArtifacts()
  }
  scheduleLibraryPersist()
}

function syncEdges() {
  if (!workspace.value) return
  syncCanvasSnapshotEdges(
    workspace.value.canvasSnapshot,
    workspace.value.draftBundle,
  )
}

function quickAddChild(parentNodeId = '', nodeMode = 'path') {
  if (!workspace.value) return
  const node = addFaqBuilderChildNode(workspace.value.draftBundle, parentNodeId, {
    nodeMode,
  })
  if (!node) {
    setFeedback('error', 'Nao foi possivel criar o no filho.')
    return
  }
  const parentPosition = workspace.value.canvasSnapshot.nodePositions?.[parentNodeId] || {
    x: 80,
    y: 80,
  }
  updateCanvasSnapshotNodePosition(workspace.value.canvasSnapshot, node.id, {
    x: parentPosition.x + 340,
    y: parentPosition.y + 150,
  })
  syncEdges()
  touchWorkspace({ rebuild: 'immediate' })
  ui.selectedNodeId = node.id
}

function onNodeDragStop(payloadOrEvent, maybeNode) {
  if (!workspace.value) return
  const node =
    maybeNode ||
    payloadOrEvent?.node ||
    payloadOrEvent
  if (!node || typeof node !== 'object' || !String(node.id || '').trim()) {
    return
  }
  if (!node.position || typeof node.position !== 'object') {
    return
  }
  updateCanvasSnapshotNodePosition(
    workspace.value.canvasSnapshot,
    node.id,
    node.position,
  )
  touchWorkspace()
}

function onFlowConnect(connection) {
  if (!workspace.value) return
  const sourceId = String(connection?.source || '').trim()
  const targetId = String(connection?.target || '').trim()
  if (!sourceId || !targetId) {
    setFeedback('error', 'Conexao invalida: origem/destino ausente.')
    return
  }
  const result = connectFaqBuilderNodes(workspace.value.draftBundle, {
    sourceId,
    targetId,
  })
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  syncEdges()
  touchWorkspace({ rebuild: 'immediate' })
}

function applyAutoLayout() {
  if (!workspace.value) return
  workspace.value.canvasSnapshot = buildAutoLayoutSnapshot(
    workspace.value.draftBundle,
    workspace.value.canvasSnapshot,
  )
  touchWorkspace({ rebuild: 'immediate' })
  setFeedback('success', 'Fluxo reorganizado com auto-layout.')
}

function updateNodeField(field = '', value = '') {
  if (!selectedNode.value || !workspace.value) return
  if (!field || typeof field !== 'string') return
  setFaqBuilderNodeField(
    workspace.value.draftBundle,
    selectedNode.value.id,
    field,
    value,
  )
  touchWorkspace()
}

function updateNodeTags(value = '') {
  if (!selectedNode.value || !workspace.value) return
  setFaqBuilderNodeListField(
    workspace.value.draftBundle,
    selectedNode.value.id,
    'tags',
    value,
  )
  touchWorkspace()
}

function updateNodeMode(mode = 'path') {
  if (!selectedNode.value) return
  updateNodeField(
    'node_kind',
    mode === 'final'
      ? 'leaf'
      : selectedNodeParentLink.value
        ? 'branch'
        : 'theme',
  )
  updateNodeField(
    'acao',
    mode === 'final' ? 'mostrar_resposta' : 'ir_para_subniveis',
  )
}

function updateBundleOperationalOwner(field = '', value = '') {
  if (!workspace.value || !field || isUpdatingBundleOperationalOwner) return

  const fieldKey = String(field || '').trim()
  if (!BUNDLE_OWNER_EDITABLE_FIELDS.includes(fieldKey)) {
    return
  }
  const currentValue = getCurrentBundleOwnerFieldValue(fieldKey)
  const nextValue = normalizeBundleOwnerFieldValue(fieldKey, value)
  if (currentValue === nextValue) {
    syncBundleOwnerDraftFromWorkspace({
      source: 'updateBundleOperationalOwner unchanged',
    })
    return
  }

  const draftBundleClone = cloneBundleForOwnershipPatch(workspace.value.draftBundle)
  if (!draftBundleClone) {
    return
  }

  isUpdatingBundleOperationalOwner = true
  try {
    const nextOwner = setFaqBuilderBundleOperationalOwner(draftBundleClone, {
      [fieldKey]: nextValue,
    })
    const nextEffectiveValue =
      fieldKey === 'ownerType'
        ? String(nextOwner?.ownerType || 'queue')
        : String(nextOwner?.[fieldKey] || '')
    if (nextEffectiveValue === currentValue) {
      syncBundleOwnerDraftFromWorkspace({
        source: 'updateBundleOperationalOwner normalized-unchanged',
      })
      return
    }
    workspace.value.draftBundle = draftBundleClone
    touchWorkspace()
    syncBundleOwnerDraftFromWorkspace({
      source: 'updateBundleOperationalOwner touched',
    })
  } finally {
    isUpdatingBundleOperationalOwner = false
    syncBundleOwnerDraftFromWorkspace({
      source: 'updateBundleOperationalOwner finally',
      force: true,
    })
  }
}

function handleBundleOwnerTypeChange(eventOrValue = '') {
  const nextValue = normalizeBundleOwnerFieldValue('ownerType', eventOrValue)
  const previousDraftValue = getCurrentBundleOwnerDraftFieldValue('ownerType')
  bundleOwnerDraft.value = {
    ...bundleOwnerDraft.value,
    ownerType: nextValue,
  }
  if (nextValue === previousDraftValue) {
    return
  }
  updateBundleOperationalOwner('ownerType', nextValue)
}

function handleBundleOwnerQueueChange(eventOrValue = '') {
  const nextValue = normalizeBundleOwnerFieldValue('queueKey', eventOrValue)
  const previousDraftValue = getCurrentBundleOwnerDraftFieldValue('queueKey')
  bundleOwnerDraft.value = {
    ...bundleOwnerDraft.value,
    queueKey: nextValue,
  }
  if (nextValue === previousDraftValue) {
    return
  }
  updateBundleOperationalOwner('queueKey', nextValue)
}

function handleBundleOwnerAreaChange(eventOrValue = '') {
  const nextValue = normalizeBundleOwnerFieldValue('areaLabel', eventOrValue)
  const previousDraftValue = getCurrentBundleOwnerDraftFieldValue('areaLabel')
  bundleOwnerDraft.value = {
    ...bundleOwnerDraft.value,
    areaLabel: nextValue,
  }
  if (nextValue === previousDraftValue) {
    return
  }
  updateBundleOperationalOwner('areaLabel', nextValue)
}

function handleBundleOwnerRoleChange(eventOrValue = '') {
  const nextValue = normalizeBundleOwnerFieldValue('roleKey', eventOrValue)
  const previousDraftValue = getCurrentBundleOwnerDraftFieldValue('roleKey')
  bundleOwnerDraft.value = {
    ...bundleOwnerDraft.value,
    roleKey: nextValue,
  }
  if (nextValue === previousDraftValue) {
    return
  }
  updateBundleOperationalOwner('roleKey', nextValue)
}

function updateNodeOwnershipField(field = '', value = '') {
  if (!workspace.value || !selectedNode.value || !field) return
  setFaqBuilderNodeOwnership(workspace.value.draftBundle, selectedNode.value.id, {
    [field]: value,
  })
  touchWorkspace({ rebuild: 'immediate' })
}

function moveNodeParent() {
  if (!selectedNode.value || !workspace.value || !ui.parentTargetId) return
  if (!String(selectedNode.value.id || '').trim()) {
    setFeedback('error', 'No selecionado invalido para mover.')
    return
  }
  const result = moveFaqBuilderNode(
    workspace.value.draftBundle,
    selectedNode.value.id,
    ui.parentTargetId,
  )
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  syncEdges()
  touchWorkspace({ rebuild: 'immediate' })
  setFeedback('success', 'Pai do no atualizado.')
}

function applyEditorCommand(command = '') {
  if (!responseEditorRef.value) return
  responseEditorRef.value.focus()
  if (command === 'link') {
    const url = window.prompt('Informe a URL do link:')
    if (!url) return
    document.execCommand('createLink', false, url)
  } else {
    document.execCommand(command, false, null)
  }
  if (selectedNode.value) {
    updateNodeField('resposta', responseEditorRef.value.innerHTML)
  }
}

function selectRootNode() {
  const rootId = previewRuntime.value.startId
  if (rootId) ui.selectedNodeId = rootId
}

function saveDraft() {
  if (!workspace.value) return
  saveFaqBuilderDraftWorkspace(workspace.value, {
    actorName: currentEditorName.value,
    summary: ui.governanceSummary || 'Rascunho salvo no editor completo.',
  })
  touchWorkspace({ rebuild: 'immediate' })
  setFeedback('success', 'Rascunho salvo sem publicar.')
}

function submitReview() {
  workflowTransition('In Review', 'Fluxo enviado para revisao.')
}

function workflowTransition(nextStatus = 'Draft', successMessage = '') {
  if (!workspace.value) return
  const result = transitionFaqBuilderWorkflow(workspace.value, {
    nextStatus,
    actorName: currentEditorName.value,
    summary: ui.governanceSummary,
  })
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  touchWorkspace()
  if (successMessage) setFeedback('success', successMessage)
}

function publishWorkspace() {
  if (!workspace.value) return
  const result = publishFaqBuilderWorkspace(workspace.value, {
    actorName: currentEditorName.value,
    summary: ui.governanceSummary || 'Publicacao via FAQ Builder.',
    publishConfig: workspace.value.publishConfig,
  })
  if (!result.ok) {
    setFeedback('error', result.message)
    ui.showValidationDetails = true
    return
  }
  touchWorkspace()
  setFeedback('success', 'Fluxo publicado com sucesso.')
}

function openPreview() {
  const normalizedBundleId = sanitizeBundleId(
    currentBundleEntry.value?.bundleId || bundleId.value || '',
  )
  if (!normalizedBundleId) {
    setFeedback('error', 'Fluxo invalido para abrir visualizacao de teste.')
    return
  }
  const query = { tester: 'draft' }
  if (ui.safeMode) {
    query.safe = '1'
  }
  router.push({
    name: 'admin-faq-flow',
    params: {
      bundleId: normalizedBundleId,
    },
    query,
  })
}

function closePreview() {
  ui.showPreviewModal = false
}

function stepPreview(nodeId = '') {
  if (nodeId) previewState.activeNodeId = nodeId
}

async function downloadTemplate() {
  if (!currentBundleEntry.value) return
  await downloadFaqBuilderTemplateXlsx({
    faqType: currentBundleEntry.value.faqType,
  })
}

async function runSecondaryAction(action = '') {
  ui.showOverflowMenu = false
  if (action === 'review') {
    submitReview()
    return
  }
  if (action === 'template') {
    await downloadTemplate()
  }
}

async function onSpreadsheetSelected(event) {
  const file = event.target.files?.[0] || null
  if (!file || !workspace.value || !currentBundleEntry.value) return

  importState.fileName = file.name
  importState.isLoading = true

  try {
    importState.result = await readFaqBuilderSpreadsheet(file, {
      faqType: currentBundleEntry.value.faqType,
      baseBundle: workspace.value.draftBundle,
    })
  } catch (error) {
    setFeedback('error', error?.message || 'Falha ao processar o dry-run.')
  } finally {
    importState.isLoading = false
  }
}

function applySpreadsheetImport() {
  if (
    !workspace.value ||
    !importState.result?.ok ||
    !importState.result?.draftBundle ||
    !importState.result?.canvasSnapshot
  ) {
    return
  }

  workspace.value.draftBundle = importState.result.draftBundle
  workspace.value.canvasSnapshot = importState.result.canvasSnapshot
  workspace.value.workflowStatus = 'Draft'
  touchWorkspace()
  setFeedback('success', 'Planilha aplicada no fluxo atual.')
  switchMode('visual')
}
</script>

<template>
  <div
    class="faq-editor-page"
    :class="{
      'faq-editor-page--fullscreen': ui.isFullscreen,
    }"
  >
    <header
      v-if="!isMissingBundle"
      class="faq-editor-header rounded-[18px] border border-slate-200 bg-white px-4 py-3"
    >
      <div class="faq-editor-header__main">
        <button type="button" class="faq-back-btn" @click="goToFlowOverview">
          Voltar para visao do fluxo
        </button>
        <h1 class="mt-2 text-lg font-semibold text-slate-950">
          {{ currentBundleEntry.title }}
        </h1>
        <p class="mt-1 text-xs text-slate-500">
          {{ currentBundleEntry.subjectKey }} | {{ currentBundleEntry.bundleId }}
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge :label="`Status: ${workspace.workflowStatus}`" />
          <StatusBadge
            :label="publishBlocked ? 'Com bloqueio estrutural' : 'Apto para publicar'"
          />
          <span class="text-xs font-semibold" :class="statusToneClass">
            {{ validationSummaryLabel }}
          </span>
        </div>
      </div>

      <div class="faq-editor-header__actions">
        <button
          type="button"
          class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          @click="setEditorFullscreen(!ui.isFullscreen, { source: 'user' })"
        >
          {{ ui.isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia' }}
        </button>
        <button
          type="button"
          class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          @click="saveDraft"
        >
          Salvar rascunho
        </button>
        <button
          type="button"
          class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          @click="openPreview"
        >
          Testar fluxo
        </button>
        <button
          type="button"
          class="rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          @click="publishWorkspace"
        >
          Publicar
        </button>

        <div ref="overflowMenuRef" class="relative">
          <button
            type="button"
            class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
            @click.stop="toggleOverflowMenu"
          >
            Mais
          </button>
          <div
            v-if="ui.showOverflowMenu"
            class="absolute right-0 z-20 mt-2 grid w-[220px] gap-1 rounded-[12px] border border-slate-200 bg-white p-2 shadow-lg"
          >
            <button
              type="button"
              class="faq-menu-item"
              @click="runSecondaryAction('review')"
            >
              Enviar para revisao
            </button>
            <button
              type="button"
              class="faq-menu-item"
              @click="runSecondaryAction('template')"
            >
              Baixar template XLSX
            </button>
          </div>
        </div>
      </div>
    </header>

    <section
      v-if="runtimeLoadError"
      class="mt-3 rounded-[14px] border border-[rgba(166,31,40,0.25)] bg-[rgba(253,236,237,0.8)] px-4 py-3 text-sm text-[var(--color-danger)]"
    >
      <p class="font-semibold">Dados locais antigos do builder foram reinicializados.</p>
      <p class="mt-1">{{ runtimeLoadError }}</p>
    </section>

    <section
      v-if="openState.isLoading"
      class="mt-3 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
    >
      Carregando fluxo em modo protegido...
    </section>

    <section
      v-if="ui.safeMode || openState.failed || sanitizedState.warnings.length"
      class="mt-3 rounded-[14px] border border-[rgba(8,115,145,0.22)] bg-[rgba(224,242,254,0.7)] px-4 py-3"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#0b6e8c]">
            Estabilidade do builder
          </p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{
              openState.failed
                ? 'Nao foi possivel preparar o editor deste fluxo.'
                : ui.safeMode
                  ? 'Modo seguro ativo para continuar a edicao com menor risco.'
                  : 'Abertura concluida com ajustes automaticos de estabilidade.'
            }}
          </p>
          <p v-if="openState.issueMessage" class="mt-1 text-xs text-slate-700">
            {{ openState.issueMessage }}
          </p>
          <p
            v-else-if="sanitizedState.warnings.length"
            class="mt-1 text-xs text-slate-700"
          >
            {{ `${sanitizedState.warnings.length} ajuste(s) aplicados para manter o fluxo editavel.` }}
          </p>
          <p class="mt-1 text-xs text-slate-600">
            O modo seguro preserva a edicao e reduz o uso do canvas interativo. Reconstruir a organizacao visual refaz apenas a posicao dos nos.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            @click="retryOpenBundle"
          >
            Tentar novamente
          </button>
          <button
            v-if="!ui.safeMode"
            type="button"
            class="rounded-[10px] border border-[#0b6e8c] bg-white px-3 py-2 text-xs font-semibold text-[#0b6e8c]"
            @click="setSafeMode(true, { source: 'user' })"
          >
            Abrir em modo seguro
          </button>
          <button
            type="button"
            class="rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            @click="recoverIgnoringSnapshot"
          >
            Reconstruir organizacao visual
          </button>
        </div>
      </div>
      <details
        v-if="openState.markers.length"
        class="mt-3 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
      >
        <summary class="cursor-pointer font-semibold text-slate-700">
          Ver detalhes tecnicos da abertura
        </summary>
        <ol class="mt-2 grid gap-1">
          <li v-for="marker in openState.markers" :key="`${marker.at}-${marker.stage}`">
            {{ marker.at }} · {{ marker.stage }} <span v-if="marker.details">· {{ marker.details }}</span>
          </li>
        </ol>
      </details>
    </section>

    <section
      v-if="feedback.message"
      class="mt-3 rounded-[14px] border px-4 py-3 text-sm"
      :class="
        feedback.type === 'error'
          ? 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]'
          : 'border-[rgba(26,111,67,0.22)] bg-[rgba(220,252,231,0.75)] text-[var(--color-success)]'
      "
    >
      {{ feedback.message }}
    </section>

    <section
      v-if="isMissingBundle"
      class="mt-4 rounded-[18px] border border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.85)] p-6"
    >
      <h2 class="text-base font-semibold text-[var(--color-danger)]">
        Fluxo nao encontrado
      </h2>
      <p class="mt-2 text-sm text-[var(--color-danger)]/80">
        O bundle solicitado nao existe ou foi removido da biblioteca.
      </p>
      <button
        type="button"
        class="mt-4 rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
        @click="goToLibrary"
      >
        Voltar para biblioteca
      </button>
    </section>

    <template v-else>
      <section
        v-if="openState.failed"
        class="mt-3 rounded-[16px] border border-[rgba(166,31,40,0.24)] bg-[rgba(253,236,237,0.76)] p-4 text-sm text-[var(--color-danger)]"
      >
        Nao foi possivel renderizar o editor completo deste fluxo sem risco de travamento.
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-[10px] border border-[rgba(166,31,40,0.35)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger)]"
            @click="retryOpenBundle"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            class="rounded-[10px] border border-[rgba(166,31,40,0.35)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger)]"
            @click="setSafeMode(true, { source: 'user' })"
          >
            Forcar modo seguro
          </button>
          <button
            type="button"
            class="rounded-[10px] border border-[rgba(166,31,40,0.35)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger)]"
            @click="recoverIgnoringSnapshot"
          >
            Resetar workspace visual
          </button>
        </div>
      </section>

      <template v-else>
        <section class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="mode in EDITOR_MODES"
              :key="mode.key"
              type="button"
              class="rounded-full border px-3 py-2 text-xs font-semibold transition"
              :class="
                ui.mode === mode.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              "
              @click="switchMode(mode.key)"
            >
              {{ mode.label }}
            </button>
          </div>
          <button
            type="button"
            class="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            @click="ui.showValidationDetails = !ui.showValidationDetails"
          >
            Validacao: {{ validationSummaryLabel }}
          </button>
        </section>

        <template v-if="ui.mode === 'visual' && !openState.isLoading">
          <section class="mt-3 grid gap-3 xl:grid-cols-[1fr_390px]">
            <article class="faq-canvas-shell rounded-[18px] border border-slate-200 bg-white">
              <div class="faq-canvas-shell__meta">
                <p class="text-xs text-slate-600">
                  Edite a estrutura no canvas. Clique no no para abrir detalhes.
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-[10px] border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                    @click="applyAutoLayout"
                  >
                    Auto-layout
                  </button>
                  <button
                    v-if="ui.safeMode"
                    type="button"
                    class="rounded-[10px] border border-[#0b6e8c] px-3 py-1.5 text-[11px] font-semibold text-[#0b6e8c]"
                    @click="setSafeMode(false, { source: 'user' })"
                  >
                    Tentar canvas interativo
                  </button>
                </div>
              </div>
              <div class="faq-canvas-shell__stage">
                <div
                  v-if="ui.safeMode"
                  class="flex h-full min-h-[420px] flex-col rounded-[14px] border border-slate-200 bg-slate-50 p-3"
                >
                  <p class="text-xs font-semibold text-slate-800">
                    Modo seguro ativo: canvas interativo desativado para evitar travamento.
                  </p>
                  <p class="mt-1 text-xs text-slate-600">
                    Selecione um no abaixo para editar no painel lateral.
                  </p>
                  <div class="mt-3 grid max-h-[360px] gap-1 overflow-auto pr-1">
                    <button
                      v-for="node in flowNodes"
                      :key="`safe-node-${node.id}`"
                      type="button"
                      class="rounded-[10px] border px-3 py-2 text-left text-xs transition"
                      :class="
                        ui.selectedNodeId === node.id
                          ? 'border-[#0b6e8c] bg-[rgba(224,242,254,0.85)] text-[#0b6e8c]'
                          : 'border-slate-300 bg-white text-slate-700'
                      "
                      @click="ui.selectedNodeId = node.id"
                    >
                      <span class="block font-semibold">{{ node.data?.title || node.id }}</span>
                      <span class="mt-0.5 block text-[11px] text-slate-500">
                        {{ node.data?.nodeMode === 'final' ? 'Resposta final' : 'Caminho' }}
                      </span>
                    </button>
                  </div>
                </div>
                <VueFlowCanvas
                  v-else-if="flowNodes.length"
                  :key="`${bundleId}-${ui.safeMode ? 'safe' : 'default'}-${flowNodes.length}-${flowEdges.length}`"
                  :nodes="flowNodes"
                  :edges="flowEdges"
                  :node-types="vueFlowNodeTypes"
                  class="faq-builder-flow"
                  @connect="onFlowConnect"
                  @node-drag-stop="onNodeDragStop"
                >
                  <VueFlowBackground pattern-color="#d4dbe4" :gap="28" />
                  <VueFlowControls />
                </VueFlowCanvas>
                <div
                  v-else
                  class="flex h-full min-h-[420px] items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600"
                >
                  Nenhum no valido para renderizar no canvas. Use o modo seguro ou reconstrua o snapshot.
                </div>
              </div>
            </article>

            <aside class="faq-node-drawer rounded-[18px] border border-slate-200 bg-white">
              <header class="faq-node-drawer__header">
                <h2 class="text-sm font-semibold text-slate-900">Edicao do no</h2>
                <p class="text-xs text-slate-500">Ajuste apenas o no selecionado.</p>
              </header>

              <section class="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Responsavel padrao do fluxo
                </p>
                <div class="mt-2 grid gap-2">
                  <label class="faq-field">
                    <span>Tipo</span>
                    <select
                      :value="bundleOwnerDraft.ownerType"
                      class="faq-input"
                      @change="handleBundleOwnerTypeChange"
                    >
                      <option
                        v-for="option in catalogs.operationalOwnerTypes"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                  <label
                    v-if="bundleOwnerDraft.ownerType === 'queue'"
                    class="faq-field"
                  >
                    <span>Fila responsavel</span>
                    <select
                      :value="bundleOwnerDraft.queueKey"
                      class="faq-input"
                      @change="handleBundleOwnerQueueChange"
                    >
                      <option
                        v-for="option in catalogs.queueDestinations"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                  <label
                    v-else-if="bundleOwnerDraft.ownerType === 'area'"
                    class="faq-field"
                  >
                    <span>Area responsavel</span>
                    <input
                      :value="bundleOwnerDraft.areaLabel"
                      class="faq-input"
                      placeholder="Ex.: Secretaria Academica"
                      @change="handleBundleOwnerAreaChange"
                    />
                  </label>
                  <label v-else class="faq-field">
                    <span>Perfil responsavel</span>
                    <input
                      :value="bundleOwnerDraft.roleKey"
                      class="faq-input"
                      placeholder="Ex.: analista_area"
                      @change="handleBundleOwnerRoleChange"
                    />
                  </label>
                </div>
              </section>

              <div v-if="selectedNode" class="faq-node-drawer__content">
                <label class="faq-field">
                  <span>Titulo curto</span>
                  <input
                    :value="selectedNode.titulo_exibido"
                    class="faq-input"
                    @input="updateNodeField('titulo_exibido', $event.target.value)"
                  />
                </label>

                <div class="grid gap-2 md:grid-cols-2">
                  <label class="faq-field">
                    <span>Tipo do no</span>
                    <select
                      :value="selectedNodeMode"
                      class="faq-input"
                      @change="updateNodeMode($event.target.value)"
                    >
                      <option value="path">Caminho</option>
                      <option value="final">Resposta final</option>
                    </select>
                  </label>
                  <label class="faq-field">
                    <span>Acao final</span>
                    <select
                      :value="selectedNode.acao"
                      class="faq-input"
                      @change="updateNodeField('acao', $event.target.value)"
                    >
                      <option
                        v-for="option in catalogs.actions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                </div>

                <div class="grid gap-2 md:grid-cols-2">
                  <label class="faq-field">
                    <span>Destino da fila</span>
                    <select
                      :value="selectedNode.fila_destino"
                      class="faq-input"
                      @change="updateNodeField('fila_destino', $event.target.value)"
                    >
                      <option
                        v-for="option in catalogs.queueDestinations"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                  <label class="faq-field">
                    <span>SLA padrao</span>
                    <select
                      :value="selectedNode.sla_padrao"
                      class="faq-input"
                      @change="updateNodeField('sla_padrao', $event.target.value)"
                    >
                      <option
                        v-for="option in catalogs.slaOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                </div>

                <section class="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                  <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Ownership do no
                  </p>
                  <label class="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedNode.owner_inherit !== false"
                      @change="updateNodeOwnershipField('inherit', $event.target.checked)"
                    />
                    Usar responsavel herdado
                  </label>
                  <div v-if="selectedNode.owner_inherit === false" class="mt-2 grid gap-2">
                    <label class="faq-field">
                      <span>Tipo</span>
                      <select
                        :value="selectedNode.owner_type || 'queue'"
                        class="faq-input"
                        @change="updateNodeOwnershipField('ownerType', $event.target.value)"
                      >
                        <option
                          v-for="option in catalogs.operationalOwnerTypes"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </label>
                    <label
                      v-if="(selectedNode.owner_type || 'queue') === 'queue'"
                      class="faq-field"
                    >
                      <span>Fila responsavel</span>
                      <select
                        :value="selectedNode.owner_queue || ''"
                        class="faq-input"
                        @change="updateNodeOwnershipField('owner_queue', $event.target.value)"
                      >
                        <option
                          v-for="option in catalogs.queueDestinations"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </label>
                    <label
                      v-else-if="selectedNode.owner_type === 'area'"
                      class="faq-field"
                    >
                      <span>Area responsavel</span>
                      <input
                        :value="selectedNode.owner_area || ''"
                        class="faq-input"
                        placeholder="Ex.: Suporte Academico Digital"
                        @input="updateNodeOwnershipField('owner_area', $event.target.value)"
                      />
                    </label>
                    <label v-else class="faq-field">
                      <span>Perfil responsavel</span>
                      <input
                        :value="selectedNode.owner_role || ''"
                        class="faq-input"
                        placeholder="Ex.: gestor_area"
                        @input="updateNodeOwnershipField('owner_role', $event.target.value)"
                      />
                    </label>
                    <label class="faq-field">
                      <span>Politica de roteamento (opcional)</span>
                      <input
                        :value="selectedNode.owner_routing_policy || ''"
                        class="faq-input"
                        placeholder="Ex.: balancear_por_carga"
                        @input="updateNodeOwnershipField('owner_routing_policy', $event.target.value)"
                      />
                    </label>
                  </div>
                  <p class="mt-2 text-[11px] text-slate-600">
                    Responsavel efetivo:
                    <strong>{{ selectedNodeEffectiveOwner?.owner?.queueLabel || selectedNodeEffectiveOwner?.owner?.areaLabel || selectedNodeEffectiveOwner?.owner?.roleKey || 'Nao resolvido' }}</strong>
                    <span v-if="selectedNodeEffectiveOwner?.source" class="text-slate-500">
                      ({{ selectedNodeEffectiveOwner.source }})
                    </span>
                  </p>
                </section>

                <div class="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                  <label class="faq-field">
                    <span>Mover para outro pai</span>
                    <select v-model="ui.parentTargetId" class="faq-input">
                      <option value="">Escolha o novo pai</option>
                      <option
                        v-for="option in parentOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                  <button
                    type="button"
                    class="rounded-[10px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                    @click="moveNodeParent"
                  >
                    Aplicar
                  </button>
                </div>

                <section
                  v-if="selectedNodeMode === 'final'"
                  class="rounded-[14px] border border-slate-200 bg-slate-50 p-3"
                >
                  <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Resposta final
                  </p>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" class="faq-editor-btn" @click="applyEditorCommand('bold')">
                      Negrito
                    </button>
                    <button
                      type="button"
                      class="faq-editor-btn"
                      @click="applyEditorCommand('insertUnorderedList')"
                    >
                      Lista
                    </button>
                    <button type="button" class="faq-editor-btn" @click="applyEditorCommand('link')">
                      Link
                    </button>
                  </div>
                  <div
                    ref="responseEditorRef"
                    contenteditable="true"
                    class="mt-2 min-h-[140px] rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-700"
                    @input="updateNodeField('resposta', $event.target.innerHTML)"
                  ></div>
                </section>

                <label class="faq-field">
                  <span>Tags</span>
                  <input
                    :value="(selectedNode.tags || []).join(', ')"
                    class="faq-input"
                    placeholder="ex.: prova,segunda chamada"
                    @input="updateNodeTags($event.target.value)"
                  />
                </label>
              </div>

              <div v-else class="faq-node-drawer__empty">
                <p class="text-sm font-semibold text-slate-900">Nenhum no selecionado</p>
                <p class="mt-1 text-xs text-slate-600">
                  Selecione um no no canvas para editar. Voce tambem pode começar pelo no raiz.
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-[10px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                    @click="selectRootNode"
                  >
                    Selecionar no raiz
                  </button>
                  <button
                    type="button"
                    class="rounded-[10px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                    @click="ui.showValidationDetails = true"
                  >
                    Ver validacao
                  </button>
                </div>
              </div>
            </aside>
          </section>

          <section
            v-if="ui.showValidationDetails"
            class="mt-3 rounded-[18px] border border-slate-200 bg-white p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-semibold text-slate-900">Validacao estrutural do fluxo</p>
              <button
                type="button"
                class="rounded-[10px] border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                @click="ui.showValidationDetails = false"
              >
                Ocultar detalhes
              </button>
            </div>
            <div class="mt-3 grid gap-2 md:grid-cols-4">
              <div class="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-xs">
                <p class="font-semibold text-slate-700">Erros</p>
                <p class="mt-1 text-base font-semibold text-[var(--color-danger)]">
                  {{ validation.errors.length }}
                </p>
              </div>
              <div class="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-xs">
                <p class="font-semibold text-slate-700">Alertas</p>
                <p class="mt-1 text-base font-semibold text-[#8a5200]">
                  {{ validation.warnings.length }}
                </p>
              </div>
              <div class="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-xs">
                <p class="font-semibold text-slate-700">Publicacao</p>
                <p class="mt-1 text-base font-semibold" :class="publishBlocked ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'">
                  {{ publishBlocked ? 'Bloqueada' : 'Liberada' }}
                </p>
              </div>
              <div class="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-xs">
                <p class="font-semibold text-slate-700">Cobertura owner final</p>
                <p
                  class="mt-1 text-base font-semibold"
                  :class="validation.ownershipCoverage?.missingFinalNodes ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'"
                >
                  {{ validation.ownershipCoverage?.effectiveFinalNodes || 0 }}/{{ validation.ownershipCoverage?.totalFinalNodes || 0 }}
                </p>
              </div>
            </div>
            <div class="mt-3 max-h-[260px] overflow-auto rounded-[12px] border border-slate-200">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-100 text-slate-600">
                  <tr>
                    <th class="px-2 py-2">Tipo</th>
                    <th class="px-2 py-2">Codigo</th>
                    <th class="px-2 py-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(issue, index) in validation.issues"
                    :key="`${issue.code}-${index}`"
                    class="border-t border-slate-200"
                  >
                    <td class="px-2 py-2">
                      {{ issue.severity === 'error' ? 'Erro' : 'Alerta' }}
                    </td>
                    <td class="px-2 py-2">{{ issue.code }}</td>
                    <td class="px-2 py-2">{{ issue.message }}</td>
                  </tr>
                  <tr v-if="!validation.issues.length" class="border-t border-slate-200">
                    <td colspan="3" class="px-2 py-3 text-[var(--color-success)]">
                      Nenhum problema estrutural encontrado.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="ui.mode === 'import'">
          <section class="mt-3 grid gap-3 xl:grid-cols-[0.92fr_1.08fr]">
            <article class="rounded-[18px] border border-slate-200 bg-white p-4">
              <p class="text-sm font-semibold text-slate-900">
                Importacao por planilha para este fluxo
              </p>
              <p class="mt-1 text-xs text-slate-600">
                A importacao e contextual ao bundle atual e funciona em modo tudo-ou-nada.
              </p>
              <button
                type="button"
                class="mt-3 rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                @click="downloadTemplate"
              >
                Baixar template oficial
              </button>
              <input
                type="file"
                accept=".xlsx,.xls"
                class="mt-4 w-full rounded-[12px] border border-slate-300 px-3 py-2 text-sm"
                @change="onSpreadsheetSelected"
              />
              <p class="mt-2 text-xs text-slate-500">
                {{ importState.fileName || 'Nenhum arquivo selecionado.' }}
              </p>
            </article>

            <article class="rounded-[18px] border border-slate-200 bg-white p-4">
              <p class="text-sm font-semibold text-slate-900">Resultado do dry-run</p>
              <p v-if="importState.isLoading" class="mt-2 text-sm text-slate-600">
                Processando planilha...
              </p>
              <template v-else-if="importState.result">
                <p class="mt-2 text-xs text-slate-600">
                  Linhas: {{ importState.result.summary?.totalRows || 0 }} | Nos:
                  {{ importState.result.summary?.totalNodes || 0 }} | Links:
                  {{ importState.result.summary?.totalLinks || 0 }}
                </p>
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
                      <tr
                        v-for="(error, index) in importState.result.errors"
                        :key="`${error.code}-${index}`"
                        class="border-t border-slate-200"
                      >
                        <td class="px-2 py-2">{{ error.row ?? '-' }}</td>
                        <td class="px-2 py-2">{{ error.field }}</td>
                        <td class="px-2 py-2">{{ error.code }}</td>
                        <td class="px-2 py-2">{{ error.message }}</td>
                      </tr>
                      <tr
                        v-if="!importState.result.errors.length"
                        class="border-t border-slate-200"
                      >
                        <td colspan="4" class="px-2 py-3 text-[var(--color-success)]">
                          Sem erros bloqueadores.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  class="mt-3 rounded-[12px] border px-3 py-2 text-xs font-semibold"
                  :class="
                    importState.result.ok
                      ? 'border-[rgba(26,111,67,0.25)] bg-[rgba(220,252,231,0.8)] text-[var(--color-success)]'
                      : 'border-slate-300 bg-slate-100 text-slate-500'
                  "
                  :disabled="!importState.result.ok"
                  @click="applySpreadsheetImport"
                >
                  Aplicar importacao neste fluxo
                </button>
              </template>
            </article>
          </section>
        </template>

        <template v-else>
          <section class="mt-3 grid gap-3 xl:grid-cols-[0.86fr_1.14fr]">
            <article class="rounded-[18px] border border-slate-200 bg-white p-4">
              <p class="text-sm font-semibold text-slate-900">Governanca do fluxo</p>
              <p class="mt-1 text-xs text-slate-600">
                Registre o contexto da mudanca antes de publicar.
              </p>
              <textarea
                v-model="ui.governanceSummary"
                rows="4"
                class="mt-3 w-full rounded-[12px] border border-slate-300 px-3 py-2 text-sm"
                placeholder="Resumo objetivo da mudanca..."
              ></textarea>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  @click="workflowTransition('Draft', 'Status alterado para Draft.')"
                >
                  Marcar Draft
                </button>
                <button
                  type="button"
                  class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  @click="submitReview"
                >
                  Enviar revisao
                </button>
                <button
                  type="button"
                  class="rounded-[12px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  @click="workflowTransition('Archived', 'Fluxo arquivado.')"
                >
                  Arquivar
                </button>
                <button
                  type="button"
                  class="rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  @click="publishWorkspace"
                >
                  Publicar agora
                </button>
              </div>
            </article>

            <article class="rounded-[18px] border border-slate-200 bg-white p-4">
              <p class="text-sm font-semibold text-slate-900">Diff do draft atual</p>
              <div class="mt-3 grid gap-1 text-xs text-slate-600 md:grid-cols-2">
                <p>Nos criados: {{ bundleDiff.summary.createdNodes }}</p>
                <p>Nos removidos: {{ bundleDiff.summary.removedNodes }}</p>
                <p>Nos alterados: {{ bundleDiff.summary.updatedNodes }}</p>
                <p>Links criados: {{ bundleDiff.summary.createdLinks }}</p>
                <p>Links removidos: {{ bundleDiff.summary.removedLinks }}</p>
              </div>
              <details class="mt-3 rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                <summary class="cursor-pointer text-xs font-semibold text-slate-700">
                  Preview do payload backend
                </summary>
                <pre class="mt-2 max-h-[220px] overflow-auto text-[11px] leading-5 text-slate-600">{{ JSON.stringify(upsertPreview, null, 2) }}</pre>
              </details>
              <p class="mt-3 text-xs text-slate-500">
                Readiness backend/Frappe: upsert
                {{ backendReadiness.hasServerUpsert ? 'ativo' : 'mockado' }} |
                dry-run server
                {{ backendReadiness.hasServerDryRun ? 'ativo' : 'mockado' }} |
                lock server
                {{ backendReadiness.hasServerLock ? 'ativo' : 'mockado' }}.
              </p>
            </article>
          </section>
        </template>
      </template>
    </template>

    <div
      v-if="ui.showPreviewModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4"
    >
      <div class="w-full max-w-[760px] rounded-[18px] border border-slate-200 bg-white p-4 shadow-2xl">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-slate-900">Teste rapido da jornada</h2>
          <button
            type="button"
            class="rounded-[10px] border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
            @click="closePreview"
          >
            Fechar
          </button>
        </div>

        <template v-if="previewNode">
          <p class="mt-3 text-base font-semibold text-slate-950">
            {{ previewNode.titulo_exibido }}
          </p>
          <p class="mt-1 text-xs text-slate-500">
            {{ previewNode.tema }} / {{ previewNode.subtema }}
          </p>
          <p
            v-if="previewNode.resposta"
            class="mt-2 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
          >
            {{ stripHtml(previewNode.resposta) }}
          </p>

          <div class="mt-3 grid gap-2">
            <button
              v-for="(choice, choiceIndex) in previewChoices"
              :key="choice?.id || `choice-${choiceIndex}`"
              type="button"
              class="rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-400"
              @click="stepPreview(choice?.id || '')"
            >
              {{ choice?.titulo_exibido || 'Opcao sem titulo' }}
            </button>
            <p v-if="!previewChoices.length" class="text-xs text-slate-500">
              Este no nao possui caminhos seguintes.
            </p>
          </div>
        </template>
        <p v-else class="mt-3 text-sm text-slate-600">
          Fluxo sem no inicial definido para preview.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-editor-page {
  display: grid;
  gap: 0.5rem;
}

.faq-editor-page--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 120;
  overflow: auto;
  padding: 0.75rem;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
}

.faq-editor-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
}

.faq-editor-header__main {
  min-width: 260px;
}

.faq-editor-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 0.5rem;
}

.faq-back-btn {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #334155;
  background: #f8fafc;
}

.faq-menu-item {
  text-align: left;
  border-radius: 0.55rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
}

.faq-menu-item:hover {
  background: #f1f5f9;
}

.faq-canvas-shell {
  min-height: calc(100vh - 285px);
  display: grid;
  grid-template-rows: auto 1fr;
}

.faq-canvas-shell__meta {
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
}

.faq-canvas-shell__stage {
  min-height: 640px;
  padding: 0.45rem;
}

.faq-node-drawer {
  min-height: calc(100vh - 285px);
  display: grid;
  grid-template-rows: auto 1fr;
}

.faq-node-drawer__header {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.8rem 0.95rem;
}

.faq-node-drawer__content {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem;
  align-content: start;
  overflow: auto;
}

.faq-node-drawer__empty {
  padding: 1rem;
}

.faq-field {
  display: grid;
  gap: 0.35rem;
}

.faq-field span {
  font-size: 0.68rem;
  line-height: 1.1;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #64748b;
}

.faq-input {
  border: 1px solid #cbd5e1;
  border-radius: 0.7rem;
  padding: 0.52rem 0.68rem;
  font-size: 0.8rem;
  color: #1e293b;
  background: #fff;
}

.faq-editor-btn {
  border: 1px solid #cbd5e1;
  border-radius: 0.62rem;
  background: #fff;
  padding: 0.27rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #334155;
}

.faq-builder-flow {
  --vf-node-bg: transparent;
  --vf-node-text: #0f172a;
  --vf-connection-path: #0b6e8c;
}
</style>
