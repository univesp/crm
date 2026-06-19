<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'

import StatusBadge from '@/components/StatusBadge.vue'
import {
  buildFaqBuilderPreviewJourneySafe,
  buildFaqBuilderPublicationPreview,
  rebuildFaqBuilderCanvasSnapshot,
  getFaqBuilderBundleById,
  loadFaqBuilderBundleLibraryLocal,
  publishFaqBuilderWorkspace,
  runFaqBuilderBundleSanityCheck,
  resolveFaqBuilderActivePublishedVersion,
  saveFaqBuilderBundleLibraryLocal,
  saveFaqBuilderDraftWorkspace,
  startFaqBuilderStudentSession,
  transitionFaqBuilderWorkflow,
  validateFaqBuilderBundle,
} from '@/services/faqBuilderHybridRuntime'
import { useAuthStore } from '@/stores/auth'

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

function formatDate(value = '') {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('pt-BR')
}

function publicationIssueLabel(issue = {}) {
  const code = String(issue.code || '').toLowerCase()

  if (code.includes('owner')) {
    return 'Revisar responsavel'
  }

  if (code.includes('final')) {
    return 'Completar etapa final'
  }

  if (code.includes('invalid') || code.includes('block')) {
    return 'Corrigir bloqueio antes de publicar'
  }

  return issue.message || 'Revisar pendencia antes de publicar'
}

function firstTextValue(values = []) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || ''
}

function predominantValue(values = [], fallback = 'Nao informado') {
  const counts = new Map()
  for (const value of values.map((item) => String(item || '').trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || fallback
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
let isFlowPageMounted = true
let flowRunSequence = 0
let activeFlowRunId = 0

function isFlowRouteActive() {
  const routeName = String(route.name || '').trim()
  if (!routeName) {
    return true
  }
  return routeName === 'admin-faq-flow'
}

function isFlowRunActive(runId = 0) {
  return isFlowPageMounted && isFlowRouteActive() && Number(runId) === Number(activeFlowRunId)
}

function invalidateFlowRun() {
  activeFlowRunId = flowRunSequence + 1
}

const ui = reactive({
  showOverflow: false,
  showPublishModal: false,
  showTesterModal: false,
  testerMode: 'draft',
  testerCurrentNodeId: '',
  testerPath: [],
  publishConfirm: false,
})
const feedback = reactive({ type: '', message: '' })
const publishForm = reactive({
  publishMode: 'immediate',
  effectiveStartAt: '',
  effectiveEndAt: '',
  priority: 50,
  displayRank: 50,
  isFeatured: false,
  conditions: '',
  summary: '',
})
const overflowRef = ref(null)

const currentEditorName = computed(
  () => auth.displayName || auth.mockContext?.userName || 'Admin local',
)
const library = reactive(loadFaqBuilderBundleLibraryLocal(currentEditorName.value))
const bundleId = computed(() => decodeBundleParam(route.params.bundleId))
const currentBundleEntry = computed(() =>
  getFaqBuilderBundleById(library, bundleId.value),
)
const workspace = computed(() => currentBundleEntry.value?.workspace || null)
const isMissingBundle = computed(() => !workspace.value || !currentBundleEntry.value)
const openState = reactive({
  isLoading: false,
  failed: false,
  safeMode: String(route.query.safe || '') === '1',
  issueCode: '',
  issueMessage: '',
  markers: [],
})
const safeRuntimeState = reactive({
  sanity: {
    ok: true,
    errors: [],
    warnings: [],
    bundle: { nodes: [], links: [] },
    canvasSnapshot: { nodePositions: {}, edges: [] },
    shouldUseSafeMode: false,
  },
  validation: {
    errors: [],
    warnings: [],
    hasBlockingPublishError: false,
    issues: [],
    nodeIssueSummary: new Map(),
    ownershipCoverage: {
      bundleDefaultConfigured: false,
      totalFinalNodes: 0,
      effectiveFinalNodes: 0,
      missingFinalNodes: 0,
      invalidOverrides: 0,
    },
  },
  flowGraph: {
    nodes: [],
    edges: [],
    edgeCount: 0,
    canvasWidth: 980,
    canvasHeight: 560,
    nodeWidth: 248,
    nodeHeight: 98,
  },
  previewRuntime: {
    startId: '',
    nodeById: new Map(),
    outgoingMap: new Map(),
  },
})

const validation = computed(() => safeRuntimeState.validation)
const flowGraph = computed(() => safeRuntimeState.flowGraph)
const activePublished = computed(() =>
  workspace.value
    ? resolveFaqBuilderActivePublishedVersion(workspace.value)
    : null,
)
const publicationPreview = computed(() =>
  workspace.value
    ? buildFaqBuilderPublicationPreview(workspace.value, {
        actorName: currentEditorName.value,
        publishConfig: {
          publishMode: publishForm.publishMode,
          effectiveStartAt: publishForm.effectiveStartAt || null,
          effectiveEndAt: publishForm.effectiveEndAt || null,
          priority: publishForm.priority,
          displayRank: publishForm.displayRank,
          isFeatured: publishForm.isFeatured,
          conditions: publishForm.conditions,
        },
      })
    : null,
)
const workflowStatusLabel = computed(() => {
  const status = String(workspace.value?.workflowStatus || '').toLowerCase()
  const labels = {
    draft: 'Rascunho',
    published: 'Publicado',
    'in review': 'Em revisao',
    review: 'Em revisao',
    archived: 'Arquivado',
  }
  return labels[status] || workspace.value?.workflowStatus || 'Nao informado'
})
const publicationReadiness = computed(() => {
  if (validation.value.hasBlockingPublishError) {
    return {
      label: 'Bloqueado',
      description: 'Corrija os bloqueios antes de publicar.',
      tone: 'danger',
    }
  }

  if (validation.value.warnings?.length || validation.value.ownershipCoverage?.missingFinalNodes) {
    return {
      label: 'Precisa revisar',
      description: 'Revise pendencias antes de publicar.',
      tone: 'warning',
    }
  }

  return {
    label: 'Apto para publicar',
    description: 'Teste a jornada e publique quando estiver pronto.',
    tone: 'success',
  }
})
const recommendedNextStep = computed(() => {
  if (publicationReadiness.value.tone === 'danger') {
    return 'Editar fluxo para corrigir bloqueios.'
  }

  if (publicationReadiness.value.tone === 'warning') {
    return 'Testar jornada e revisar pendencias.'
  }

  return activePublished.value
    ? 'Testar jornada antes de publicar nova versao.'
    : 'Testar jornada e publicar primeira versao.'
})
const activeVersionLabel = computed(() =>
  activePublished.value ? activePublished.value.bundleVersionId : 'Sem versao ativa',
)
const currentDraftVersionLabel = computed(() =>
  workspace.value?.draftBundle?.versioning?.draft_version ||
  publicationPreview.value?.nextVersionId ||
  'Rascunho atual',
)
const flowSummaryLabel = computed(
  () => `${flowGraph.value.nodes.length} etapas - ${flowGraph.value.edgeCount} conexoes`,
)
const recentPublicationHistory = computed(() =>
  Array.isArray(workspace.value?.publishedHistory)
    ? workspace.value.publishedHistory.slice(0, 3)
    : [],
)
const publicationPendingAllItems = computed(() => {
  const items = []

  for (const issue of validation.value.errors || []) {
    items.push({
      tone: 'danger',
      label: publicationIssueLabel(issue),
    })
  }

  if (validation.value.ownershipCoverage?.missingFinalNodes) {
    items.push({
      tone: 'warning',
      label: 'Revisar responsavel nas etapas finais',
    })
  }

  for (const issue of validation.value.warnings || []) {
    items.push({
      tone: 'warning',
      label: publicationIssueLabel(issue),
    })
  }

  return items
})
const publicationPendingItems = computed(() => publicationPendingAllItems.value.slice(0, 3))
const publicationPendingCount = computed(() => publicationPendingAllItems.value.length)
const governanceBundle = computed(() =>
  safeRuntimeState.sanity.bundle?.nodes?.length
    ? safeRuntimeState.sanity.bundle
    : workspace.value?.draftBundle || {},
)
const governanceNodes = computed(() =>
  Array.isArray(governanceBundle.value?.nodes) ? governanceBundle.value.nodes : [],
)
const flowOwner = computed(() =>
  governanceBundle.value?.operational_owner ||
  governanceBundle.value?.metadata?.operational_owner ||
  {},
)
const flowOwnerLabel = computed(() =>
  firstTextValue([
    flowOwner.value.queueLabel,
    flowOwner.value.areaLabel,
    flowOwner.value.roleKey,
    flowOwner.value.queueKey,
    predominantValue(governanceNodes.value.map((node) => node.fila_destino), ''),
  ]) || 'Nao definido',
)
const predominantQueueLabel = computed(() =>
  predominantValue(governanceNodes.value.map((node) => node.fila_destino), 'Nao informado'),
)
const predominantCriticalityLabel = computed(() =>
  predominantValue(governanceNodes.value.map((node) => node.criticidade_padrao), 'Nao informado'),
)
const predominantSlaLabel = computed(() =>
  predominantValue(governanceNodes.value.map((node) => node.sla_padrao), 'Nao informado'),
)
const ownershipStatusLabel = computed(() => {
  if (validation.value.hasBlockingPublishError) {
    return 'Bloqueado'
  }

  if (validation.value.ownershipCoverage?.missingFinalNodes || validation.value.ownershipCoverage?.invalidOverrides) {
    return 'Atencao'
  }

  return 'OK'
})
const ownershipStatusTone = computed(() => {
  if (ownershipStatusLabel.value === 'Bloqueado') return 'danger'
  if (ownershipStatusLabel.value === 'Atencao') return 'warning'
  return 'success'
})
const governanceIssueLabel = computed(() => {
  if (ownershipStatusLabel.value === 'Bloqueado') {
    return 'Corrigir fila/area antes de publicar'
  }

  if (ownershipStatusLabel.value === 'Atencao') {
    return 'Revisar responsavel'
  }

  return 'Sem bloqueios'
})
const finalOwnerCoverageLabel = computed(() => {
  const coverage = validation.value.ownershipCoverage || {}
  return `${coverage.effectiveFinalNodes || 0}/${coverage.totalFinalNodes || 0}`
})
const testBundle = computed(() => {
  if (!workspace.value) {
    return null
  }
  return ui.testerMode === 'published' && workspace.value.publishedBundle?.nodes?.length
    ? workspace.value.publishedBundle
    : safeRuntimeState.sanity.bundle
})
const testRuntime = computed(() =>
  testBundle.value
    ? buildFaqBuilderPreviewJourneySafe(
        testBundle.value,
        ui.testerCurrentNodeId,
        { mode: openState.safeMode ? 'safe' : 'default' },
      )
    : { startId: '', nodeById: new Map(), outgoingMap: new Map() },
)
const testerNode = computed(() => {
  const activeNodeId = ui.testerCurrentNodeId || testRuntime.value.startId
  return testRuntime.value.nodeById.get(activeNodeId) || null
})
const testerChoices = computed(() => {
  if (!testerNode.value) {
    return []
  }
  return (testRuntime.value.outgoingMap.get(testerNode.value.id) || [])
    .map((link) => testRuntime.value.nodeById.get(link.child_node_id))
    .filter(Boolean)
})

function appendOpenMarker(stage = '', details = '') {
  if (!isFlowPageMounted || !isFlowRouteActive()) {
    return
  }
  const marker = {
    at: new Date().toISOString(),
    stage,
    details,
  }
  openState.markers.push(marker)
  if (openState.markers.length > 30) {
    openState.markers.shift()
  }
  console.info('[faq-builder][open-flow]', marker)
}

function buildFlowGraphModel(bundle = {}, previewRuntime = {}, canvasSnapshot = {}) {
  const rawNodes = Array.isArray(bundle?.nodes)
    ? bundle.nodes.filter(
        (node) => node && typeof node === 'object' && String(node.id || '').trim(),
      )
    : []
  const limitedNodes = rawNodes.slice(0, 180)
  const outgoingMap = previewRuntime?.outgoingMap || new Map()
  const nodeWidth = 248
  const nodeHeight = 98

  const nodes = limitedNodes.map((node, index) => {
    const nodeId = String(node.id || '').trim()
    const fallbackRow = Math.floor(index / 4)
    const fallbackCol = index % 4
    const savedPosition = canvasSnapshot?.nodePositions?.[nodeId] || {}
    const x = Number.isFinite(Number(savedPosition.x))
      ? Number(savedPosition.x)
      : 80 + fallbackCol * (nodeWidth + 34)
    const y = Number.isFinite(Number(savedPosition.y))
      ? Number(savedPosition.y)
      : 80 + fallbackRow * (nodeHeight + 64)
    const isFinal = node.node_kind === 'leaf'
    return {
      id: nodeId,
      title: String(node.titulo_exibido || nodeId).trim(),
      subtitle: `${String(node.tema || '').trim()} / ${String(node.subtema || '').trim()}`,
      nodeModeLabel: isFinal ? 'Resposta final' : 'Caminho',
      actionLabel: String(node.ação || '').trim() || 'ação_nao_definida',
      outgoingCount: Array.isArray(outgoingMap.get(nodeId))
        ? outgoingMap.get(nodeId).length
        : 0,
      x,
      y,
    }
  })

  if (!nodes.length) {
    return {
      nodes: [],
      edges: [],
      edgeCount: 0,
      canvasWidth: 980,
      canvasHeight: 560,
      nodeWidth,
      nodeHeight,
    }
  }

  const nodeIdSet = new Set(nodes.map((node) => node.id))
  const rawEdges = Array.isArray(bundle?.links)
    ? bundle.links.filter(
        (link) =>
          link &&
          typeof link === 'object' &&
          link.ativo !== false &&
          nodeIdSet.has(String(link.parent_node_id || '').trim()) &&
          nodeIdSet.has(String(link.child_node_id || '').trim()),
      )
    : []

  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  const padX = 44
  const padY = 44
  const offsetX = padX - minX
  const offsetY = padY - minY
  const canvasWidth = Math.max(980, maxX - minX + nodeWidth + padX * 2)
  const canvasHeight = Math.max(560, maxY - minY + nodeHeight + padY * 2)

  const normalizedNodes = nodes.map((node) => ({
    ...node,
    drawX: Math.round(node.x + offsetX),
    drawY: Math.round(node.y + offsetY),
  }))
  const normalizedLookup = new Map(normalizedNodes.map((node) => [node.id, node]))
  const edges = rawEdges.map((link, index) => {
    const sourceId = String(link.parent_node_id || '').trim()
    const targetId = String(link.child_node_id || '').trim()
    const sourceNode = normalizedLookup.get(sourceId)
    const targetNode = normalizedLookup.get(targetId)
    return {
      id: String(link.link_id || '').trim() || `${sourceId}->${targetId}#${index + 1}`,
      sourceId,
      targetId,
      sourceX: Math.round(sourceNode.drawX + nodeWidth / 2),
      sourceY: Math.round(sourceNode.drawY + nodeHeight),
      targetX: Math.round(targetNode.drawX + nodeWidth / 2),
      targetY: Math.round(targetNode.drawY),
      order: Number(link.ordem || 0),
    }
  })

  return {
    nodes: normalizedNodes,
    edges,
    edgeCount: edges.length,
    canvasWidth,
    canvasHeight,
    nodeWidth,
    nodeHeight,
  }
}

function resolveBundleRuntime({ safeMode = false } = {}) {
  const runId = ++flowRunSequence
  activeFlowRunId = runId
  if (!isFlowRunActive(runId)) {
    return
  }

  if (!workspace.value) {
    if (!isFlowRunActive(runId)) {
      return
    }
    openState.failed = true
    openState.issueCode = 'bundle_not_found'
    openState.issueMessage = 'Bundle inexistente ou sem workspace.'
    return
  }

  openState.isLoading = true
  openState.failed = false
  openState.issueCode = ''
  openState.issueMessage = ''
  openState.markers = []
  if (!isFlowRunActive(runId)) {
    return
  }
  appendOpenMarker('open bundle started', bundleId.value)
  appendOpenMarker('bundle resolved', currentBundleEntry.value?.title || bundleId.value)

  try {
    if (!isFlowRunActive(runId)) {
      return
    }
    appendOpenMarker('bundle payload loaded', `nodes=${workspace.value.draftBundle?.nodes?.length || 0}`)
    const sanity = runFaqBuilderBundleSanityCheck(
      workspace.value.draftBundle,
      workspace.value.canvasSnapshot,
      {
        mode: safeMode ? 'safe' : 'default',
      },
    )
    if (!isFlowRunActive(runId)) {
      return
    }
    safeRuntimeState.sanity = sanity
    appendOpenMarker('snapshot loaded', `warnings=${sanity.warnings.length}`)

    if (sanity.shouldUseSafeMode && !safeMode) {
      if (!isFlowRunActive(runId)) {
        return
      }
      appendOpenMarker('builder failed with reason runtime_limit_requires_safe_mode')
      setSafeMode(true, { rerun: true })
      return
    }

    appendOpenMarker('validation started')
    const nextValidation = validateFaqBuilderBundle(
      sanity.bundle,
      { mode: 'edit' },
    )
    if (!isFlowRunActive(runId)) {
      return
    }
    safeRuntimeState.validation = nextValidation
    appendOpenMarker('validation finished')

    appendOpenMarker('preview started')
    const preview = buildFaqBuilderPreviewJourneySafe(
      sanity.bundle,
      '',
      { mode: safeMode ? 'safe' : 'default' },
    )
    if (!isFlowRunActive(runId)) {
      return
    }
    safeRuntimeState.previewRuntime = preview
    appendOpenMarker('preview finished')

    appendOpenMarker('nodes built')
    const nextFlowGraph = buildFlowGraphModel(
      sanity.bundle,
      preview,
      sanity.canvasSnapshot,
    )
    if (!isFlowRunActive(runId)) {
      return
    }
    safeRuntimeState.flowGraph = nextFlowGraph
    appendOpenMarker('edges built')

    appendOpenMarker('layout started')
    appendOpenMarker('layout finished')
    appendOpenMarker('fitView started')
    appendOpenMarker('fitView finished')
    appendOpenMarker('builder ready')
  } catch (error) {
    if (!isFlowRunActive(runId)) {
      return
    }
    openState.failed = true
    openState.issueCode = 'builder_open_failed'
    openState.issueMessage = String(error?.message || 'Falha ao abrir fluxo no builder.')
    appendOpenMarker('builder failed with reason', openState.issueMessage)
  } finally {
    if (isFlowRunActive(runId)) {
      openState.isLoading = false
    }
  }
}

watch(
  () => workspace.value,
  (value) => {
    if (!isFlowRouteActive()) {
      return
    }
    if (!value) {
      return
    }
    publishForm.publishMode = value.publishConfig?.publishMode || 'immediate'
    publishForm.effectiveStartAt = value.publishConfig?.effectiveStartAt || ''
    publishForm.effectiveEndAt = value.publishConfig?.effectiveEndAt || ''
    publishForm.priority = Number(value.publishConfig?.priority || 50)
    publishForm.displayRank = Number(value.publishConfig?.displayRank || 50)
    publishForm.isFeatured = Boolean(value.publishConfig?.isFeatured)
    publishForm.conditions = value.publishConfig?.conditions || ''
  },
  { immediate: true },
)

watch(
  () => route.query.safe,
  (safeQuery) => {
    if (!isFlowRouteActive()) {
      return
    }
    const nextValue = String(safeQuery || '') === '1'
    if (openState.safeMode === nextValue) {
      return
    }
    openState.safeMode = nextValue
  },
  { immediate: true },
)

watch(
  () => [bundleId.value, workspace.value, openState.safeMode],
  () => {
    if (!isFlowRouteActive()) {
      return
    }
    resolveBundleRuntime({
      safeMode: openState.safeMode,
    })
  },
  { immediate: true },
)

watch(
  () => route.query.tester,
  (testerMode) => {
    if (!isFlowRouteActive()) {
      return
    }
    if (!workspace.value || !testerMode || openState.failed) {
      return
    }
    const mode =
      String(testerMode).toLowerCase() === 'published' ? 'published' : 'draft'
    startTester(mode)
    const nextQuery = { ...route.query }
    delete nextQuery.tester
    router.replace({
      path: route.path,
      query: nextQuery,
    })
  },
  { immediate: true },
)

function setFeedback(type = '', message = '') {
  feedback.type = type
  feedback.message = message
}

function setSafeMode(enabled = true, { rerun = false } = {}) {
  if (!isFlowRouteActive()) {
    return
  }
  openState.safeMode = Boolean(enabled)
  const nextQuery = { ...route.query }
  if (openState.safeMode) {
    nextQuery.safe = '1'
  } else {
    delete nextQuery.safe
  }
  router.replace({
    path: route.path,
    query: nextQuery,
  })
  if (rerun) {
    resolveBundleRuntime({ safeMode: openState.safeMode })
  }
}

function retryOpenBundle() {
  resolveBundleRuntime({ safeMode: openState.safeMode })
}

function recoverByIgnoringSnapshot() {
  if (!workspace.value) {
    return
  }
  workspace.value.canvasSnapshot = rebuildFaqBuilderCanvasSnapshot(
    workspace.value.draftBundle,
    {},
  )
  persistLibrary()
  setFeedback('success', 'Snapshot visual reconstruido em modo seguro.')
  resolveBundleRuntime({ safeMode: true })
}

function openBundleInSafeMode() {
  setSafeMode(true, { rerun: true })
}

function toggleOverflow() {
  ui.showOverflow = !ui.showOverflow
}

function goToLibrary() {
  router.push({ name: 'admin-faq' })
}

function goToAdvancedPublication() {
  router.push({ name: 'admin-versioning' })
}

function goToEditor(mode = 'visual') {
  const normalizedBundleId = (() => {
    const rawValue = sanitizeBundleId(
      currentBundleEntry.value?.bundleId || bundleId.value || '',
    )
    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  })()
  if (!normalizedBundleId) {
    setFeedback('error', 'Fluxo invalido para abrir no editor.')
    return
  }
  const query = {}
  if (mode !== 'visual') {
    query.mode = mode
  }
  const targetRoute = {
    name: 'admin-faq-builder',
    params: {
      bundleId: normalizedBundleId,
    },
    ...(Object.keys(query).length ? { query } : {}),
  }

  // Navegação completa (hard navigation): evita dessincronismo URL x estado interno do
  // Vue Router quando router.push resolve com falha silenciosa (NavigationFailure).
  try {
    const resolved = router.resolve(targetRoute)
    window.location.assign(resolved.href)
  } catch (error) {
    console.error('[faq-flow][go-to-editor-failed]', error)
    setFeedback(
      'error',
      'Falha ao redirecionar para o editor completo.',
    )
  }
}

function persistLibrary() {
  saveFaqBuilderBundleLibraryLocal(library)
}

function syncPublishConfigToWorkspace() {
  if (!workspace.value) {
    return
  }
  workspace.value.publishConfig = {
    publishMode: publishForm.publishMode,
    effectiveStartAt: publishForm.effectiveStartAt || null,
    effectiveEndAt: publishForm.effectiveEndAt || null,
    priority: Number(publishForm.priority || 50),
    displayRank: Number(publishForm.displayRank || 50),
    isFeatured: Boolean(publishForm.isFeatured),
    conditions: String(publishForm.conditions || '').trim(),
  }
}

function saveDraft() {
  if (!workspace.value) return
  syncPublishConfigToWorkspace()
  saveFaqBuilderDraftWorkspace(workspace.value, {
    actorName: currentEditorName.value,
    summary: publishForm.summary || 'Rascunho salvo pela visao do fluxo.',
  })
  persistLibrary()
  setFeedback('success', 'Rascunho salvo sem impactar a versao publicada.')
}

function sendToReview() {
  if (!workspace.value) return
  const result = transitionFaqBuilderWorkflow(workspace.value, {
    nextStatus: 'In Review',
    actorName: currentEditorName.value,
    summary: publishForm.summary || 'Fluxo enviado para revisao.',
  })
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  persistLibrary()
  setFeedback('success', 'Fluxo enviado para revisao.')
}

function openPublishModal() {
  ui.publishConfirm = false
  ui.showPublishModal = true
}

function confirmPublish() {
  if (!workspace.value) return
  if (!ui.publishConfirm) {
    setFeedback('error', 'Confirme a publicação para continuar.')
    return
  }
  syncPublishConfigToWorkspace()
  const result = publishFaqBuilderWorkspace(workspace.value, {
    actorName: currentEditorName.value,
    summary: publishForm.summary || 'Publicação aprovada pela visao do fluxo.',
    publishConfig: workspace.value.publishConfig,
  })
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  persistLibrary()
  ui.showPublishModal = false
  setFeedback('success', 'Fluxo publicado com governanca de vigencia e precedencia.')
}

function startTester(mode = 'draft') {
  if (!workspace.value) return
  ui.testerMode = mode
  const session = startFaqBuilderStudentSession(workspace.value, {
    actor: currentEditorName.value,
    mode,
  })
  ui.testerPath = [`Sessao ${session.bundleVersionId}`]
  ui.testerCurrentNodeId = ''
  ui.showTesterModal = true
}

function chooseTesterNode(node) {
  if (!node) return
  ui.testerCurrentNodeId = node.id
  ui.testerPath.push(node.titulo_exibido || node.id)
}

function restartTester() {
  ui.testerPath = []
  ui.testerCurrentNodeId = ''
}

function handleOutsideClick(event) {
  if (!overflowRef.value || overflowRef.value.contains(event.target)) {
    return
  }
  ui.showOverflow = false
}

onMounted(() => {
  isFlowPageMounted = true
  document.addEventListener('pointerdown', handleOutsideClick)
})
onBeforeUnmount(() => {
  isFlowPageMounted = false
  invalidateFlowRun()
  document.removeEventListener('pointerdown', handleOutsideClick)
})

watch(
  () => route.name,
  (nextName) => {
    if (String(nextName || '').trim() !== 'admin-faq-flow') {
      invalidateFlowRun()
    }
  },
)
</script>

<template>
  <div class="grid gap-4">
    <section
      v-if="openState.isLoading"
      class="rounded-[8px] border border-slate-200 bg-white p-4"
    >
      <p class="text-sm font-semibold text-slate-900">Abrindo fluxo...</p>
      <p class="mt-2 text-xs text-slate-600">
        Preparando bundle, validação, preview e canvas em modo seguro.
      </p>
    </section>

    <section v-else-if="isMissingBundle" class="rounded-[8px] border border-[rgba(166,31,40,0.24)] bg-[rgba(253,236,237,0.8)] p-4">
      <p class="text-sm font-semibold text-[var(--color-danger)]">Fluxo nao encontrado.</p>
      <button type="button" class="mt-3 rounded-[8px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="goToLibrary">Voltar para biblioteca</button>
    </section>

    <template v-else>
      <section class="rounded-[8px] border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-normal text-slate-500">Fluxo FAQ</p>
            <h1 class="mt-1 text-lg font-semibold text-slate-950">{{ currentBundleEntry.title }}</h1>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="rounded-[8px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="startTester('draft')">Testar jornada</button>
            <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="goToEditor()">Editar fluxo</button>
            <button type="button" class="rounded-[8px] border border-[rgba(26,111,67,0.25)] bg-[rgba(220,252,231,0.75)] px-3 py-2 text-xs font-semibold text-[var(--color-success)]" @click="openPublishModal">Publicar fluxo</button>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-slate-900">Saude do fluxo</p>
            <p class="mt-1 text-xs text-slate-600">Status, versao e pendencias antes da publicação.</p>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <div class="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p class="text-[10px] font-semibold uppercase tracking-normal text-slate-500">Status</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">{{ workflowStatusLabel }}</p>
          </div>
          <div class="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p class="text-[10px] font-semibold uppercase tracking-normal text-slate-500">Aptidao</p>
            <p
              class="mt-1 text-sm font-semibold"
              :class="
                publicationReadiness.tone === 'danger'
                  ? 'text-[var(--color-danger)]'
                  : publicationReadiness.tone === 'warning'
                    ? 'text-amber-700'
                    : 'text-[var(--color-success)]'
              "
            >
              {{ publicationReadiness.label }}
            </p>
          </div>
          <div class="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p class="text-[10px] font-semibold uppercase tracking-normal text-slate-500">Versao ativa</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">{{ activeVersionLabel }}</p>
          </div>
          <div class="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p class="text-[10px] font-semibold uppercase tracking-normal text-slate-500">Rascunho/revisao</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">{{ currentDraftVersionLabel }}</p>
          </div>
          <div class="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p class="text-[10px] font-semibold uppercase tracking-normal text-slate-500">Pendencias</p>
            <p
              class="mt-1 text-sm font-semibold"
              :class="
                publicationReadiness.tone === 'danger'
                  ? 'text-[var(--color-danger)]'
                  : publicationReadiness.tone === 'warning'
                    ? 'text-amber-700'
                    : 'text-[var(--color-success)]'
              "
            >
              {{
                publicationReadiness.tone === 'danger'
                  ? publicationPendingCount + (publicationPendingCount === 1 ? ' bloqueio' : ' bloqueios')
                  : publicationReadiness.tone === 'warning'
                    ? publicationPendingCount + (publicationPendingCount === 1 ? ' alerta' : ' alertas')
                    : 'OK'
              }}
            </p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-slate-600">
            <strong class="font-semibold text-slate-800">Proximo passo:</strong>
            {{ recommendedNextStep }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="goToLibrary">Voltar a biblioteca</button>
            <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="saveDraft">Salvar rascunho</button>
            <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="goToAdvancedPublication">Ver publicação avancada</button>
            <div ref="overflowRef" class="relative">
              <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click.stop="toggleOverflow">Mais</button>
              <div v-if="ui.showOverflow" class="absolute right-0 z-20 mt-2 grid min-w-[220px] gap-1 rounded-[8px] border border-slate-200 bg-white p-2 shadow-lg">
                <button type="button" class="faq-overflow-btn" @click="sendToReview">Enviar para revisao</button>
                <button type="button" class="faq-overflow-btn" @click="goToEditor('import')">Abrir importação</button>
                <button type="button" class="faq-overflow-btn" @click="goToEditor('governance')">Abrir governanca</button>
                <button type="button" class="faq-overflow-btn" @click="startTester('published')">Testar publicado</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="openState.safeMode || safeRuntimeState.sanity.warnings.length || openState.failed"
        class="rounded-[8px] border border-[rgba(8,115,145,0.22)] bg-[rgba(224,242,254,0.72)] p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-normal text-[#0b6e8c]">
              Abertura protegida do fluxo
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900">
              {{
                openState.failed
                  ? 'Não foi possível preparar a visualização agora.'
                  : openState.safeMode
                    ? 'Modo seguro ativo para manter a revisao disponivel.'
                    : 'Fluxo aberto com ajustes automaticos de estabilidade.'
              }}
            </p>
            <p v-if="openState.issueMessage" class="mt-1 text-xs text-slate-700">
              {{ openState.issueMessage }}
            </p>
            <p
              v-else-if="safeRuntimeState.sanity.warnings.length"
              class="mt-1 text-xs text-slate-700"
            >
              {{
                `${safeRuntimeState.sanity.warnings.length} ajuste(s) aplicados para manter a visualização estavel.`
              }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              @click="retryOpenBundle"
            >
              Tentar novamente
            </button>
            <button
              v-if="!openState.safeMode"
              type="button"
              class="rounded-[8px] border border-[#0b6e8c] bg-white px-3 py-2 text-xs font-semibold text-[#0b6e8c]"
              @click="openBundleInSafeMode"
            >
              Abrir em modo seguro
            </button>
            <button
              type="button"
              class="rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              @click="recoverByIgnoringSnapshot"
            >
              Reconstruir layout visual
            </button>
          </div>
        </div>
        <details
          v-if="openState.markers.length"
          class="mt-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
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

      <section v-if="feedback.message" class="rounded-[8px] border px-4 py-3 text-sm" :class="feedback.type === 'error' ? 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]' : 'border-[rgba(26,111,67,0.22)] bg-[rgba(220,252,231,0.75)] text-[var(--color-success)]'">{{ feedback.message }}</section>

      <section class="grid gap-3 lg:grid-cols-2">
        <article class="rounded-[8px] border border-slate-200 bg-white p-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-slate-900">Governanca do fluxo</p>
              <p class="mt-1 text-xs text-slate-600">Responsavel, cobertura e regras operacionais deste fluxo.</p>
            </div>
            <StatusBadge :label="ownershipStatusLabel" />
          </div>
          <div class="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            <div class="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
              <p class="font-semibold text-slate-500">Area/fila responsavel</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ predominantQueueLabel }}</p>
            </div>
            <div class="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
              <p class="font-semibold text-slate-500">Responsavel operacional</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ flowOwnerLabel }}</p>
            </div>
            <div class="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
              <p class="font-semibold text-slate-500">Cobertura final</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ finalOwnerCoverageLabel }}</p>
            </div>
            <div class="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
              <p class="font-semibold text-slate-500">SLA / criticidade</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ predominantSlaLabel }} - {{ predominantCriticalityLabel }}</p>
            </div>
          </div>
          <p
            class="mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold"
            :class="
              ownershipStatusTone === 'danger'
                ? 'bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]'
                : ownershipStatusTone === 'warning'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-[rgba(220,252,231,0.75)] text-[var(--color-success)]'
            "
          >
            {{ governanceIssueLabel }}
          </p>
        </article>
      </section>

      <section v-if="!openState.failed" class="grid gap-3 lg:grid-cols-[1fr_360px]">
        <article class="min-w-0 rounded-[8px] border border-slate-200 bg-white p-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-slate-900">Pre-visualização do fluxo</p>
              <p class="mt-1 text-xs text-slate-600">Revise a jornada. Para alterar a estrutura, abra o editor.</p>
            </div>
            <p
              class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
              :aria-label="`${flowGraph.edgeCount} conexao(oes)`"
            >
              {{ flowSummaryLabel }}
            </p>
          </div>
          <div class="mt-3 h-[420px] overflow-auto rounded-[8px] border border-slate-200 bg-slate-50 p-3">
            <div
              class="relative rounded-[8px] border border-slate-200 bg-white"
              :style="{
                width: `${flowGraph.canvasWidth}px`,
                height: `${flowGraph.canvasHeight}px`,
              }"
            >
              <svg
                class="pointer-events-none absolute inset-0 h-full w-full"
                :viewBox="`0 0 ${flowGraph.canvasWidth} ${flowGraph.canvasHeight}`"
                preserveAspectRatio="xMinYMin meet"
              >
                <defs>
                  <marker
                    id="faq-flow-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
                  </marker>
                </defs>
                <g v-for="edge in flowGraph.edges" :key="`flow-edge-${edge.id}`">
                  <line
                    :x1="edge.sourceX"
                    :y1="edge.sourceY"
                    :x2="edge.targetX"
                    :y2="edge.targetY"
                    stroke="#94a3b8"
                    stroke-width="1.5"
                    marker-end="url(#faq-flow-arrow)"
                  />
                  <text
                    v-if="edge.order > 0"
                    :x="(edge.sourceX + edge.targetX) / 2"
                    :y="(edge.sourceY + edge.targetY) / 2 - 5"
                    fill="#64748b"
                    font-size="10"
                    text-anchor="middle"
                  >
                    {{ edge.order }}
                  </text>
                </g>
              </svg>

              <article
                v-for="node in flowGraph.nodes"
                :key="`flow-node-${node.id}`"
                class="absolute rounded-[8px] border px-3 py-2 shadow-sm"
                :class="
                  node.nodeModeLabel === 'Resposta final'
                    ? 'border-[rgba(8,115,145,0.25)] bg-[rgba(224,242,254,0.92)]'
                    : 'border-slate-200 bg-white'
                "
                :style="{
                  width: `${flowGraph.nodeWidth}px`,
                  minHeight: `${flowGraph.nodeHeight}px`,
                  left: `${node.drawX}px`,
                  top: `${node.drawY}px`,
                }"
              >
                <p class="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                  {{ node.nodeModeLabel }}
                </p>
                <p class="mt-1 text-sm font-semibold text-slate-900">
                  {{ node.title }}
                </p>
                <p class="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                  {{ node.subtitle }}
                </p>
                <p class="mt-1 text-[11px] text-slate-600">
                  Acao: {{ node.actionLabel }}
                </p>
                <p class="text-[11px] text-slate-600">
                  Saidas: {{ node.outgoingCount }}
                </p>
              </article>
            </div>
            <p v-if="!flowGraph.nodes.length" class="py-6 text-center text-sm text-slate-500">
              Nenhum no valido para visualização resumida.
            </p>
          </div>
        </article>
        <article class="rounded-[8px] border border-slate-200 bg-white p-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-slate-900">Publicação do fluxo</p>
              <p class="mt-1 text-xs text-slate-600">{{ publicationReadiness.description }}</p>
            </div>
            <StatusBadge :label="publicationReadiness.label" />
          </div>

          <div class="mt-3 grid gap-2 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p><strong>Status:</strong> {{ workflowStatusLabel }}</p>
            <p><strong>Versao ativa:</strong> {{ activeVersionLabel }}</p>
            <p><strong>Rascunho/revisao:</strong> {{ currentDraftVersionLabel }}</p>
            <p><strong>Inicio de vigencia:</strong> {{ formatDate(publicationPreview?.effectiveStartAt) }}</p>
            <p><strong>Fim de vigencia:</strong> {{ formatDate(publicationPreview?.effectiveEndAt) }}</p>
          </div>

          <div class="mt-3 rounded-[8px] border border-slate-200 bg-white p-3">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-semibold text-slate-900">Pendencias para publicar</p>
              <StatusBadge :label="publicationReadiness.tone === 'success' ? 'OK' : publicationReadiness.label" />
            </div>
            <div v-if="publicationPendingItems.length" class="mt-3 grid gap-2">
              <p
                v-for="item in publicationPendingItems"
                :key="item.label"
                class="rounded-[8px] px-3 py-2 text-xs font-semibold"
                :class="item.tone === 'danger' ? 'bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]' : 'bg-amber-50 text-amber-700'"
              >
                {{ item.label }}
              </p>
            </div>
            <p v-else class="mt-2 text-xs text-slate-600">OK para seguir com teste e publicação.</p>
          </div>

          <div class="mt-3 grid gap-2 text-xs">
            <label class="grid gap-1">
              <span class="font-semibold text-slate-600">Modo de publicação</span>
              <select v-model="publishForm.publishMode" class="faq-input">
                <option value="immediate">Publicar imediatamente</option>
                <option value="scheduled">Publicar em data futura</option>
              </select>
            </label>
            <label class="grid gap-1">
              <span class="font-semibold text-slate-600">Inicio de vigencia</span>
              <input v-model="publishForm.effectiveStartAt" type="datetime-local" class="faq-input" />
            </label>
            <label class="grid gap-1">
              <span class="font-semibold text-slate-600">Fim de vigencia (opcional)</span>
              <input v-model="publishForm.effectiveEndAt" type="datetime-local" class="faq-input" />
            </label>
            <label class="grid gap-1">
              <span class="font-semibold text-slate-600">Resumo da mudanca</span>
              <textarea v-model="publishForm.summary" rows="3" class="faq-input"></textarea>
            </label>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="sendToReview">Revisar publicação</button>
            <button type="button" class="rounded-[8px] border border-[rgba(26,111,67,0.25)] bg-[rgba(220,252,231,0.75)] px-3 py-2 text-xs font-semibold text-[var(--color-success)]" @click="openPublishModal">Publicar fluxo</button>
            <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="saveDraft">Salvar rascunho</button>
          </div>

          <details class="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <summary class="cursor-pointer font-semibold text-slate-700">Historico recente</summary>
            <div v-if="recentPublicationHistory.length" class="mt-3 grid gap-2 text-xs text-slate-600">
              <p v-for="item in recentPublicationHistory" :key="`${item.bundleVersionId}-${item.publishedAt}`">
                <strong>{{ item.bundleVersionId }}</strong> publicado em {{ formatDate(item.publishedAt) }} por {{ item.publishedBy || 'Admin' }}.
              </p>
            </div>
            <p v-else class="mt-3 text-xs text-slate-600">Historico detalhado disponivel na area de publicação avancada.</p>
          </details>

          <details class="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <summary class="cursor-pointer font-semibold text-slate-700">Detalhes tecnicos</summary>
            <div class="mt-3 grid gap-3 text-xs text-slate-600">
              <div class="grid gap-2">
                <p><strong>Fluxo:</strong> {{ bundleId }}</p>
                <p><strong>Etapas:</strong> {{ flowGraph.nodes.length }} etapas - {{ flowGraph.edgeCount }} conexoes</p>
                <p><strong>Proxima versao:</strong> {{ publicationPreview?.nextVersionId || '-' }}</p>
                <p><strong>Substitui:</strong> {{ publicationPreview?.currentPublishedVersion || 'Nenhuma' }}</p>
              </div>
              <div class="grid gap-2">
                <label class="grid gap-1"><span class="font-semibold text-slate-600">Prioridade</span><input v-model.number="publishForm.priority" type="number" min="0" max="1000" class="faq-input" /></label>
                <label class="grid gap-1"><span class="font-semibold text-slate-600">Ordem de exibicao</span><input v-model.number="publishForm.displayRank" type="number" min="0" max="1000" class="faq-input" /></label>
                <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><input v-model="publishForm.isFeatured" type="checkbox" /> Destacar este fluxo</label>
                <label class="grid gap-1"><span class="font-semibold text-slate-600">Condicao especial (opcional)</span><input v-model="publishForm.conditions" type="text" class="faq-input" placeholder="Ex.: periodo rematricula ativo" /></label>
              </div>
            </div>
          </details>
        </article>
      </section>

      <section
        v-else
        class="rounded-[8px] border border-[rgba(166,31,40,0.24)] bg-[rgba(253,236,237,0.75)] p-4 text-sm text-[var(--color-danger)]"
      >
        O fluxo nao pode ser renderizado neste momento. Use o modo seguro ou reconstrua o layout visual para recuperar.
      </section>
    </template>

    <div v-if="ui.showPublishModal" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4">
      <div class="w-full max-w-[620px] rounded-[8px] border border-slate-200 bg-white p-4">
        <h2 class="text-base font-semibold text-slate-900">Confirmar publicação</h2>
        <p class="mt-2 text-sm text-slate-600">Esta ação ativa uma nova versao do fluxo e nao interrompe jornadas ja iniciadas (politica sticky_version).</p>
        <ul class="mt-3 grid gap-1 text-xs text-slate-700">
          <li><strong>Fluxo:</strong> {{ currentBundleEntry?.title }}</li>
          <li><strong>Nova versao:</strong> {{ publicationPreview?.nextVersionId }}</li>
          <li><strong>Inicio:</strong> {{ formatDate(publicationPreview?.effectiveStartAt) }}</li>
          <li><strong>Fim:</strong> {{ formatDate(publicationPreview?.effectiveEndAt) }}</li>
          <li><strong>Prioridade:</strong> {{ publicationPreview?.priority }}</li>
        </ul>
        <label class="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><input v-model="ui.publishConfirm" type="checkbox" /> Confirmo o impacto da publicação</label>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="ui.showPublishModal = false">Cancelar</button>
          <button type="button" class="rounded-[8px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="confirmPublish">Confirmar publicação</button>
        </div>
      </div>
    </div>

    <div v-if="ui.showTesterModal" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4">
      <div class="w-full max-w-[760px] rounded-[8px] border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-slate-900">Teste da jornada do aluno</h2>
          <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700" @click="ui.showTesterModal = false">Fechar</button>
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="rounded-full border px-3 py-1 text-xs font-semibold" :class="ui.testerMode === 'draft' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'" @click="startTester('draft')">Testar draft</button>
          <button type="button" class="rounded-full border px-3 py-1 text-xs font-semibold" :class="ui.testerMode === 'published' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'" @click="startTester('published')">Testar publicado</button>
          <StatusBadge :label="`Modo: ${ui.testerMode}`" />
        </div>
        <div class="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs text-slate-500">Caminho percorrido</p>
          <p class="mt-1 text-sm text-slate-700">{{ ui.testerPath.join(' > ') || 'Inicio da jornada' }}</p>
        </div>
        <div class="mt-3 rounded-[8px] border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-normal text-slate-500">Pergunta atual</p>
          <p class="mt-1 text-base font-semibold text-slate-950">{{ testerNode?.titulo_exibido || 'Fluxo sem no inicial' }}</p>
          <p v-if="testerNode?.resposta" class="mt-2 text-sm text-slate-700">{{ testerNode.resposta.replace(/<[^>]+>/g, ' ').trim() }}</p>
          <div class="mt-3 grid gap-2">
            <button v-for="choice in testerChoices" :key="choice.id" type="button" class="rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-400" @click="chooseTesterNode(choice)">
              {{ choice.titulo_exibido }}
            </button>
            <p v-if="!testerChoices.length" class="text-xs text-slate-500">Fim da jornada. Acao final: {{ testerNode?.ação || 'n/a' }}</p>
          </div>
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="restartTester">Reiniciar teste</button>
          <button type="button" class="rounded-[8px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="goToEditor()">Abrir editor completo</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 0.65rem;
  padding: 0.48rem 0.6rem;
  font-size: 0.78rem;
  color: #1e293b;
  background: #fff;
}

.faq-overflow-btn {
  text-align: left;
  border-radius: 0.55rem;
  padding: 0.45rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
}

.faq-overflow-btn:hover {
  background: #f1f5f9;
}

</style>
